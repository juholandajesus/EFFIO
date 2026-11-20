import { useMemo } from "react";
import { useEmpresa } from "@/context/empresa-context";
import { useT } from "@/i18n";
import { getPlant } from "./engine";
import type { L } from "./plants";

/** Active plant + formatters in the company's currency and the user's language. */
export function usePlant(forceEmpresaId?: number) {
  const { empresaAtiva } = useEmpresa();
  const { lang, locale, t } = useT();
  const id = forceEmpresaId ?? empresaAtiva?.id ?? null;
  const info = getPlant(id);

  const fmt = useMemo(() => {
    const currency = info?.region.currency ?? "USD";
    const money = (n: number, digits?: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: digits ?? (Math.abs(n) >= 1000 ? 0 : currency === "OMR" ? 3 : 2),
        minimumFractionDigits: 0,
      }).format(n);
    const num = (n: number, d = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);
    const energy = (kwh: number) =>
      Math.abs(kwh) >= 1_000_000 ? `${num(kwh / 1_000_000, 2)} GWh` : Math.abs(kwh) >= 10_000 ? `${num(kwh / 1000, 1)} MWh` : `${num(kwh, 0)} kWh`;
    const co2 = (kg: number) => (Math.abs(kg) >= 1000 ? `${num(kg / 1000, 1)} tCO₂e` : `${num(kg, 0)} kgCO₂e`);
    const pct = (n: number, d = 1) => `${n > 0 ? "+" : ""}${num(n, d)}%`;
    const date = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) =>
      new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString(locale, opts);
    const dateTime = (iso: string) =>
      new Date(iso).toLocaleString(locale, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    const l = (x: L) => x[lang];
    return { money, num, energy, co2, pct, date, dateTime, l, currency };
  }, [info?.region.currency, locale, lang]);

  return { empresaId: id, empresa: empresaAtiva, info, fmt, lang, t };
}

export type Fmt = ReturnType<typeof usePlant>["fmt"];
