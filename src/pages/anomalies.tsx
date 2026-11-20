import { useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePlant } from "@/industry/use-plant";
import { detectAnomalies, forecast, getPlant, lineName, productName, type Anomaly } from "@/industry/engine";
import { anomalyHint, anomalyTitle } from "@/industry/copilot";
import { AXIS, GRID, Kpi, Legend, NoPlant, PageHeader, SERIES, SeverityBadge, STATUS, TOOLTIP } from "@/industry/ui";
import { openCopilot } from "@/components/copilot-panel";

const DONE_KEY = "effio_anomalies_done";

function loadDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function Anomalies() {
  const { empresaId, info, fmt, t, lang } = usePlant();
  const { toast } = useToast();
  const [done, setDone] = useState<string[]>(loadDone);

  useEffect(() => {
    if (window.location.hash === "#forecast") document.getElementById("forecast")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (!empresaId || !info) return <NoPlant />;

  const all = detectAnomalies(empresaId);
  const open = all.filter((a) => !done.includes(a.id));
  const f = forecast(empresaId);
  const plant = getPlant(empresaId)!.plant;
  const totalAnnual = open.reduce((a, x) => a + x.annualizedCost, 0);

  const markDone = (a: Anomaly) => {
    const next = [...done, a.id];
    setDone(next);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast({ title: t("anom.resolvedToast") });
  };

  const createTicket = (title: string) => toast({ title: t("anom.ticketToast"), description: title });

  const fcData = f.points.map((p) => ({ ...p, band: [p.low, p.high] as [number, number] }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("anom.title")} subtitle={t("anom.subtitle")} />

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi tone="accent" label={t("anom.open")} value={String(open.length)} hint={t("anom.openHint", { n: open.filter((a) => a.severity === "high").length })} />
        <Kpi label={t("anom.annualImpact")} value={fmt.money(totalAnnual)} hint={t("anom.annualImpactHint")} />
        <Kpi label={t("anom.fcPeak")} value={`${fmt.num(f.peak.kw)} kW`} hint={t("anom.fcPeakHint", { when: fmt.dateTime(f.peak.ts), pct: fmt.num(f.peakPct, 0) })} />
      </div>

      <div className="space-y-3">
        {open.length === 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 py-6 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" style={{ color: STATUS.good }} /> {t("anom.none")}
            </CardContent>
          </Card>
        )}
        {open.map((a) => {
          const line = plant.lines.find((l) => l.id === a.lineId)!;
          const product = a.sku ? productName(empresaId, a.sku) : null;
          const title = anomalyTitle(a, lang, fmt.l(lineName(empresaId, a.lineId)), product ? fmt.l(product.name) : undefined);
          return (
            <Card key={a.id} className="shadow-sm" data-testid="anomaly-card">
              <CardContent className="grid gap-4 py-5 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs text-muted-foreground">
                      {t(`anom.kind.${a.kind}` as "anom.kind.baseload")} · {fmt.dateTime(a.start)} → {a.ongoing ? t("anom.ongoing") : fmt.dateTime(a.end)} · {a.hours} h
                    </span>
                  </div>
                  <div className="text-lg font-semibold">{title}</div>
                  <p className="text-sm text-muted-foreground">{anomalyHint(a, lang, line.kind)}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => createTicket(title)}>
                      <ClipboardList className="h-4 w-4" /> {t("anom.ticket")}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openCopilot(lang === "pt" ? `Explique: ${title}` : `Explain: ${title}`)}>
                      <Sparkles className="h-4 w-4" /> {t("anom.explain")}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => markDone(a)}>
                      <CheckCircle2 className="h-4 w-4" /> {t("anom.resolve")}
                    </Button>
                  </div>
                </div>
                <div className="grid min-w-[180px] grid-cols-2 gap-3 text-right md:grid-cols-1">
                  {a.kind === "demand_peak" ? (
                    <div>
                      <div className="text-2xl font-bold tabular-nums">{fmt.num(a.peakKw ?? 0)} kW</div>
                      <div className="text-xs text-muted-foreground">{t("anom.ofContracted", { kw: fmt.num(plant.contractedKw) })}</div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{fmt.money(a.annualizedCost)}</div>
                        <div className="text-xs text-muted-foreground">{a.ongoing ? t("anom.perYearIfContinues") : t("anom.perYearIfRepeats")}</div>
                      </div>
                      <div>
                        <div className="font-semibold tabular-nums">{fmt.energy(a.excessKwh)}</div>
                        <div className="text-xs text-muted-foreground">{t("anom.excessSoFar", { cost: fmt.money(a.excessCost) })}</div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm" id="forecast">
        <CardHeader>
          <CardTitle>{t("fc.title")}</CardTitle>
          <CardDescription>{t("fc.desc", { kwh: fmt.energy(f.kwhTotal), cost: fmt.money(f.costTotal) })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Legend
            items={[
              { label: t("fc.expected"), color: SERIES[0] },
              { label: t("fc.range"), color: "#cde2fb" },
              { label: t("fc.contracted"), color: STATUS.critical, dashed: true },
            ]}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fcData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="ts" {...AXIS} tickFormatter={(d) => fmt.date(d, { weekday: "short", day: "2-digit" })} interval={23} />
                <YAxis {...AXIS} width={60} tickFormatter={(v) => fmt.num(v)} domain={[0, Math.ceil((f.contractedKw * 1.08) / 500) * 500]} label={{ value: "kW", angle: -90, position: "insideLeft", fill: "#78716c", fontSize: 11 }} />
                <Tooltip
                  {...TOOLTIP}
                  labelFormatter={(d) => fmt.dateTime(d)}
                  formatter={(v: number | number[], name) =>
                    Array.isArray(v) ? [`${fmt.num(v[0])}–${fmt.num(v[1])} kW`, t("fc.range")] : [`${fmt.num(v)} kW`, name === "kw" ? t("fc.expected") : String(name)]
                  }
                />
                <Area dataKey="band" stroke="none" fill="#cde2fb" fillOpacity={0.8} isAnimationActive={false} />
                <ReferenceLine y={f.contractedKw} stroke={STATUS.critical} strokeDasharray="5 4" />
                <Line dataKey="kw" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">{t("fc.method")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
