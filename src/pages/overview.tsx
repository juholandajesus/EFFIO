import { Link } from "wouter";
import { Zap, Coins, Leaf, Gauge, Sparkles, ArrowRight, TrendingUp, PlugZap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlant } from "@/industry/use-plant";
import { dailySeries, detectAnomalies, kpis, lineName, lineStats, productStats, productTrend } from "@/industry/engine";
import { anomalyTitle } from "@/industry/copilot";
import { AXIS, GRID, Kpi, NoPlant, PageHeader, SERIES, SeverityBadge, TOOLTIP } from "@/industry/ui";
import { openCopilot } from "@/components/copilot-panel";

export default function Overview() {
  const { empresaId, info, fmt, t, lang } = usePlant();
  if (!empresaId || !info) return <NoPlant />;

  const k = kpis(empresaId);
  const series = dailySeries(empresaId, 30);
  const anomalies = detectAnomalies(empresaId);
  const lines = lineStats(empresaId, 30).sort((a, b) => b.kwh - a.kwh);
  const products = productStats(empresaId, 30);
  const main = [...products].sort((a, b) => b.kwhLoaded - a.kwhLoaded)[0];
  const trend = productTrend(empresaId, main.sku, 30);

  return (
    <div className="space-y-6">
      <PageHeader
        title={info.plant.name}
        subtitle={`${info.region.flag} ${info.plant.city} · ${fmt.l(info.plant.sector)} · ${t("ov.last30")}`}
        right={
          <Button onClick={() => openCopilot()} className="gap-2" data-testid="ask-copilot">
            <Sparkles className="h-4 w-4" /> {t("copilot.ask")}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi tone="accent" icon={Zap} label={t("kpi.energy")} value={fmt.energy(k.kwh)} hint={t("kpi.vsPrev", { pct: fmt.pct(k.kwhChangePct) })} />
        <Kpi icon={Coins} label={t("kpi.cost")} value={fmt.money(k.cost)} hint={t("kpi.tariff", { v: fmt.money(info.region.tariffPerKwh, 3) })} />
        <Kpi icon={Leaf} label={t("kpi.co2")} value={`${fmt.num(k.co2Tonnes, 1)} t`} hint={t("kpi.scope2")} />
        <Kpi icon={Gauge} label={t("kpi.peak")} value={`${fmt.num(k.peakKw)} kW`} hint={t("kpi.ofContracted", { pct: fmt.num((k.peakKw / k.contractedKw) * 100, 0), kw: fmt.num(k.contractedKw) })} />
      </div>

      <Card className="border-primary/40 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-6 w-6 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">{t("ov.savingsLabel")}</div>
              <div className="text-3xl font-extrabold tabular-nums" data-testid="savings">{fmt.money(k.savingsAnnual)}<span className="text-base font-medium text-muted-foreground"> / {t("common.year")}</span></div>
              <div className="text-sm text-muted-foreground">{t("ov.savingsHint", { n: k.openAnomalies, pct: fmt.num((k.savingsAnnual / (k.cost * 12)) * 100, 1) })}</div>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/anomalies">{t("ov.seeActions")} <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("ov.dailyEnergy")}</CardTitle>
            <CardDescription>{t("ov.dailyEnergyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmt.date(d)} minTickGap={24} />
                <YAxis {...AXIS} width={56} tickFormatter={(v) => `${fmt.num(v / 1000, 0)}`} label={{ value: "MWh", angle: -90, position: "insideLeft", fill: "#78716c", fontSize: 11 }} />
                <Tooltip {...TOOLTIP} labelFormatter={(d) => fmt.date(d, { weekday: "short", day: "2-digit", month: "short" })} formatter={(v: number, _n, p) => [`${fmt.energy(v)} · ${fmt.money(p.payload.cost)}`, t("kpi.energy")]} />
                <Bar dataKey="kwh" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("ov.secTitle", { product: fmt.l(main.name) })}</CardTitle>
            <CardDescription>{t("ov.secDesc", { unit: fmt.l(main.unit), base: fmt.num(main.baselineKwhPerUnit, 1) })}</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmt.date(d)} minTickGap={24} />
                <YAxis {...AXIS} width={56} domain={["auto", "auto"]} />
                <Tooltip {...TOOLTIP} labelFormatter={(d) => fmt.date(d, { weekday: "short", day: "2-digit", month: "short" })} formatter={(v: number) => [`${fmt.num(v, 1)} kWh/${fmt.l(main.unit)}`, t("prod.kwhPerUnit")]} />
                <ReferenceLine y={main.baselineKwhPerUnit} stroke="#78716c" strokeDasharray="4 4" label={{ value: t("common.baseline"), fill: "#78716c", fontSize: 11, position: "insideTopLeft" }} />
                <Line type="monotone" dataKey="kwhPerUnit" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("ov.topIssues")}</CardTitle>
              <CardDescription>{t("ov.topIssuesDesc")}</CardDescription>
            </div>
            <Link href="/anomalies" className="text-sm font-medium text-primary hover:underline">{t("common.seeAll")}</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    {a.ongoing && <span className="text-xs text-muted-foreground">{t("anom.ongoing")}</span>}
                  </div>
                  <div className="mt-1 truncate font-medium">{anomalyTitle(a, lang, fmt.l(lineName(empresaId, a.lineId)), a.sku ? fmt.l(products.find((p) => p.sku === a.sku)!.name) : undefined)}</div>
                  <div className="text-xs text-muted-foreground">{t("anom.since", { date: fmt.dateTime(a.start) })}</div>
                </div>
                <div className="text-right">
                  {a.annualizedCost > 0 ? (
                    <>
                      <div className="font-semibold tabular-nums">{fmt.money(a.annualizedCost)}</div>
                      <div className="text-xs text-muted-foreground">/ {t("common.year")}</div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold tabular-nums">{fmt.num(a.peakKw ?? 0)} kW</div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("ov.byLine")}</CardTitle>
            <CardDescription>{t("ov.byLineDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((l) => (
              <div key={l.id}>
                <div className="flex justify-between text-sm">
                  <span className="truncate pr-2">{fmt.l(l.name)}</span>
                  <span className="tabular-nums text-muted-foreground">{fmt.num(l.sharePct, 1)}%</span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
                  <div style={{ width: `${l.sharePct * (1 - l.idlePct / 100)}%`, background: SERIES[0] }} />
                  <div style={{ width: `${(l.sharePct * l.idlePct) / 100}%`, background: SERIES[3], marginLeft: 2 }} />
                </div>
              </div>
            ))}
            <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} />{t("ov.producing")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[3] }} />{t("ov.idle")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-3 py-4 text-sm md:flex-row md:items-center md:justify-between">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <PlugZap className="h-4 w-4" /> {t("ov.dataSources")}
          </span>
          <Link href="/integrations" className="font-medium text-primary hover:underline">{t("ov.manageIntegrations")}</Link>
        </CardContent>
      </Card>
    </div>
  );
}
