import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlant } from "@/industry/use-plant";
import { carbon, dailySeries, productStats } from "@/industry/engine";
import { AXIS, GRID, Kpi, NoPlant, PageHeader, SERIES, TOOLTIP } from "@/industry/ui";

export default function Carbon() {
  const { empresaId, info, fmt, t, lang } = usePlant();
  const [target, setTarget] = useState(30);
  if (!empresaId || !info) return <NoPlant />;

  const c = carbon(empresaId);
  const products = productStats(empresaId, 30);
  const daily = dailySeries(empresaId, 30);
  const levers = [
    { key: "fix", label: t("co2.leverFix"), t: c.levers.fixAnomalies },
    { key: "idle", label: t("co2.leverIdle"), t: c.levers.shiftIdle },
    { key: "solar", label: t("co2.leverSolar"), t: c.levers.solar20 },
  ];
  const leverMax = Math.max(...levers.map((l) => l.t), 1);
  const leverTotal = levers.reduce((a, l) => a + l.t, 0);
  const targetT = (c.annualT * target) / 100;
  const coveredPct = Math.min((leverTotal / (targetT || 1)) * 100, 100);

  const exportCsv = () => {
    const rows = [
      ["date", "kwh", "co2_kg", `cost_${info.region.currency}`],
      ...daily.map((d) => [d.date, d.kwh, d.co2Kg, d.cost]),
      [],
      ["sku", "product", "unit", "kwh_per_unit", "kgco2e_per_unit", "output_30d"],
      ...products.map((p) => [p.sku, p.name.en, p.unit.en, p.kwhPerUnit, p.co2PerUnit, p.units]),
      [],
      ["grid_factor_kgco2e_per_kwh", c.factor, c.factorSource],
      ["renewable_share", c.renewableShare],
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `effio-scope2-${info.plant.name.replace(/\W+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("co2.title")}
        subtitle={t("co2.subtitle")}
        right={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" className="gap-2" onClick={exportCsv} data-testid="export-csv"><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" /> {t("co2.print")}</Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi tone="accent" label={t("co2.last30")} value={`${fmt.num(c.co2_30T, 1)} t`} hint="tCO₂e · Scope 2" />
        <Kpi label={t("co2.annual")} value={`${fmt.num(c.annualT)} t`} hint={t("co2.annualHint")} />
        <Kpi label={t("co2.factor")} value={`${c.factor} kg/kWh`} hint={c.factorSource} />
        <Kpi label={t("co2.renewable")} value={`${fmt.num(c.renewableShare * 100, 0)}%`} hint={t("co2.renewableHint")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("co2.daily")}</CardTitle>
            <CardDescription>{t("co2.dailyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.daily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmt.date(d)} minTickGap={24} />
                <YAxis {...AXIS} width={48} tickFormatter={(v) => fmt.num(v / 1000, 1)} label={{ value: "t", angle: -90, position: "insideLeft", fill: "#78716c", fontSize: 11 }} />
                <Tooltip {...TOOLTIP} labelFormatter={(d) => fmt.date(d, { weekday: "short", day: "2-digit", month: "short" })} formatter={(v: number) => [fmt.co2(v), "CO₂e"]} />
                <Bar dataKey="co2Kg" fill={SERIES[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("co2.target")}</CardTitle>
            <CardDescription>{t("co2.targetDesc", { pct: target, t: fmt.num(targetT) })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Slider value={[target]} min={5} max={60} step={5} onValueChange={(v) => setTarget(v[0])} aria-label={t("co2.target")} />
            <div className="space-y-3">
              {levers.map((l) => (
                <div key={l.key}>
                  <div className="flex justify-between text-sm">
                    <span>{l.label}</span>
                    <span className="tabular-nums font-medium">{fmt.num(l.t)} t/{t("common.yearShort")}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full" style={{ width: `${(l.t / leverMax) * 100}%`, background: SERIES[2] }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              {t("co2.coverage", { total: fmt.num(leverTotal), pct: fmt.num(coveredPct, 0) })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("co2.products")}</CardTitle>
          <CardDescription>{t("co2.productsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("prod.product")}</TableHead>
                <TableHead className="text-right">{t("prod.output")}</TableHead>
                <TableHead className="text-right">{t("prod.kwhPerUnit")}</TableHead>
                <TableHead className="text-right">kgCO₂e / {t("co2.unit")}</TableHead>
                <TableHead className="text-right">{t("co2.total30")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.sku}>
                  <TableCell>
                    <div className="font-medium">{p.name[lang]}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.num(p.units, 1)} {p.unit[lang]}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.num(p.kwhPerUnit, 1)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt.num(p.co2PerUnit, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.co2(p.co2PerUnit * p.units)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">{t("co2.method", { factor: c.factor, source: c.factorSource })}</p>
        </CardContent>
      </Card>
    </div>
  );
}
