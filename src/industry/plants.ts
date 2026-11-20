/**
 * Demo plants. Each one models a real kind of factory: production lines with a
 * running load and an idle load, the products each line makes (with an hourly
 * rate, which sets its energy per unit) and the utilities that serve the plant.
 * Anomalies are injected on purpose so the detection engine has something to find.
 */
import type { CountryCode } from "./regions";

export type L = { en: string; pt: string };

export interface ProductDef {
  sku: string;
  name: L;
  unit: L; // unit of output, e.g. tonne
  ratePerHour: number; // units per running hour
}

export interface LineDef {
  id: string;
  name: L;
  kind: "production" | "utility";
  runKw: number;
  idleKw: number;
  /** hours the line runs on a working day: [start, end) */
  hours: [number, number];
  /** runs on non-working days too */
  runsWeekends: boolean;
  products: ProductDef[];
}

export type InjectedAnomaly =
  | { type: "baseload"; lineId: string; fromDaysAgo: number; extraKwFraction: number }
  | { type: "idle_hold"; lineId: string; daysAgo: number[]; holdFraction: number }
  | { type: "demand_peak"; lineId: string; daysAgo: number; hours: [number, number]; targetFraction: number }
  | { type: "sec_drift"; lineId: string; fromDaysAgo: number; rateLoss: number };

export interface PlantDef {
  empresaId: number;
  name: string;
  country: CountryCode;
  city: string;
  sector: L;
  contractedKw: number;
  lines: LineDef[];
  anomalies: InjectedAnomaly[];
  /** share of electricity already covered by on-site solar / green certificates */
  renewableShare: number;
}

const t = (unit: "t" | "kpcs" | "pcs"): L =>
  unit === "t" ? { en: "t", pt: "t" } : unit === "kpcs" ? { en: "k pcs", pt: "mil pç" } : { en: "pcs", pt: "pç" };

export const PLANTS: PlantDef[] = [
  {
    empresaId: 1,
    name: "Metalúrgica Horizonte Ltda",
    country: "BR",
    city: "Guarulhos - SP",
    sector: { en: "Metalworking", pt: "Metalurgia" },
    contractedKw: 1700,
    renewableShare: 0.8,
    lines: [
      {
        id: "usinagem", name: { en: "CNC machining", pt: "Usinagem CNC" },
        kind: "production", runKw: 260, idleKw: 40, hours: [6, 22], runsWeekends: false,
        products: [
          { sku: "ENG-220", name: { en: "Gear Ø220", pt: "Engrenagem Ø220" }, unit: t("pcs"), ratePerHour: 34 },
          { sku: "EIX-45", name: { en: "Shaft Ø45", pt: "Eixo Ø45" }, unit: t("pcs"), ratePerHour: 52 },
        ],
      },
      {
        id: "fundicao", name: { en: "Induction foundry", pt: "Fundição por indução" },
        kind: "production", runKw: 780, idleKw: 60, hours: [7, 17], runsWeekends: false,
        products: [
          { sku: "CAR-FF", name: { en: "Cast iron housing", pt: "Carcaça de ferro fundido" }, unit: t("t"), ratePerHour: 1.25 },
        ],
      },
      {
        id: "utilidades", name: { en: "Utilities (air + chiller)", pt: "Utilidades (ar + chiller)" },
        kind: "utility", runKw: 240, idleKw: 95, hours: [6, 22], runsWeekends: true, products: [],
      },
    ],
    anomalies: [
      { type: "idle_hold", lineId: "fundicao", daysAgo: [], holdFraction: 0.55 },
      { type: "baseload", lineId: "utilidades", fromDaysAgo: 5, extraKwFraction: 0.22 },
      { type: "demand_peak", lineId: "fundicao", daysAgo: 3, hours: [14, 17], targetFraction: 0.96 },
      { type: "sec_drift", lineId: "usinagem", fromDaysAgo: 7, rateLoss: 0.11 },
    ],
  },
];

export function plantFor(empresaId: number | null | undefined): PlantDef | null {
  if (empresaId == null) return null;
  return PLANTS.find((p) => p.empresaId === empresaId) ?? null;
}
