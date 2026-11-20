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
    empresaId: 4,
    name: "Falcon Crest Aluminium LLC",
    country: "AE",
    city: "Dubai Industrial City",
    sector: { en: "Aluminium extrusion", pt: "Extrusão de alumínio" },
    contractedKw: 4600,
    renewableShare: 0.08,
    lines: [
      {
        id: "press1", name: { en: "Extrusion Press 1 (2,500 t)", pt: "Prensa de Extrusão 1 (2.500 t)" },
        kind: "production", runKw: 980, idleKw: 140, hours: [6, 22], runsWeekends: false,
        products: [
          { sku: "AL-6063-WIN", name: { en: "6063 window profile", pt: "Perfil de janela 6063" }, unit: t("t"), ratePerHour: 1.45 },
          { sku: "AL-6061-STR", name: { en: "6061 structural profile", pt: "Perfil estrutural 6061" }, unit: t("t"), ratePerHour: 1.2 },
        ],
      },
      {
        id: "press2", name: { en: "Extrusion Press 2 (1,800 t)", pt: "Prensa de Extrusão 2 (1.800 t)" },
        kind: "production", runKw: 720, idleKw: 110, hours: [6, 22], runsWeekends: false,
        products: [
          { sku: "AL-6063-WIN", name: { en: "6063 window profile", pt: "Perfil de janela 6063" }, unit: t("t"), ratePerHour: 1.05 },
        ],
      },
      {
        id: "furnace", name: { en: "Billet homogenizing furnace", pt: "Forno de homogeneização de tarugos" },
        kind: "production", runKw: 650, idleKw: 60, hours: [5, 21], runsWeekends: false,
        products: [
          { sku: "AL-BILLET", name: { en: "Homogenized billet", pt: "Tarugo homogeneizado" }, unit: t("t"), ratePerHour: 3.1 },
        ],
      },
      {
        id: "anodizing", name: { en: "Anodizing line", pt: "Linha de anodização" },
        kind: "production", runKw: 540, idleKw: 70, hours: [7, 19], runsWeekends: false,
        products: [
          { sku: "AL-ANOD-FAC", name: { en: "Anodized facade profile", pt: "Perfil anodizado de fachada" }, unit: t("t"), ratePerHour: 0.9 },
        ],
      },
      {
        id: "utilities", name: { en: "Utilities (compressed air + chillers)", pt: "Utilidades (ar comprimido + chillers)" },
        kind: "utility", runKw: 620, idleKw: 260, hours: [6, 22], runsWeekends: true, products: [],
      },
    ],
    anomalies: [
      { type: "baseload", lineId: "utilities", fromDaysAgo: 9, extraKwFraction: 0.2 },
      { type: "idle_hold", lineId: "furnace", daysAgo: [], holdFraction: 0.62 },
      { type: "demand_peak", lineId: "press1", daysAgo: 2, hours: [13, 16], targetFraction: 0.95 },
      { type: "sec_drift", lineId: "press2", fromDaysAgo: 7, rateLoss: 0.12 },
    ],
  },
  {
    empresaId: 5,
    name: "Rimal Steel Industries Co.",
    country: "SA",
    city: "Jubail Industrial City",
    sector: { en: "Steel rolling (rebar)", pt: "Laminação de aço (vergalhão)" },
    contractedKw: 16500,
    renewableShare: 0,
    lines: [
      {
        id: "mill", name: { en: "Bar rolling mill", pt: "Laminador de barras" },
        kind: "production", runKw: 9200, idleKw: 900, hours: [0, 24], runsWeekends: true,
        products: [
          { sku: "RB-12", name: { en: "Rebar 12 mm", pt: "Vergalhão 12 mm" }, unit: t("t"), ratePerHour: 78 },
          { sku: "RB-16", name: { en: "Rebar 16 mm", pt: "Vergalhão 16 mm" }, unit: t("t"), ratePerHour: 92 },
        ],
      },
      {
        id: "reheat", name: { en: "Reheating furnace fans & pumps", pt: "Ventiladores e bombas do forno de reaquecimento" },
        kind: "production", runKw: 1900, idleKw: 450, hours: [0, 24], runsWeekends: true,
        products: [
          { sku: "BLT-150", name: { en: "Reheated billet", pt: "Tarugo reaquecido" }, unit: t("t"), ratePerHour: 88 },
        ],
      },
      {
        id: "cutting", name: { en: "Cutting & bundling", pt: "Corte e amarração" },
        kind: "production", runKw: 620, idleKw: 90, hours: [6, 22], runsWeekends: false,
        products: [
          { sku: "RB-BND", name: { en: "Bundled rebar", pt: "Vergalhão amarrado" }, unit: t("t"), ratePerHour: 115 },
        ],
      },
      {
        id: "utilities", name: { en: "Utilities (cooling water + air)", pt: "Utilidades (água de resfriamento + ar)" },
        kind: "utility", runKw: 1700, idleKw: 1100, hours: [0, 24], runsWeekends: true, products: [],
      },
    ],
    anomalies: [
      { type: "idle_hold", lineId: "mill", daysAgo: [4], holdFraction: 0.45 },
      { type: "sec_drift", lineId: "mill", fromDaysAgo: 6, rateLoss: 0.09 },
      { type: "demand_peak", lineId: "mill", daysAgo: 1, hours: [14, 16], targetFraction: 0.97 },
    ],
  },
  {
    empresaId: 6,
    name: "Sohar Bay Polymers LLC",
    country: "OM",
    city: "Sohar Industrial Port",
    sector: { en: "Plastics & packaging", pt: "Plásticos e embalagens" },
    contractedKw: 3100,
    renewableShare: 0.12,
    lines: [
      {
        id: "film", name: { en: "Blown film line", pt: "Linha de filme soprado" },
        kind: "production", runKw: 820, idleKw: 120, hours: [0, 24], runsWeekends: true,
        products: [
          { sku: "PE-FILM-50", name: { en: "PE film 50 µm", pt: "Filme PE 50 µm" }, unit: t("t"), ratePerHour: 1.3 },
        ],
      },
      {
        id: "injection", name: { en: "Injection moulding cell", pt: "Célula de injeção" },
        kind: "production", runKw: 560, idleKw: 90, hours: [6, 22], runsWeekends: false,
        products: [
          { sku: "CAP-38", name: { en: "38 mm closures", pt: "Tampas 38 mm" }, unit: t("kpcs"), ratePerHour: 21 },
          { sku: "PAIL-20L", name: { en: "20 L pails", pt: "Baldes 20 L" }, unit: t("kpcs"), ratePerHour: 0.9 },
        ],
      },
      {
        id: "recycling", name: { en: "Recycling & pelletizing", pt: "Reciclagem e peletização" },
        kind: "production", runKw: 430, idleKw: 50, hours: [8, 20], runsWeekends: false,
        products: [
          { sku: "rPE-PEL", name: { en: "Recycled PE pellets", pt: "Pellets de PE reciclado" }, unit: t("t"), ratePerHour: 1.1 },
        ],
      },
      {
        id: "utilities", name: { en: "Utilities (chillers + air)", pt: "Utilidades (chillers + ar)" },
        kind: "utility", runKw: 520, idleKw: 240, hours: [6, 22], runsWeekends: true, products: [],
      },
    ],
    anomalies: [
      { type: "baseload", lineId: "utilities", fromDaysAgo: 6, extraKwFraction: 0.24 },
      { type: "sec_drift", lineId: "injection", fromDaysAgo: 7, rateLoss: 0.14 },
    ],
  },
  {
    empresaId: 1,
    name: "Metalúrgica Horizonte Ltda",
    country: "BR",
    city: "Guarulhos - SP",
    sector: { en: "Metalworking", pt: "Metalurgia" },
    contractedKw: 2500,
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
    ],
  },
];

export function plantFor(empresaId: number | null | undefined): PlantDef | null {
  if (empresaId == null) return null;
  return PLANTS.find((p) => p.empresaId === empresaId) ?? null;
}
