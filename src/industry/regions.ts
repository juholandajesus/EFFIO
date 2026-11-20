/**
 * Country presets. Every value is a default that the company can override.
 * Tariffs are the published industrial energy charge per kWh (taxes, demand
 * and fixed charges excluded). Grid factors are location-based Scope 2 factors.
 */
/** Only Brazil for now; other countries live in the `demo-global` branch. */
export type CountryCode = "BR";

export interface Region {
  code: CountryCode;
  name: { en: string; pt: string };
  flag: string;
  currency: string;
  tariffPerKwh: number;
  tariffNote: string;
  gridFactorKgPerKwh: number;
  gridFactorSource: string;
  weekend: number[]; // JS getDay() values of non-working days
  peakHours: [number, number]; // inclusive start/end hour of the utility peak window
}

export const REGIONS: Record<CountryCode, Region> = {
  BR: {
    code: "BR",
    name: { en: "Brazil", pt: "Brasil" },
    flag: "🇧🇷",
    currency: "BRL",
    tariffPerKwh: 0.2455,
    tariffNote: "Free-market (ACL) energy contract price, R$ 245.50/MWh",
    gridFactorKgPerKwh: 0.0385,
    gridFactorSource: "MCTI, SIN average factor (2023)",
    weekend: [0, 6],
    peakHours: [18, 20],
  },
};

export function regionName(r: Region, lang: "en" | "pt") {
  return r.name[lang];
}
