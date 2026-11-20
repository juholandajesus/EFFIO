/**
 * Which machine probably caused it?
 *
 * The CSV only has the whole plant's hourly load, so EFFIO can't *measure*
 * which machine misbehaved. It estimates it from the machine register the
 * client keeps (power, sector, schedule, type) and from what the team
 * confirmed before. Faísca then asks the sector to confirm, and every
 * confirmation makes the next estimate sharper.
 */
import type { Anomaly, AnomalyKind } from "./engine";
import { siteEnergy } from "./engine";

/** A machine as it comes from the Machines screen / API. */
export interface RegisteredMachine {
  id: number;
  nome: string;
  setor_id: number;
  tipo_equipamento: string;
  potencia_kw: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: string[];
  status: string;
  confirmacoes_ia: number;
}

export interface Suspect {
  machine: RegisteredMachine;
  probability: number; // 0..1
  reason: "left_on" | "drift" | "coincided";
}

const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function scheduled(m: RegisteredMachine, dow: number, hour: number) {
  if (!m.dias_semana.includes(DOW[dow])) return false;
  const [h0] = m.horario_inicio.split(":").map(Number);
  const [h1, m1] = m.horario_fim.split(":").map(Number);
  const end = m1 > 0 ? h1 + 1 : h1; // "23:59" counts the whole last hour
  return h0 <= end ? hour >= h0 && hour < end : hour >= h0 || hour < end;
}

/**
 * How likely each type is to cause each kind of problem, and the share of its
 * rated power it typically draws when it does. Field experience, editable.
 */
function typeProfile(type: string, kind: AnomalyKind): { prior: number; load: number } {
  const t = norm(type);
  const is = (...k: string[]) => k.some((x) => t.includes(x));
  if (kind === "baseload") {
    if (is("compressor")) return { prior: 1.8, load: 0.6 }; // air leaks
    if (is("climatiz", "chiller", "hvac")) return { prior: 1.3, load: 0.5 }; // setpoint / schedule
    if (is("bomba", "pump", "exaust")) return { prior: 1.0, load: 0.6 };
    return { prior: 0.5, load: 0.3 };
  }
  if (kind === "off_hours") {
    if (is("forno", "furnace", "estufa")) return { prior: 1.6, load: 0.6 }; // kept hot
    if (is("climatiz", "chiller")) return { prior: 1.1, load: 0.7 };
    if (is("compressor")) return { prior: 1.1, load: 0.8 };
    if (is("exaust")) return { prior: 0.9, load: 0.8 };
    return { prior: 0.7, load: 0.35 }; // machine tools idling
  }
  // excess while producing / demand peak: the big loads that start together
  if (is("forno", "furnace")) return { prior: 1.5, load: 0.8 };
  return { prior: 1.0, load: 0.8 };
}

/** Ranks the registered machines by how likely they are to explain an anomaly. */
export function suspectsFor(a: Anomaly, machines: RegisteredMachine[], top = 3): { suspects: Suspect[]; other: number } {
  const target = Math.max(a.excessKw, 1);
  const scored = machines
    .filter((m) => m.status !== "inativo")
    .map((m) => {
      const { prior, load } = typeProfile(m.tipo_equipamento, a.kind);
      // share of the problem hours in which the register says the machine should be running
      const share = a.slots.filter((s) => scheduled(m, s.dow, s.hour)).length / Math.max(a.slots.length, 1);
      const continuous = m.dias_semana.length === 7 && scheduled(m, 0, 3) && scheduled(m, 3, 15);

      let schedule: number;
      let reason: Suspect["reason"];
      if (a.kind === "off_hours") {
        // something that should have been off: machines NOT scheduled then
        schedule = continuous ? 0.35 : 0.15 + 0.85 * (1 - share);
        reason = "left_on";
      } else if (a.kind === "baseload") {
        // a creep that shows at night: machines that run around the clock
        schedule = continuous ? 1 : 0.15 + 0.5 * share;
        reason = "drift";
      } else {
        // during production: only what is scheduled then can add to it
        schedule = 0.1 + 0.9 * share;
        reason = "coincided";
      }

      // can the machine's power explain the size of the problem?
      const draw = m.potencia_kw * load;
      const fit = Math.exp(-(Math.log(draw / target) ** 2) / (2 * 0.9 ** 2));
      const capacity = m.potencia_kw * 1.1 >= target * 0.6 ? 1 : 0.25;

      // learning: what the team confirmed before
      const learned = 1 + 0.35 * Math.min(m.confirmacoes_ia, 10);
      const maintenance = m.status === "manutencao" ? 0.6 : 1;

      return { machine: m, score: prior * schedule * fit * capacity * learned * maintenance, reason };
    })
    .sort((x, y) => y.score - x.score);

  // a CSV can't give certainty: flatten the scores so the doubt stays visible
  // (and so each confirmation from the team visibly moves the ranking)
  const weight = (x: number) => Math.pow(x, 0.5);
  const total = scored.reduce((s, x) => s + weight(x.score), 0) || 1;
  const suspects = scored.slice(0, top).map((x) => ({ machine: x.machine, probability: weight(x.score) / total, reason: x.reason }));
  const other = Math.max(0, 1 - suspects.reduce((s, x) => s + x.probability, 0));
  return { suspects, other };
}

/** Estimated share of the bill per machine, from the register (power × scheduled hours). */
export function estimatedShares(empresaId: number, machines: RegisteredMachine[], days = 30) {
  const { kwh, tariff } = siteEnergy(empresaId, days);
  const LOAD: [string[], number][] = [
    [["forno", "furnace"], 0.75],
    [["compressor"], 0.7],
    [["climatiz", "chiller"], 0.65],
  ];
  const raw = machines
    .filter((m) => m.status !== "inativo")
    .map((m) => {
      let hours = 0;
      for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (scheduled(m, d, h)) hours++;
      const lf = LOAD.find(([k]) => k.some((x) => norm(m.tipo_equipamento).includes(x)))?.[1] ?? 0.55;
      return { machine: m, est: m.potencia_kw * lf * hours * (days / 7) };
    });
  const sum = raw.reduce((s, x) => s + x.est, 0) || 1;
  // scale so the register adds up to what the meter actually measured
  return raw
    .map((x) => ({ machine: x.machine, kwh: (x.est / sum) * kwh, cost: (x.est / sum) * kwh * tariff, share: x.est / sum }))
    .sort((a, b) => b.kwh - a.kwh);
}
