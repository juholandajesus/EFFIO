/**
 * EFFIO energy engine (demo data layer).
 *
 * 1. Simulates 60 days of a plant's real behaviour, line by line, so the demo
 *    has something true underneath.
 * 2. The analytics only see what a client would hand us: the WHOLE-SITE hourly
 *    curve (the CCEE / utility CSV). They never read per-line data or the list
 *    of injected anomalies. Which machine caused a problem is estimated
 *    separately, from the machine register (see attribution.ts).
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


// ───────────────────────── whole-site curve (what the CSV gives us) ─────────────────────────

function siteSeries(s: Sim): number[] {
  const out = new Array(DAYS * 24).fill(0);
  for (const l of s.plant.lines) for (let k = 0; k < out.length; k++) out[k] += s.load[l.id][k];
  return out;
}

const siteCache = new Map<number, number[]>();
function site(s: Sim) {
  let v = siteCache.get(s.plant.empresaId);
  if (!v) {
    v = siteSeries(s);
    siteCache.set(s.plant.empresaId, v);
  }
  return v;
}

/** Whole-site load (kW) for each hour of the last `days` days, oldest first. */
export function siteHourly(empresaId: number, days = 14) {
  const s = sim(empresaId)!;
  const v = site(s);
  const out: { ts: string; kw: number }[] = [];
  for (let i = DAYS - days; i < DAYS; i++) {
    for (let h = 0; h < 24; h++) {
      const d = dayDate(i);
      d.setHours(h);
      out.push({ ts: d.toISOString(), kw: v[i * 24 + h] });
    }
  }
  return out;
}

// ───────────────────────── anomalies ─────────────────────────

export type AnomalyKind = "baseload" | "off_hours" | "excess" | "demand_peak";

export interface Slot {
  dow: number; // 0 = Sunday
  hour: number;
}

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: "high" | "medium" | "low";
  start: string; // ISO datetime
  end: string;
  hours: number; // hours flagged
  ongoing: boolean;
  /** median extra load while it happened (kW above the plant's own pattern) */
  excessKw: number;
  excessKwh: number;
  excessCost: number;
  annualizedCost: number;
  /** when it happened, used to match the machine register */
  slots: Slot[];
  ratio?: number;
  peakKw?: number;
  peakPct?: number;
}

function hourIso(idx: number) {
  const i = Math.floor(idx / 24);
  const d = dayDate(i);
  d.setHours(idx % 24);
  return d.toISOString();
}

function slotOf(idx: number): Slot {
  return { dow: dayDate(Math.floor(idx / 24)).getDay(), hour: idx % 24 };
}

/** rough plant size factor so severity thresholds scale with the plant */
function scaleOf(s: Sim) {
  return (s.plant.contractedKw / 3000) * (s.region.tariffPerKwh / 0.3);
}

const anomalyCache = new Map<number, Anomaly[]>();

export function detectAnomalies(empresaId: number): Anomaly[] {
  const cached = anomalyCache.get(empresaId);
  if (cached) return cached;
  const s = sim(empresaId)!;
  const v = site(s);
  const tariff = s.region.tariffPerKwh;
  const contracted = s.plant.contractedKw;
  const out: Anomaly[] = [];

  // the plant's own pattern: median of the same hour on the same type of day, 4 weeks before
  const base: Record<string, number> = {};
  for (const wd of [true, false]) {
    for (let h = 0; h < 24; h++) {
      const vals: number[] = [];
      for (let i = BASELINE_FROM; i <= BASELINE_TO; i++) if (isWorkday(s.region, dayDate(i)) === wd) vals.push(v[i * 24 + h]);
      base[`${wd}-${h}`] = median(vals);
    }
  }
  const maxBase = Math.max(...Object.values(base));
  // hours when the plant is normally not producing (nights, weekends)
  const isOff = (wd: boolean, h: number) => base[`${wd}-${h}`] < 0.45 * maxBase;

  type Flag = { idx: number; excess: number; ratio: number };
  const off: Flag[] = [];
  const on: Flag[] = [];
  for (let i = EVAL_FROM; i < DAYS; i++) {
    const wd = isWorkday(s.region, dayDate(i));
    for (let h = 0; h < 24; h++) {
      const x = v[i * 24 + h];
      const b = base[`${wd}-${h}`];
      if (x > b * 1.15 && x - b > 0.025 * contracted) (isOff(wd, h) ? off : on).push({ idx: i * 24 + h, excess: x - b, ratio: x / (b || 1) });
    }
  }

  const emit = (g: Flag[], kind: AnomalyKind) => {
    const first = g[0].idx;
    const last = g[g.length - 1].idx;
    const excess = g.reduce((a, f) => a + f.excess, 0);
    const ongoing = last >= DAYS * 24 - 3;
    const spanDays = (last - first + 1) / 24;
    const cost = excess * tariff;
    out.push({
      id: `${kind}-${first}`,
      kind,
      severity: cost > 1500 * scaleOf(s) || (ongoing && spanDays >= 1.5) ? "high" : cost > 300 * scaleOf(s) ? "medium" : "low",
      start: hourIso(first),
      end: hourIso(last + 1),
      hours: g.length,
      ongoing,
      excessKw: round(median(g.map((f) => f.excess)), 0),
      excessKwh: round(excess, 0),
      excessCost: round(cost, 2),
      // ongoing: daily excess × 365; one-off: assume it repeats monthly
      annualizedCost: round(ongoing ? (excess / Math.max(spanDays, 1)) * 365 * tariff : cost * 12, 0),
      slots: g.map((f) => slotOf(f.idx)),
      ratio: round(median(g.map((f) => f.ratio)), 2),
    });
  };
  const group = (flags: Flag[], maxGap: number, minLen: number, classify: (g: Flag[]) => AnomalyKind) => {
    let g: Flag[] = [];
    const flush = () => g.length >= minLen && emit(g, classify(g));
    for (const f of flags) {
      if (g.length && f.idx - g[g.length - 1].idx > maxGap) {
        flush();
        g = [];
      }
      g.push(f);
    }
    flush();
  };
  // off-hours: a problem that comes back every night is a baseload creep (leak, setpoint);
  // one continuous block while the plant is stopped is equipment left on
  group(off, 20, 3, (g) => {
    const span = g[g.length - 1].idx - g[0].idx + 1;
    return span >= 36 && g.length / span < 0.7 ? "baseload" : "off_hours";
  });
  group(on, 3, 2, () => "excess");

  // demand peaks above 90% of contracted demand
  for (let i = EVAL_FROM; i < DAYS; i++) {
    const above: number[] = [];
    let peak = 0;
    for (let h = 0; h < 24; h++) {
      const x = v[i * 24 + h];
      peak = Math.max(peak, x);
      if (x > contracted * 0.9) above.push(h);
    }
    if (!above.length) continue;
    const wd = isWorkday(s.region, dayDate(i));
    const excess = above.map((h) => v[i * 24 + h] - base[`${wd}-${h}`]);
    out.push({
      id: `peak-${i}`,
      kind: "demand_peak",
      severity: peak > contracted * 0.95 ? "high" : "medium",
      start: hourIso(i * 24 + above[0]),
      end: hourIso(i * 24 + above[above.length - 1] + 1),
      hours: above.length,
      ongoing: false,
      excessKw: round(median(excess), 0),
      excessKwh: round(excess.reduce((a, b) => a + Math.max(b, 0), 0), 0),
      excessCost: 0,
      annualizedCost: 0,
      slots: above.map((h) => slotOf(i * 24 + h)),
      peakKw: round(peak, 0),
      peakPct: round((peak / contracted) * 100, 1),
    });
  }

  // a production-hours excess that is just the demand peak is reported once, as the peak
  const peaks = out.filter((a) => a.kind === "demand_peak");
  const result = out
    .filter((a) => a.kind !== "excess" || !peaks.some((p) => a.start < p.end && a.end > p.start))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity] || b.annualizedCost - a.annualizedCost);
  anomalyCache.set(empresaId, result);
  return result;
}

// ───────────────────────── forecast ─────────────────────────

export interface ForecastPoint {
  ts: string;
  kw: number;
  low: number;
  high: number;
}

/** Next days' load from the plant's own pattern: same hour, same type of day, last 4 weeks. */
export function forecast(empresaId: number, days = 7) {
  const s = sim(empresaId)!;
  const v = site(s);
  const pts: ForecastPoint[] = [];
  for (let k = 0; k < days; k++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + k);
    const wd = isWorkday(s.region, d);
    for (let h = 0; h < 24; h++) {
      const vals: number[] = [];
      for (let i = DAYS - 28; i < DAYS; i++) if (isWorkday(s.region, dayDate(i)) === wd) vals.push(v[i * 24 + h]);
      const mu = median(vals);
      const sd = std(vals);
      const ts = new Date(d);
      ts.setHours(h);
      pts.push({ ts: ts.toISOString(), kw: round(mu, 0), low: round(Math.max(mu - 1.5 * sd, 0), 0), high: round(mu + 1.5 * sd, 0) });
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
  return {
    kwh,
    kwhChangePct: kwhPrev ? round(((kwh - kwhPrev) / kwhPrev) * 100, 1) : 0,
    cost: round(kwh * s.region.tariffPerKwh, 2),
    co2Tonnes: round(sum(series, "co2Kg") / 1000, 1),
    peakKw: Math.max(...series.map((p) => p.peakKw)),
    contractedKw: s.plant.contractedKw,
    savingsAnnual: round(anomalies.reduce((a, x) => a + x.annualizedCost, 0), 0),
    openAnomalies: anomalies.length,
  };
}

/** Total kWh per hour-of-week slot over the last `days` days (for registry-based estimates). */
export function siteEnergy(empresaId: number, days = 30) {
  const s = sim(empresaId)!;
  const v = site(s);
  let kwh = 0;
  for (let k = (DAYS - days) * 24; k < DAYS * 24; k++) kwh += v[k];
  return { kwh, days, tariff: s.region.tariffPerKwh };
}
