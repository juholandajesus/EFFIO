/**
 * Country presets. Every value is a default that the company can override.
 * Tariffs are the published industrial energy charge per kWh (taxes, demand
 * and fixed charges excluded). Grid factors are location-based Scope 2 factors.
 */
export type CountryCode = "AE" | "SA" | "OM" | "BR";

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
  AE: {
    code: "AE",
    name: { en: "United Arab Emirates", pt: "Emirados Árabes Unidos" },
    flag: "🇦🇪",
    currency: "AED",
    tariffPerKwh: 0.44,
    tariffNote: "DEWA industrial slab above 10,000 kWh/month (0.38) + fuel surcharge (0.06)",
    gridFactorKgPerKwh: 0.404,
    gridFactorSource: "DEWA sustainability report (2020)",
    weekend: [0, 6],
    peakHours: [12, 17],
  },
  SA: {
    code: "SA",
    name: { en: "Saudi Arabia", pt: "Arábia Saudita" },
    flag: "🇸🇦",
    currency: "SAR",
    tariffPerKwh: 0.2,
    tariffNote: "SEC industrial tariff, 20 halalas/kWh (23 halalas from Jan 2027)",
    gridFactorKgPerKwh: 0.614,
    gridFactorSource: "Climate Transparency 2022 (power sector, 2021)",
    weekend: [5, 6],
    peakHours: [12, 17],
  },
  OM: {
    code: "OM",
    name: { en: "Oman", pt: "Omã" },
    flag: "🇴🇲",
    currency: "OMR",
    tariffPerKwh: 0.025,
    tariffNote: "Non-residential flat rate, 25 baisa/kWh (2025 regulation)",
    gridFactorKgPerKwh: 0.544,
    gridFactorSource: "Ember (2025 grid intensity)",
    weekend: [5, 6],
    peakHours: [12, 17],
  },
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
