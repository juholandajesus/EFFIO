/**
 * EFFIO industrial engine (demo data layer).
 *
 * 1. Simulates 60 days of hourly sub-metered energy per line plus the ERP work
 *    orders that produced the output, for each demo plant.
 * 2. Runs the analytics on top of it: specific energy per product (kWh/unit),
 *    cost and carbon per unit, anomaly detection against a 4-week baseline,
 *    a 7-day load forecast and savings estimates.
 *
 * The analytics only read the simulated meter and ERP data, never the injected
 * anomaly list, so the same functions work unchanged on real data.
 */
import { plantFor, type L, type LineDef, type PlantDef, type ProductDef } from "./plants";
import { REGIONS, type Region } from "./regions";

export const DAYS = 60;
const BASELINE_FROM = 18; // baseline window: days 18..45
const BASELINE_TO = 45;
const EVAL_FROM = 46; // evaluation window: last 14 days

// ───────────────────────── helpers ─────────────────────────

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function median(xs: number[]) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const mu = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1));
}

export function dayDate(i: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (DAYS - i));
  return d;
}

export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ───────────────────────── simulation ─────────────────────────

export interface WorkOrder {
  id: string;
  dayIndex: number;
  date: string;
  lineId: string;
  sku: string;
  plannedQty: number;
  producedQty: number;
  scrapQty: number;
  status: "completed" | "in_progress" | "planned";
  kwh: number; // energy allocated to the order (direct + idle share)
}

interface Sim {
  plant: PlantDef;
  region: Region;
  /** kW per line, index = day*24 + hour */
  load: Record<string, number[]>;
  /** units produced per day per line per sku */
  output: Record<string, Record<string, number[]>>;
  runningHours: Record<string, number[]>;
  orders: WorkOrder[];
  plannedOrders: WorkOrder[];
}

const cache = new Map<number, Sim>();

function isWorkday(region: Region, d: Date) {
  return !region.weekend.includes(d.getDay());
}

function lineRuns(line: LineDef, region: Region, d: Date, h: number) {
  if (!line.runsWeekends && !isWorkday(region, d)) return false;
  return h >= line.hours[0] && h < line.hours[1];
}

/** Product a line runs on a given day (simple rotation, like an ERP schedule). */
function productOfDay(line: LineDef, dayIndex: number): ProductDef | null {
  if (!line.products.length) return null;
  return line.products[Math.floor(dayIndex / 2) % line.products.length];
}

function simulate(plant: PlantDef): Sim {
  const region = REGIONS[plant.country];
  const rand = rng(plant.empresaId * 7919);
  const load: Sim["load"] = {};
  const output: Sim["output"] = {};
  const runningHours: Sim["runningHours"] = {};

  // weekend days (non-working) in the last 7 days, used by "idle_hold" without explicit days
  const lastWeekend: number[] = [];
  for (let i = DAYS - 7; i < DAYS; i++) if (!isWorkday(region, dayDate(i))) lastWeekend.push(i);

  for (const line of plant.lines) {
    const arr = new Array(DAYS * 24).fill(0);
    const out: Record<string, number[]> = {};
    for (const p of line.products) out[p.sku] = new Array(DAYS).fill(0);
    const rh = new Array(DAYS).fill(0);

    const drift = plant.anomalies.find((a) => a.type === "sec_drift" && a.lineId === line.id) as
      | Extract<PlantDef["anomalies"][number], { type: "sec_drift" }>
      | undefined;
    const baseload = plant.anomalies.find((a) => a.type === "baseload" && a.lineId === line.id) as
      | Extract<PlantDef["anomalies"][number], { type: "baseload" }>
      | undefined;
    const hold = plant.anomalies.find((a) => a.type === "idle_hold" && a.lineId === line.id) as
      | Extract<PlantDef["anomalies"][number], { type: "idle_hold" }>
      | undefined;
    const holdDays = hold ? (hold.daysAgo.length ? hold.daysAgo.map((n) => DAYS - n) : lastWeekend) : [];

    for (let i = 0; i < DAYS; i++) {
      const d = dayDate(i);
      const product = productOfDay(line, i);
      const dayNoise = 0.95 + rand() * 0.1;
      // scheduled stop: a maintenance day planned in the ERP (no production)
      const maintenanceStop = hold && hold.daysAgo.length > 0 && holdDays.includes(i);
      for (let h = 0; h < 24; h++) {
        const noise = 0.93 + rand() * 0.14;
        let kw: number;
        const running = lineRuns(line, region, d, h) && !maintenanceStop;
        if (line.kind === "utility") {
          const active = lineRuns(line, region, d, h) && isWorkday(region, d);
          kw = (active ? line.runKw : line.idleKw) * noise;
        } else if (running) {
          kw = line.runKw * noise * dayNoise;
          rh[i] += 1;
          if (product) {
            let rate = product.ratePerHour * (0.94 + rand() * 0.1);
            if (drift && i >= DAYS - drift.fromDaysAgo) rate *= 1 - drift.rateLoss;
            out[product.sku][i] += rate;
          }
        } else {
          kw = line.idleKw * noise;
        }
        if (baseload && i >= DAYS - baseload.fromDaysAgo) kw += line.runKw * baseload.extraKwFraction;
        if (hold && holdDays.includes(i) && !running) kw = line.runKw * hold.holdFraction * noise;
        arr[i * 24 + h] = kw;
      }
    }
    load[line.id] = arr;
    output[line.id] = out;
    runningHours[line.id] = rh;
  }

  // demand peak: push the site load close to the contracted limit for a few hours
  for (const a of plant.anomalies) {
    if (a.type !== "demand_peak") continue;
    const i = DAYS - a.daysAgo;
    for (let h = a.hours[0]; h < a.hours[1]; h++) {
      const total = plant.lines.reduce((s, l) => s + load[l.id][i * 24 + h], 0);
      const target = plant.contractedKw * (a.targetFraction - 0.01 + (h - a.hours[0]) * 0.01);
      if (target > total) load[a.lineId][i * 24 + h] += target - total;
    }
  }

  // ERP work orders: one per line per production day
  const orders: WorkOrder[] = [];
  let seq = 24000 + plant.empresaId * 1000;
  for (const line of plant.lines) {
    if (line.kind !== "production") continue;
    for (let i = 0; i < DAYS; i++) {
      const product = productOfDay(line, i);
      if (!product) continue;
      const produced = output[line.id][product.sku][i];
      const kwh = load[line.id].slice(i * 24, i * 24 + 24).reduce((s, x) => s + x, 0);
      const planned = product.ratePerHour * (line.hours[1] - line.hours[0]);
      const isStop = runningHours[line.id][i] === 0;
      if (isStop && !lineRuns(line, region, dayDate(i), line.hours[0])) continue; // non-working day
      orders.push({
        id: `WO-${seq++}`,
        dayIndex: i,
        date: isoDay(dayDate(i)),
        lineId: line.id,
        sku: product.sku,
        plannedQty: isStop ? 0 : round(planned, 2),
        producedQty: round(produced, 2),
        scrapQty: round(produced * (0.015 + rand() * 0.02), 2),
        status: "completed",
        kwh: round(kwh, 1),
      });
    }
  }

  // planned orders for the next 7 days (feed the forecast)
  const plannedOrders: WorkOrder[] = [];
  for (let k = 0; k < 7; k++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + k);
    for (const line of plant.lines) {
      if (line.kind !== "production") continue;
      if (!line.runsWeekends && !isWorkday(region, d)) continue;
      const product = productOfDay(line, DAYS + k);
      if (!product) continue;
      plannedOrders.push({
        id: `WO-${seq++}`,
        dayIndex: DAYS + k,
        date: isoDay(d),
        lineId: line.id,
        sku: product.sku,
        plannedQty: round(product.ratePerHour * (line.hours[1] - line.hours[0]), 2),
        producedQty: 0,
        scrapQty: 0,
        status: k === 0 ? "in_progress" : "planned",
        kwh: 0,
      });
    }
  }

  return { plant, region, load, output, runningHours, orders, plannedOrders };
}

function round(n: number, d = 2) {
  return Number(n.toFixed(d));
}

function sim(empresaId: number | null | undefined): Sim | null {
  const plant = plantFor(empresaId);
  if (!plant) return null;
  let s = cache.get(plant.empresaId);
  if (!s) {
    s = simulate(plant);
    cache.set(plant.empresaId, s);
  }
  return s;
}

// ───────────────────────── public API ─────────────────────────

export function hasPlant(empresaId: number | null | undefined) {
  return plantFor(empresaId) !== null;
}

export function getPlant(empresaId: number | null | undefined) {
  const s = sim(empresaId);
  return s ? { plant: s.plant, region: s.region } : null;
}

export interface DayPoint {
  date: string;
  kwh: number;
  cost: number;
  co2Kg: number;
  output: number; // total tonnes-equivalent of the main products (for the energy × output chart)
  peakKw: number;
}

export function dailySeries(empresaId: number, days = 30): DayPoint[] {
  const s = sim(empresaId)!;
  const pts: DayPoint[] = [];
  const main = mainProductLine(s);
  for (let i = DAYS - days; i < DAYS; i++) {
    let kwh = 0;
    let peak = 0;
    for (let h = 0; h < 24; h++) {
      let site = 0;
      for (const l of s.plant.lines) site += s.load[l.id][i * 24 + h];
      kwh += site;
      peak = Math.max(peak, site);
    }
    const out = main ? Object.values(s.output[main.id]).reduce((a, arr) => a + arr[i], 0) : 0;
    pts.push({
      date: isoDay(dayDate(i)),
      kwh: round(kwh, 0),
      cost: round(kwh * s.region.tariffPerKwh, 2),
      co2Kg: round(kwh * s.region.gridFactorKgPerKwh * (1 - s.plant.renewableShare), 0),
      output: round(out, 1),
      peakKw: round(peak, 0),
    });
  }
  return pts;
}

function mainProductLine(s: Sim) {
  return [...s.plant.lines].filter((l) => l.kind === "production").sort((a, b) => b.runKw - a.runKw)[0];
}

export interface ProductStat {
  sku: string;
  name: L;
  unit: L;
  lineIds: string[];
  units: number;
  kwhDirect: number;
  kwhLoaded: number; // + share of utilities
  kwhPerUnit: number; // fully loaded
  baselineKwhPerUnit: number;
  driftPct: number; // last 7 days vs baseline
  costPerUnit: number;
  co2PerUnit: number; // kg
  bestKwhPerUnit: number; // best day in the period (benchmark)
}

/** Energy per product over the last `days` days, utilities allocated by direct energy share. */
export function productStats(empresaId: number, days = 30): ProductStat[] {
  const s = sim(empresaId)!;
  const from = DAYS - days;
  const prodLines = s.plant.lines.filter((l) => l.kind === "production");
  const utilLines = s.plant.lines.filter((l) => l.kind === "utility");

  const lineDayKwh = (lineId: string, i: number) => s.load[lineId].slice(i * 24, i * 24 + 24).reduce((a, b) => a + b, 0);

  // utilities share per day, distributed by direct energy
  const utilShare: Record<string, number[]> = {};
  for (const l of prodLines) utilShare[l.id] = new Array(DAYS).fill(0);
  for (let i = 0; i < DAYS; i++) {
    const util = utilLines.reduce((a, l) => a + lineDayKwh(l.id, i), 0);
    const direct = prodLines.map((l) => lineDayKwh(l.id, i));
    const tot = direct.reduce((a, b) => a + b, 0) || 1;
    prodLines.forEach((l, k) => (utilShare[l.id][i] = (util * direct[k]) / tot));
  }

  const map = new Map<string, ProductStat & { _daily: { units: number; kwh: number; i: number }[] }>();
  for (const l of prodLines) {
    for (let i = 0; i < DAYS; i++) {
      const p = productOfDay(l, i);
      if (!p) continue;
      const units = s.output[l.id][p.sku][i];
      const kwhD = lineDayKwh(l.id, i);
      const kwhL = kwhD + utilShare[l.id][i];
      let st = map.get(p.sku);
      if (!st) {
        st = {
          sku: p.sku, name: p.name, unit: p.unit, lineIds: [], units: 0, kwhDirect: 0, kwhLoaded: 0,
          kwhPerUnit: 0, baselineKwhPerUnit: 0, driftPct: 0, costPerUnit: 0, co2PerUnit: 0, bestKwhPerUnit: 0, _daily: [],
        };
        map.set(p.sku, st);
      }
      if (!st.lineIds.includes(l.id)) st.lineIds.push(l.id);
      st._daily.push({ units, kwh: kwhD, i });
      if (i >= from) {
        st.units += units;
        st.kwhDirect += kwhD;
        st.kwhLoaded += kwhL;
      }
    }
  }

  return [...map.values()].map(({ _daily, ...st }) => {
    const sec = (rows: typeof _daily) => {
      const u = rows.reduce((a, r) => a + r.units, 0);
      return u ? rows.reduce((a, r) => a + r.kwh, 0) / u : 0;
    };
    const base = sec(_daily.filter((r) => r.i >= BASELINE_FROM && r.i <= BASELINE_TO && r.units > 0));
    const recent = sec(_daily.filter((r) => r.i >= DAYS - 7 && r.units > 0));
    const perDay = _daily.filter((r) => r.i >= from && r.units > 0).map((r) => r.kwh / r.units);
    const kpu = st.units ? st.kwhLoaded / st.units : 0;
    return {
      ...st,
      units: round(st.units, 1),
      kwhDirect: round(st.kwhDirect, 0),
      kwhLoaded: round(st.kwhLoaded, 0),
      kwhPerUnit: round(kpu, 1),
      baselineKwhPerUnit: round(base, 1),
      driftPct: base ? round(((recent - base) / base) * 100, 1) : 0,
      costPerUnit: round(kpu * s.region.tariffPerKwh, 3),
      co2PerUnit: round(kpu * s.region.gridFactorKgPerKwh * (1 - s.plant.renewableShare), 1),
      bestKwhPerUnit: round(perDay.length ? Math.min(...perDay) : 0, 1),
    };
  });
}

export interface LineStat {
  id: string;
  name: L;
  kind: LineDef["kind"];
  kwh: number;
  sharePct: number;
  idleKwh: number; // energy spent while not producing
  idlePct: number;
  runningHours: number;
}

export function lineStats(empresaId: number, days = 30): LineStat[] {
  const s = sim(empresaId)!;
  const from = DAYS - days;
  const rows = s.plant.lines.map((l) => {
    let kwh = 0;
    let idle = 0;
    for (let i = from; i < DAYS; i++) {
      const d = dayDate(i);
      for (let h = 0; h < 24; h++) {
        const v = s.load[l.id][i * 24 + h];
        kwh += v;
        const producing = l.kind === "production" ? lineRuns(l, s.region, d, h) && s.runningHours[l.id][i] > 0 : lineRuns(l, s.region, d, h) && isWorkday(s.region, d);
        if (!producing) idle += v;
      }
    }
    return { id: l.id, name: l.name, kind: l.kind, kwh, idleKwh: idle, runningHours: s.runningHours[l.id].slice(from).reduce((a, b) => a + b, 0) };
  });
  const tot = rows.reduce((a, r) => a + r.kwh, 0) || 1;
  return rows.map((r) => ({
    ...r,
    kwh: round(r.kwh, 0),
    idleKwh: round(r.idleKwh, 0),
    sharePct: round((r.kwh / tot) * 100, 1),
    idlePct: r.kwh ? round((r.idleKwh / r.kwh) * 100, 1) : 0,
  }));
}

export function productName(empresaId: number, sku: string): { name: L; unit: L } | null {
  const s = sim(empresaId)!;
  for (const l of s.plant.lines) for (const p of l.products) if (p.sku === sku) return { name: p.name, unit: p.unit };
  return null;
}

export function lineName(empresaId: number, lineId: string): L {
  const s = sim(empresaId)!;
  return s.plant.lines.find((l) => l.id === lineId)?.name ?? { en: lineId, pt: lineId };
}

// ───────────────────────── anomalies ─────────────────────────

export type AnomalyKind = "baseload" | "excess" | "idle_running" | "demand_peak" | "sec_drift";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: "high" | "medium" | "low";
  lineId: string;
  sku?: string;
  start: string; // ISO datetime
  end: string;
  hours: number;
  ongoing: boolean;
  excessKwh: number;
  excessCost: number;
  annualizedCost: number;
  /** extra numbers for the explanation */
  ratio?: number;
  peakKw?: number;
  peakPct?: number;
  driftPct?: number;
}

function addHours(iso: string, h: number) {
  return new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
}

function hourIso(idx: number) {
  const i = Math.floor(idx / 24);
  const d = dayDate(i);
  d.setHours(idx % 24);
  return d.toISOString();
}

export function detectAnomalies(empresaId: number): Anomaly[] {
  const s = sim(empresaId)!;
  const out: Anomaly[] = [];
  const tariff = s.region.tariffPerKwh;

  // 1) hour-level excess vs. baseline (same hour, same day type) while producing / for utilities
  // 4) energy drawn while the ERP shows the line was NOT producing
  for (const l of s.plant.lines) {
    const producingAt = (i: number, h: number) =>
      l.kind === "production" && s.runningHours[l.id][i] > 0 && lineRuns(l, s.region, dayDate(i), h);
    const base: Record<string, number> = {};
    const idleVals: number[] = [];
    for (const wd of [true, false]) {
      for (let h = 0; h < 24; h++) {
        const vals: number[] = [];
        for (let i = BASELINE_FROM; i <= BASELINE_TO; i++) {
          if (isWorkday(s.region, dayDate(i)) === wd) vals.push(s.load[l.id][i * 24 + h]);
        }
        base[`${wd}-${h}`] = median(vals);
      }
    }
    for (let i = BASELINE_FROM; i <= BASELINE_TO; i++)
      for (let h = 0; h < 24; h++) if (l.kind === "production" && !producingAt(i, h)) idleVals.push(s.load[l.id][i * 24 + h]);
    // standby reference: measured idle load, or the rated standby load from the asset register
    const idleRef = idleVals.length > 24 ? median(idleVals) : l.idleKw;

    type Flag = { idx: number; excess: number; ratio: number };
    const excessFlags: Flag[] = [];
    const idleFlags: Flag[] = [];
    for (let i = EVAL_FROM; i < DAYS; i++) {
      const wd = isWorkday(s.region, dayDate(i));
      for (let h = 0; h < 24; h++) {
        const v = s.load[l.id][i * 24 + h];
        if (l.kind === "production" && !producingAt(i, h)) {
          if (v > Math.max(2 * idleRef, idleRef + 0.15 * l.runKw)) idleFlags.push({ idx: i * 24 + h, excess: v - idleRef, ratio: v / (idleRef || 1) });
          continue;
        }
        const b = base[`${wd}-${h}`];
        if (v > b * 1.12 && v - b > 0.14 * l.runKw) excessFlags.push({ idx: i * 24 + h, excess: v - b, ratio: v / (b || 1) });
      }
    }

    const emit = (group: Flag[], kind: AnomalyKind) => {
      if (group.length < 3) return;
      const first = group[0].idx;
      const last = group[group.length - 1].idx;
      const excess = group.reduce((a, g) => a + g.excess, 0);
      const ongoing = last >= DAYS * 24 - 3;
      const spanDays = (last - first + 1) / 24;
      const cost = excess * tariff;
      out.push({
        id: `${kind}-${l.id}-${first}`,
        kind,
        severity: cost > 1500 * scaleOf(s) || (ongoing && spanDays >= 2) ? "high" : cost > 300 * scaleOf(s) ? "medium" : "low",
        lineId: l.id,
        start: hourIso(first),
        end: hourIso(last + 1),
        hours: group.length,
        ongoing,
        excessKwh: round(excess, 0),
        excessCost: round(cost, 2),
        // ongoing problems: daily excess × 365; one-off events: assume it repeats monthly
        annualizedCost: round(ongoing ? (excess / Math.max(spanDays, 1)) * 365 * tariff : cost * 12, 0),
        ratio: round(median(group.map((g) => g.ratio)), 2),
      });
    };
    const groupRuns = (flags: Flag[], kind: AnomalyKind, maxGap: number) => {
      let g: Flag[] = [];
      for (const f of flags) {
        if (g.length && f.idx - g[g.length - 1].idx > maxGap) {
          emit(g, kind);
          g = [];
        }
        g.push(f);
      }
      emit(g, kind);
    };
    groupRuns(excessFlags, l.kind === "utility" ? "baseload" : "excess", 4);
    groupRuns(idleFlags, "idle_running", 4);
  }

  // 2) demand peaks above 90% of contracted demand
  for (let i = EVAL_FROM; i < DAYS; i++) {
    let peak = 0;
    let peakH = 0;
    const hoursAbove: number[] = [];
    for (let h = 0; h < 24; h++) {
      const site = s.plant.lines.reduce((a, l) => a + s.load[l.id][i * 24 + h], 0);
      if (site > peak) [peak, peakH] = [site, h];
      if (site > s.plant.contractedKw * 0.9) hoursAbove.push(h);
    }
    if (hoursAbove.length) {
      // the line that rose the most at the peak hour vs. its own baseline is the likely driver
      let driver = s.plant.lines[0].id;
      let best = -Infinity;
      for (const l of s.plant.lines) {
        const v = s.load[l.id][i * 24 + peakH];
        const ref = median(Array.from({ length: BASELINE_TO - BASELINE_FROM + 1 }, (_, k) => s.load[l.id][(BASELINE_FROM + k) * 24 + peakH]));
        if (v - ref > best) [best, driver] = [v - ref, l.id];
      }
      const start = i * 24 + hoursAbove[0];
      out.push({
        id: `peak-${i}`,
        kind: "demand_peak",
        severity: peak > s.plant.contractedKw * 0.95 ? "high" : "medium",
        lineId: driver,
        start: hourIso(start),
        end: hourIso(i * 24 + hoursAbove[hoursAbove.length - 1] + 1),
        hours: hoursAbove.length,
        ongoing: false,
        excessKwh: round(Math.max(best, 0) * hoursAbove.length, 0),
        excessCost: 0,
        annualizedCost: 0,
        peakKw: round(peak, 0),
        peakPct: round((peak / s.plant.contractedKw) * 100, 1),
      });
    }
  }

  // 3) specific energy drift per product
  for (const p of productStats(empresaId, 30)) {
    if (p.driftPct < 6) continue;
    const recentUnits7 = productStats(empresaId, 7).find((x) => x.sku === p.sku)?.units ?? 0;
    const extraPerUnit = p.baselineKwhPerUnit * (p.driftPct / 100);
    const excess = extraPerUnit * recentUnits7;
    out.push({
      id: `sec-${p.sku}`,
      kind: "sec_drift",
      severity: p.driftPct > 10 ? "high" : "medium",
      lineId: p.lineIds[p.lineIds.length - 1],
      sku: p.sku,
      start: hourIso((DAYS - 7) * 24),
      end: hourIso(DAYS * 24),
      hours: 7 * 24,
      ongoing: true,
      excessKwh: round(excess, 0),
      excessCost: round(excess * tariff, 2),
      annualizedCost: round((excess / 7) * 300 * tariff, 0),
      driftPct: p.driftPct,
    });
  }

  const peaks = out.filter((a) => a.kind === "demand_peak");
  const filtered = out.filter(
    (a) => a.kind !== "excess" || !peaks.some((p) => a.start >= p.start && a.end <= addHours(p.end, 1) || (a.start <= p.end && a.end >= p.start && a.hours <= 6)),
  );
  const rank = { high: 0, medium: 1, low: 2 };
  return filtered.sort((a, b) => rank[a.severity] - rank[b.severity] || b.annualizedCost - a.annualizedCost);
}

/** rough plant size factor so severity thresholds scale with the plant */
function scaleOf(s: Sim) {
  return (s.plant.contractedKw / 3000) * (s.region.tariffPerKwh / 0.3);
}

// ───────────────────────── forecast ─────────────────────────

export interface ForecastPoint {
  ts: string; // ISO hour
  label: string;
  kw: number;
  low: number;
  high: number;
}

export function forecast(empresaId: number, days = 7) {
  const s = sim(empresaId)!;
  const pts: ForecastPoint[] = [];
  const histFrom = DAYS - 28;
  // planned production per line per future day (0 = no order → line stays idle)
  const plannedByDay = new Map<string, boolean>();
  for (const o of s.plannedOrders) plannedByDay.set(`${o.dayIndex}-${o.lineId}`, true);

  for (let k = 0; k < days; k++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + k);
    const wd = isWorkday(s.region, d);
    for (let h = 0; h < 24; h++) {
      let mu = 0;
      let varSum = 0;
      for (const l of s.plant.lines) {
        const vals: number[] = [];
        for (let i = histFrom; i < DAYS; i++) {
          if (isWorkday(s.region, dayDate(i)) !== wd) continue;
          if (l.kind === "production" && s.runningHours[l.id][i] === 0 && lineRuns(l, s.region, dayDate(i), l.hours[0])) continue; // skip maintenance days
          vals.push(s.load[l.id][i * 24 + h]);
        }
        let m = median(vals);
        if (l.kind === "production" && !plannedByDay.get(`${DAYS + k}-${l.id}`) && lineRuns(l, s.region, d, h)) m = l.idleKw;
        mu += m;
        varSum += std(vals) ** 2;
      }
      const sd = Math.sqrt(varSum) * 1.3;
      const ts = new Date(d);
      ts.setHours(h);
      pts.push({ ts: ts.toISOString(), label: "", kw: round(mu, 0), low: round(Math.max(mu - 1.5 * sd, 0), 0), high: round(mu + 1.5 * sd, 0) });
    }
  }
  const peak = pts.reduce((a, p) => (p.high > a.high ? p : a), pts[0]);
  const kwhTotal = pts.reduce((a, p) => a + p.kw, 0);
  return {
    points: pts,
    peak,
    peakPct: round((peak.high / s.plant.contractedKw) * 100, 1),
    kwhTotal: round(kwhTotal, 0),
    costTotal: round(kwhTotal * s.region.tariffPerKwh, 2),
    contractedKw: s.plant.contractedKw,
  };
}

// ───────────────────────── summary ─────────────────────────

export function kpis(empresaId: number, days = 30) {
  const s = sim(empresaId)!;
  const series = dailySeries(empresaId, days);
  const prev = dailySeries(empresaId, days * 2).slice(0, days);
  const sum = (xs: DayPoint[], k: keyof DayPoint) => xs.reduce((a, p) => a + (p[k] as number), 0);
  const kwh = sum(series, "kwh");
  const kwhPrev = sum(prev, "kwh");
  const anomalies = detectAnomalies(empresaId);
  const products = productStats(empresaId, days);
  const totalUnits = products.reduce((a, p) => a + p.units, 0);
  const lines = lineStats(empresaId, days);
  return {
    kwh,
    kwhChangePct: kwhPrev ? round(((kwh - kwhPrev) / kwhPrev) * 100, 1) : 0,
    cost: round(kwh * s.region.tariffPerKwh, 2),
    co2Tonnes: round(sum(series, "co2Kg") / 1000, 1),
    peakKw: Math.max(...series.map((p) => p.peakKw)),
    contractedKw: s.plant.contractedKw,
    savingsAnnual: round(anomalies.reduce((a, x) => a + x.annualizedCost, 0), 0),
    openAnomalies: anomalies.length,
    totalUnits,
    idleKwh: lines.reduce((a, l) => a + l.idleKwh, 0),
    idlePct: round((lines.reduce((a, l) => a + l.idleKwh, 0) / (kwh || 1)) * 100, 1),
  };
}

/** Whole-site load (kW) for each hour of the last `days` days, oldest first. */
export function siteHourly(empresaId: number, days = 14) {
  const s = sim(empresaId)!;
  const out: { ts: string; kw: number }[] = [];
  for (let i = DAYS - days; i < DAYS; i++) {
    for (let h = 0; h < 24; h++) {
      const d = dayDate(i);
      d.setHours(h);
      out.push({ ts: d.toISOString(), kw: s.plant.lines.reduce((a, l) => a + s.load[l.id][i * 24 + h], 0) });
    }
  }
  return out;
}
