/**
 * Faísca, EFFIO's energy agent.
 *
 * By default it answers locally: it classifies the question and computes the
 * answer from the plant's whole-site curve (the CSV) and the machine register.
 * It never claims to know which machine did it: it names suspects with a
 * probability and asks the sector to confirm.
 *
 * If VITE_COPILOT_URL is set, questions go to that endpoint with the persona
 * and a compact data context, so any LLM can take over the conversation.
 */
import { dailySeries, detectAnomalies, forecast, getPlant, kpis, type Anomaly } from "./engine";
import { estimatedShares, suspectsFor, type RegisteredMachine, type Suspect } from "./attribution";
import type { Fmt } from "./use-plant";

type Lang = "en" | "pt";

export type Intent = "explain" | "why" | "waste" | "forecast" | "machines" | "greeting" | "unknown";

/** Something Faísca can do on its own, not just say. */
export interface AgentAction {
  kind: "confirm_ticket";
  label: string;
  title: string; // ticket title
  body: string; // Faísca's first message in the ticket
  anomalyId: string;
  suspects: { maquina_id: number; nome: string; prob: number }[];
}

export interface CopilotAnswer {
  text: string; // light markdown: **bold**, "- " bullets
  links?: { label: string; href: string }[];
  actions?: AgentAction[];
  intent?: Intent;
  source: "local" | "remote";
}

export interface CopilotCtx {
  empresaId: number;
  lang: Lang;
  fmt: Fmt;
  machines: RegisteredMachine[];
  firstName?: string;
  /** tickets already opened from anomalies (so Faísca doesn't ask twice) */
  tickets?: { anomalia_id?: string | null; confirmado_maquina_id?: number | null }[];
}

function ticketOf(a: Anomaly, ctx: CopilotCtx) {
  return ctx.tickets?.filter((t) => t.anomalia_id === a.id).pop();
}

/** "suspect X (60%)" or, once the team answered, "confirmed: X" */
function culprit(a: Anomaly, ctx: CopilotCtx): string {
  const pt = ctx.lang === "pt";
  const tk = ticketOf(a, ctx);
  if (tk?.confirmado_maquina_id) {
    const m = ctx.machines.find((x) => x.id === tk.confirmado_maquina_id);
    if (m) return pt ? `confirmado: ${m.nome}` : `confirmed: ${m.nome}`;
  }
  const top = suspectsFor(a, ctx.machines, 1).suspects[0];
  if (!top) return "";
  const waiting = tk ? (pt ? ", aguardando o setor" : ", waiting for the sector") : "";
  return `${pt ? "suspeito" : "suspect"} ${top.machine.nome} (${pct(top.probability)}${waiting})`;
}

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pct = (p: number) => `${Math.round(p * 100)}%`;

export function suggestions(lang: Lang): string[] {
  return lang === "pt"
    ? ["Por que o consumo subiu esta semana?", "Onde estou desperdiçando energia?", "Qual máquina mais pesa na conta?", "Qual será o pico de demanda nos próximos 7 dias?"]
    : ["Why did consumption go up this week?", "Where am I wasting energy?", "Which machine weighs most on the bill?", "What will peak demand be in the next 7 days?"];
}

// ───────────────────────── how Faísca names things ─────────────────────────

export function anomalyTitle(a: Anomaly, lang: Lang): string {
  const pt = lang === "pt";
  switch (a.kind) {
    case "baseload":
      return pt ? "Consumo de madrugada acima do normal" : "Night-time consumption above normal";
    case "off_hours":
      return pt ? "Energia consumida com a fábrica parada" : "Energy drawn while the plant was stopped";
    case "excess":
      return pt ? "Consumo acima do padrão no horário de produção" : "Above-pattern consumption during production";
    case "demand_peak":
      return pt ? `Pico de demanda em ${a.peakPct}% do contratado` : `Demand peak at ${a.peakPct}% of contracted`;
  }
}

export function anomalyEvidence(a: Anomaly, lang: Lang, fmt: Fmt): string {
  const pt = lang === "pt";
  const kw = fmt.num(a.excessKw);
  switch (a.kind) {
    case "baseload":
      return pt
        ? `Toda noite a fábrica está puxando cerca de ${kw} kW a mais que o normal para o horário. Esse padrão costuma ser vazamento de ar comprimido ou equipamento de utilidades sem controle.`
        : `Every night the plant draws about ${kw} kW more than usual for that hour. That pattern usually means a compressed-air leak or a utility running without control.`;
    case "off_hours":
      return pt
        ? `Com a fábrica parada, a curva ficou ${kw} kW acima do normal por ${a.hours} horas seguidas. Algo grande ficou ligado.`
        : `With the plant stopped, the curve stayed ${kw} kW above normal for ${a.hours} hours straight. Something big was left on.`;
    case "excess":
      return pt ? `Durante a produção, a fábrica consumiu ${kw} kW acima do próprio padrão.` : `During production the plant drew ${kw} kW above its own pattern.`;
    case "demand_peak":
      return pt
        ? `Várias cargas coincidiram e a demanda chegou a ${fmt.num(a.peakKw ?? 0)} kW. Escalonar partidas ou usar o BESS no horário evita multa de ultrapassagem.`
        : `Several loads coincided and demand reached ${fmt.num(a.peakKw ?? 0)} kW. Staggering start-ups or discharging the BESS avoids a demand penalty.`;
  }
}

function suspectLine(s: Suspect, lang: Lang) {
  return `- **${s.machine.nome}**: ${pct(s.probability)}`;
}

function confirmAction(a: Anomaly, ctx: CopilotCtx): AgentAction | undefined {
  if (ticketOf(a, ctx)) return undefined; // already asked
  const { suspects } = suspectsFor(a, ctx.machines);
  if (!suspects.length) return undefined;
  const pt = ctx.lang === "pt";
  const when = ctx.fmt.dateTime(a.start);
  const title = pt ? `Confirmar: ${anomalyTitle(a, "pt").toLowerCase()} (${when})` : `Confirm: ${anomalyTitle(a, "en").toLowerCase()} (${when})`;
  const list = suspects.map((s) => `${s.machine.nome} (${pct(s.probability)})`).join(", ");
  const cost = a.annualizedCost > 0 ? ctx.fmt.money(a.annualizedCost) : null;
  const body = pt
    ? `[Faísca] ${anomalyEvidence(a, "pt", ctx.fmt)} Pela curva e pelo cadastro, meus suspeitos são: ${list}.${cost ? ` Impacto estimado: ${cost} por ano.` : ""} Você consegue confirmar qual foi? É só tocar na máquina aqui no chamado.`
    : `[Faísca] ${anomalyEvidence(a, "en", ctx.fmt)} From the curve and the register, my suspects are: ${list}.${cost ? ` Estimated impact: ${cost} a year.` : ""} Can you confirm which one it was? Just tap the machine here in the ticket.`;
  return {
    kind: "confirm_ticket",
    label: pt ? "Pedir confirmação ao setor" : "Ask the sector to confirm",
    title,
    body,
    anomalyId: a.id,
    suspects: suspects.map((s) => ({ maquina_id: s.machine.id, nome: s.machine.nome, prob: Math.round(s.probability * 100) })),
  };
}

// ───────────────────────── Faísca's voice ─────────────────────────
// Sharp and direct: one short line of attitude, then the numbers.

const OPENERS: Record<Intent, { en: string[]; pt: string[] }> = {
  why: { pt: ["Fui atrás do culpado.", "Conta subindo sem motivo comigo não passa."], en: ["I went after the culprit.", "A bill going up for no reason doesn't get past me."] },
  waste: { pt: ["Achei dinheiro escapando. Anota aí.", "Desperdício é meu assunto preferido."], en: ["Found money leaking. Write this down.", "Waste is my favourite subject."] },
  forecast: { pt: ["Olhei o padrão das últimas semanas e fiz as contas.", "Futuro eu não adivinho, eu calculo."], en: ["I checked the last weeks' pattern and ran the numbers.", "I don't guess the future, I calculate it."] },
  machines: { pt: ["Pelo cadastro e pela curva, a conta se divide assim:"], en: ["From the register and the curve, the bill splits like this:"] },
  explain: { pt: ["Esse eu resolveria hoje.", "Vamos direto ao ponto."], en: ["I'd fix this one today.", "Straight to the point."] },
  greeting: { pt: ["Fala! Sou o Faísca. Leio a curva de consumo da fábrica e aponto onde a conta está vazando."], en: ["Hey, I'm Faísca. I read the plant's consumption curve and point out where the bill is leaking."] },
  unknown: {
    pt: ["Essa foge do meu painel. Eu entendo de consumo, desperdício, máquinas e pico de demanda. Enquanto isso, o resumo:"],
    en: ["That's outside my panel. I'm good with consumption, waste, machines and peak demand. Meanwhile, here's the summary:"],
  },
};

function pick<T>(xs: T[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return xs[h % xs.length];
}

function voice(a: CopilotAnswer, question: string, lang: Lang): CopilotAnswer {
  if (!a.intent) return a;
  const opener = pick(OPENERS[a.intent][lang], question);
  const nudge = a.actions?.length ? (lang === "pt" ? "Quer que eu pergunte para o setor?" : "Want me to ask the sector?") : "";
  return { ...a, text: [opener, a.text, nudge].filter(Boolean).join("\n") };
}

/** Faísca speaks first: the most expensive open problem, with its suspects. */
export function greeting(ctx: CopilotCtx): CopilotAnswer {
  const { lang, fmt, firstName, empresaId } = ctx;
  const pt = lang === "pt";
  const hi = pt ? `Fala${firstName ? `, ${firstName}` : ""}.` : `Hey${firstName ? ` ${firstName}` : ""}.`;
  const withCost = detectAnomalies(empresaId).filter((a) => a.annualizedCost > 0);
  const top = withCost.find((a) => !ticketOf(a, ctx));
  if (!top) {
    const text = withCost.length
      ? pt
        ? `${hi} Todos os problemas que achei já estão com a equipe. Pode perguntar.`
        : `${hi} Every problem I found is already with the team. Ask away.`
      : pt
      ? `${hi} Tudo limpo por aqui. Pode perguntar.`
      : `${hi} All clean here. Ask away.`;
    return { text, intent: "greeting", source: "local" };
  }
  const { suspects } = suspectsFor(top, ctx.machines, 1);
  const s = suspects[0];
  const text = pt
    ? `${hi} Antes de você perguntar: **${anomalyTitle(top, "pt").toLowerCase()}**, desde ${fmt.date(top.start)}, e isso custa **${fmt.money(top.annualizedCost)} por ano**.${s ? ` Meu principal suspeito é o **${s.machine.nome}** (${pct(s.probability)}).` : ""}\nQuer que eu pergunte para o setor?`
    : `${hi} Before you ask: **${anomalyTitle(top, "en").toLowerCase()}**, since ${fmt.date(top.start)}, and that's **${fmt.money(top.annualizedCost)} a year**.${s ? ` My main suspect is the **${s.machine.nome}** (${pct(s.probability)}).` : ""}\nWant me to ask the sector?`;
  const action = confirmAction(top, ctx);
  return { text, intent: "greeting", actions: action ? [action] : undefined, source: "local" };
}

// ───────────────────────── local reasoning ─────────────────────────

function localAnswer(question: string, ctx: CopilotCtx): CopilotAnswer {
  const { empresaId, lang, fmt, machines } = ctx;
  const q = norm(question);
  const pt = lang === "pt";
  const anomalies = detectAnomalies(empresaId);

  // explain one anomaly (from the anomalies screen)
  if (q.startsWith("explain:") || q.startsWith("explique:")) {
    const wanted = q.slice(q.indexOf(":") + 1).trim();
    const a = anomalies.find((x) => wanted.startsWith(norm(anomalyTitle(x, lang)))) ?? anomalies[0];
    if (a) {
      const { suspects, other } = suspectsFor(a, machines);
      const parts = [
        `**${anomalyTitle(a, lang)}**`,
        anomalyEvidence(a, lang, fmt),
        pt ? "A curva sozinha não diz qual máquina foi. Cruzando com o cadastro (potência, horário, tipo) e com o que a equipe já confirmou antes:" : "The curve alone can't say which machine it was. Crossing it with the register (power, schedule, type) and what the team confirmed before:",
        ...suspects.map((s) => suspectLine(s, lang)),
        `- ${pt ? "Outras cargas" : "Other loads"}: ${pct(other)}`,
        a.annualizedCost > 0
          ? pt
            ? `Impacto estimado: **${fmt.money(a.annualizedCost)} por ano**.`
            : `Estimated impact: **${fmt.money(a.annualizedCost)} a year**.`
          : "",
      ].filter(Boolean);
      const action = confirmAction(a, ctx);
      return { text: parts.join("\n"), intent: "explain", actions: action ? [action] : undefined, source: "local" };
    }
  }

  // why did consumption change
  if (has(q, ["why", "por que", "porque", "subiu", "aumentou", "increase", "went up", "go up", "rise", "rose", "mudou", "changed"])) {
    const s = dailySeries(empresaId, 14);
    const sum = (xs: typeof s, k: "kwh" | "output") => xs.reduce((a, p) => a + p[k], 0);
    const change = ((sum(s.slice(7), "kwh") - sum(s.slice(0, 7), "kwh")) / sum(s.slice(0, 7), "kwh")) * 100;
    const outChange = ((sum(s.slice(7), "output") - sum(s.slice(0, 7), "output")) / Math.max(sum(s.slice(0, 7), "output"), 1)) * 100;
    const recent = anomalies.filter((a) => new Date(a.start).getTime() > Date.now() - 8 * 86400_000 && a.kind !== "demand_peak");
    const parts = [
      pt
        ? `Nos últimos 7 dias a fábrica consumiu **${fmt.energy(sum(s.slice(7), "kwh"))}**, ${fmt.pct(change)} em relação à semana anterior, enquanto a produção variou ${fmt.pct(outChange)}.`
        : `In the last 7 days the plant used **${fmt.energy(sum(s.slice(7), "kwh"))}**, ${fmt.pct(change)} vs. the week before, while output changed ${fmt.pct(outChange)}.`,
    ];
    if (recent.length) {
      parts.push(pt ? "O que explica a diferença:" : "What explains the gap:");
      for (const a of recent) parts.push(`- ${anomalyTitle(a, lang)}: ${fmt.energy(a.excessKwh)} (${culprit(a, ctx)})`);
    } else if (outChange > 0) {
      parts.push(pt ? "O aumento acompanha a produção: não vejo desperdício." : "The increase follows production: I see no waste.");
    }
    const next = recent.find((a) => !ticketOf(a, ctx));
    const action = next ? confirmAction(next, ctx) : undefined;
    return { text: parts.join("\n"), intent: "why", actions: action ? [action] : undefined, links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
  }

  // waste / savings
  if (has(q, ["waste", "wasting", "desperd", "save", "saving", "econom", "oportunidad", "opportunit", "perda", "loss", "vazando", "leak"])) {
    const list = anomalies.filter((a) => a.annualizedCost > 0);
    const total = list.reduce((a, x) => a + x.annualizedCost, 0);
    const k = kpis(empresaId);
    const parts = [
      pt
        ? `Encontrei **${list.length} vazamentos de dinheiro** que somam cerca de **${fmt.money(total)} por ano** (${fmt.num((total / (k.cost * 12)) * 100, 1)}% da conta).`
        : `I found **${list.length} money leaks** worth about **${fmt.money(total)} a year** (${fmt.num((total / (k.cost * 12)) * 100, 1)}% of the bill).`,
    ];
    for (const a of list) parts.push(`- ${anomalyTitle(a, lang)}: **${fmt.money(a.annualizedCost)}/${pt ? "ano" : "yr"}**, ${culprit(a, ctx)}`);
    const next = list.find((a) => !ticketOf(a, ctx));
    const action = next ? confirmAction(next, ctx) : undefined;
    return { text: parts.join("\n"), intent: "waste", actions: action ? [action] : undefined, links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
  }

  // forecast / peak
  if (has(q, ["forecast", "previs", "next week", "proxima semana", "proximos", "next 7", "peak", "pico", "demand", "demanda", "amanha", "tomorrow", "multa", "penalty"])) {
    const f = forecast(empresaId);
    const parts = [
      pt ? `Para os próximos 7 dias prevejo **${fmt.energy(f.kwhTotal)}** (≈ ${fmt.money(f.costTotal)}).` : `For the next 7 days I forecast **${fmt.energy(f.kwhTotal)}** (≈ ${fmt.money(f.costTotal)}).`,
      pt
        ? `Pico mais provável: **${fmt.num(f.peak.kw)} kW** em ${fmt.dateTime(f.peak.ts)}, podendo chegar a ${fmt.num(f.peak.high)} kW (${fmt.num(f.peakPct, 0)}% dos ${fmt.num(f.contractedKw)} kW contratados).`
        : `Most likely peak: **${fmt.num(f.peak.kw)} kW** on ${fmt.dateTime(f.peak.ts)}, possibly up to ${fmt.num(f.peak.high)} kW (${fmt.num(f.peakPct, 0)}% of the ${fmt.num(f.contractedKw)} kW contracted).`,
      f.peakPct > 90
        ? pt ? "Escalona a partida do forno nesse horário ou programa o BESS para descarregar." : "Stagger the furnace start-up in that window or schedule the BESS to discharge."
        : pt ? "Há folga em relação à demanda contratada." : "There is headroom against the contracted demand.",
    ];
    return { text: parts.join("\n"), intent: "forecast", links: [{ label: pt ? "Ver previsão" : "Open forecast", href: "/anomalies#forecast" }], source: "local" };
  }

  // which machine weighs most
  if (has(q, ["maquina", "machine", "equipamento", "equipment", "pesa", "weighs", "consome mais", "uses most", "quem gasta", "biggest"])) {
    const shares = estimatedShares(empresaId, machines).slice(0, 5);
    const parts = [
      ...shares.map((x) => `- **${x.machine.nome}**: ~${pct(x.share)} (${fmt.money(x.cost)}/${pt ? "mês" : "month"})`),
      pt
        ? "É uma estimativa pelo cadastro (potência × horário), ajustada ao total medido. Se quiser certeza numa máquina específica, um medidor nela fecha a dúvida."
        : "This is an estimate from the register (power × schedule), scaled to the measured total. For certainty on one machine, a meter on it settles it.",
    ];
    return { text: parts.join("\n"), intent: "machines", links: [{ label: pt ? "Ver máquinas" : "Open machines", href: "/maquinas" }], source: "local" };
  }

  // summary (greetings and anything else)
  const k = kpis(empresaId);
  const info = getPlant(empresaId)!;
  const parts = [
    pt
      ? `${info.plant.name}, últimos 30 dias: **${fmt.energy(k.kwh)}**, ${fmt.money(k.cost)}. Pico de ${fmt.num(k.peakKw)} kW (${fmt.num((k.peakKw / k.contractedKw) * 100, 0)}% do contratado). **${fmt.money(k.savingsAnnual)} por ano** em desperdício identificado.`
      : `${info.plant.name}, last 30 days: **${fmt.energy(k.kwh)}**, ${fmt.money(k.cost)}. Peak ${fmt.num(k.peakKw)} kW (${fmt.num((k.peakKw / k.contractedKw) * 100, 0)}% of contracted). **${fmt.money(k.savingsAnnual)} a year** of waste identified.`,
  ];
  const greetingQ = has(q, ["oi", "ola", "hello", "hi ", "hey", "fala", "bom dia", "boa tarde", "boa noite", "resumo", "summary", "como estamos", "how are we"]) || q.length < 4;
  return { text: parts.join("\n"), intent: greetingQ ? "greeting" : "unknown", source: "local" };
}

/** Compact context sent to an external model, so it reasons over the same numbers. */
export function copilotContext(ctx: CopilotCtx) {
  const info = getPlant(ctx.empresaId)!;
  return {
    plant: { name: info.plant.name, country: info.plant.country, contractedKw: info.plant.contractedKw },
    currency: info.region.currency,
    tariffPerKwh: info.region.tariffPerKwh,
    kpis30d: kpis(ctx.empresaId),
    anomalies: detectAnomalies(ctx.empresaId).map(({ slots: _s, ...a }) => ({
      ...a,
      suspects: suspectsFor(a as Anomaly, ctx.machines).suspects.map((s) => ({ machine: s.machine.nome, probability: Math.round(s.probability * 100) })),
    })),
    forecast7d: (({ points: _p, ...rest }) => rest)(forecast(ctx.empresaId)),
  };
}

export async function ask(question: string, ctx: CopilotCtx): Promise<CopilotAnswer> {
  const url = import.meta.env.VITE_COPILOT_URL as string | undefined;
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          lang: ctx.lang,
          persona:
            "You are Faísca, EFFIO's energy agent for industrial plants. Sharp and direct: one short line of attitude, then the numbers. You only see the whole-plant curve, so name machine suspects with probabilities, never certainty, and offer to ask the sector to confirm. Never invent figures.",
          context: copilotContext(ctx),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.answer === "string") return { text: data.answer, source: "remote" };
      }
    } catch {
      /* fall back to the local engine */
    }
  }
  return voice(localAnswer(question, ctx), question, ctx.lang);
}
