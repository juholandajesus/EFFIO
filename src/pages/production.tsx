import { useState } from "react";
import { Link } from "wouter";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Database } from "lucide-react";
import { usePlant } from "@/industry/use-plant";
import { lineName, lineStats, productName, productStats, productTrend, workOrders } from "@/industry/engine";
import { AXIS, GRID, NoPlant, PageHeader, SERIES, STATUS, TOOLTIP } from "@/industry/ui";

export default function Production() {
  const { empresaId, info, fmt, t } = usePlant();
  const [sku, setSku] = useState<string | null>(null);
  if (!empresaId || !info) return <NoPlant />;

  const products = productStats(empresaId, 30).sort((a, b) => b.kwhLoaded - a.kwhLoaded);
  const selected = products.find((p) => p.sku === sku) ?? products[0];
  const trend = productTrend(empresaId, selected.sku, 30);
  const lines = lineStats(empresaId, 30);
  const { planned, completed } = workOrders(empresaId, 30);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("prod.title")}
        subtitle={t("prod.subtitle")}
        right={
          <Link href="/integrations" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            <Database className="h-4 w-4" /> {t("prod.source")}
          </Link>
        }
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("prod.perProduct")}</CardTitle>
          <CardDescription>{t("prod.perProductDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("prod.product")}</TableHead>
                <TableHead className="text-right">{t("prod.output")}</TableHead>
                <TableHead className="text-right">{t("prod.energy")}</TableHead>
                <TableHead className="text-right">{t("prod.kwhPerUnit")}</TableHead>
                <TableHead className="text-right">{t("prod.vsBaseline")}</TableHead>
                <TableHead className="text-right">{t("prod.costPerUnit")}</TableHead>
                <TableHead className="text-right">{t("prod.co2PerUnit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow
                  key={p.sku}
                  onClick={() => setSku(p.sku)}
                  className={`cursor-pointer ${p.sku === selected.sku ? "bg-muted/60" : ""}`}
                  data-testid={`product-${p.sku}`}
                >
                  <TableCell>
                    <div className="font-medium">{fmt.l(p.name)}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.num(p.units, 1)} {fmt.l(p.unit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.energy(p.kwhLoaded)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt.num(p.kwhPerUnit, 1)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {p.driftPct >= 6 && <AlertTriangle className="h-3.5 w-3.5" style={{ color: STATUS.critical }} />}
                      {fmt.pct(p.driftPct)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.money(p.costPerUnit, info.region.currency === "OMR" ? 3 : 2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.num(p.co2PerUnit, 1)} kg</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">{t("prod.tableNote")}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("prod.trendTitle", { product: fmt.l(selected.name) })}</CardTitle>
            <CardDescription>{t("prod.trendDesc", { best: fmt.num(selected.bestKwhPerUnit, 1), base: fmt.num(selected.baselineKwhPerUnit, 1), unit: fmt.l(selected.unit) })}</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="date" {...AXIS} tickFormatter={(d) => fmt.date(d)} minTickGap={24} />
                <YAxis {...AXIS} width={56} domain={["auto", "auto"]} />
                <Tooltip {...TOOLTIP} labelFormatter={(d) => fmt.date(d, { weekday: "short", day: "2-digit", month: "short" })} formatter={(v: number) => [`${fmt.num(v, 1)} kWh/${fmt.l(selected.unit)}`, t("prod.direct")]} />
                <ReferenceLine y={selected.baselineKwhPerUnit} stroke="#78716c" strokeDasharray="4 4" label={{ value: t("common.baseline"), fill: "#78716c", fontSize: 11, position: "insideTopLeft" }} />
                <Line type="monotone" dataKey="kwhPerUnit" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("prod.lines")}</CardTitle>
            <CardDescription>{t("prod.linesDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((l) => (
              <div key={l.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{fmt.l(l.name)}</span>
                  {l.kind === "utility" && <Badge variant="outline">{t("prod.utility")}</Badge>}
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div><div className="font-semibold text-foreground tabular-nums">{fmt.energy(l.kwh)}</div>{t("prod.energy")}</div>
                  <div><div className="font-semibold text-foreground tabular-nums">{fmt.num(l.idlePct, 1)}%</div>{t("prod.idleShare")}</div>
                  <div><div className="font-semibold text-foreground tabular-nums">{l.kind === "utility" ? "24/7" : `${fmt.num(l.runningHours)} h`}</div>{t("prod.runHours")}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("prod.orders")}</CardTitle>
          <CardDescription>{t("prod.ordersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="completed">
            <TabsList>
              <TabsTrigger value="completed">{t("prod.completed")}</TabsTrigger>
              <TabsTrigger value="planned">{t("prod.planned")}</TabsTrigger>
            </TabsList>
            {(["completed", "planned"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("prod.order")}</TableHead>
                      <TableHead>{t("prod.date")}</TableHead>
                      <TableHead>{t("prod.line")}</TableHead>
                      <TableHead>{t("prod.product")}</TableHead>
                      <TableHead className="text-right">{t("prod.plannedQty")}</TableHead>
                      <TableHead className="text-right">{t("prod.producedQty")}</TableHead>
                      <TableHead className="text-right">{t("prod.energy")}</TableHead>
                      <TableHead className="text-right">{t("prod.kwhPerUnit")}</TableHead>
                      <TableHead>{t("prod.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tab === "completed" ? completed : planned).map((o) => {
                      const pn = productName(empresaId, o.sku);
                      const unit = pn ? fmt.l(pn.unit) : "";
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.id}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmt.date(o.date, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmt.l(lineName(empresaId, o.lineId))}</TableCell>
                          <TableCell className="whitespace-nowrap">{pn ? fmt.l(pn.name) : o.sku}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt.num(o.plannedQty, 1)} {unit}</TableCell>
                          <TableCell className="text-right tabular-nums">{o.producedQty ? `${fmt.num(o.producedQty, 1)} ${unit}` : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{o.kwh ? fmt.energy(o.kwh) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{o.producedQty ? fmt.num(o.kwh / o.producedQty, 1) : "—"}</TableCell>
                          <TableCell>
                            {o.status === "completed" && o.producedQty === 0 ? (
                              <Badge variant="outline">{t("prod.maintenance")}</Badge>
                            ) : (
                              <Badge variant="outline" className={o.status === "completed" ? "text-muted-foreground" : ""}>{t(`prod.st.${o.status}` as "prod.st.completed")}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
