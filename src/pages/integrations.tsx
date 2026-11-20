import { useState } from "react";
import { CheckCircle2, Copy, Database, Gauge, PlugZap, Radio, FileSpreadsheet, Webhook, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { usePlant } from "@/industry/use-plant";
import { workOrders } from "@/industry/engine";
import { PageHeader } from "@/industry/ui";

type Status = "connected" | "available";
interface Connector {
  id: string;
  name: string;
  kind: "erp" | "meter" | "file" | "api";
  icon: React.ElementType;
  desc: { en: string; pt: string };
  defaultStatus: Status;
}

const CONNECTORS: Connector[] = [
  { id: "partner", name: "Partner ERP · Native AI", kind: "erp", icon: Sparkles, desc: { en: "Bi-directional sync of work orders, BOM and costs. Energy cost flows back into product costing.", pt: "Sincronização bidirecional de ordens, BOM e custos. O custo de energia volta para o custeio do produto." }, defaultStatus: "connected" },
  { id: "sap", name: "SAP S/4HANA", kind: "erp", icon: Database, desc: { en: "Production orders (PP), confirmations and material master via OData.", pt: "Ordens de produção (PP), apontamentos e cadastro de materiais via OData." }, defaultStatus: "available" },
  { id: "dynamics", name: "Microsoft Dynamics 365", kind: "erp", icon: Database, desc: { en: "Production orders and routes via Dataverse API.", pt: "Ordens e roteiros de produção via Dataverse API." }, defaultStatus: "available" },
  { id: "odoo", name: "Odoo MRP", kind: "erp", icon: Database, desc: { en: "Manufacturing orders and work centers via XML-RPC.", pt: "Ordens de fabricação e centros de trabalho via XML-RPC." }, defaultStatus: "available" },
  { id: "meters", name: "Smart meters (Modbus / MQTT)", kind: "meter", icon: Gauge, desc: { en: "Sub-metering per line through an IoT gateway, 1-minute resolution.", pt: "Submedição por linha via gateway IoT, resolução de 1 minuto." }, defaultStatus: "connected" },
  { id: "scada", name: "SCADA / OPC UA", kind: "meter", icon: Radio, desc: { en: "Process tags (temperature, pressure, speed) to explain energy changes.", pt: "Tags de processo (temperatura, pressão, velocidade) para explicar variações de energia." }, defaultStatus: "available" },
  { id: "bills", name: "Utility bills & CSV", kind: "file", icon: FileSpreadsheet, desc: { en: "DEWA, SEC, Nama, CCEE files: monthly reconciliation of invoiced vs. measured energy.", pt: "Arquivos DEWA, SEC, Nama, CCEE: conciliação mensal entre energia faturada e medida." }, defaultStatus: "available" },
  { id: "api", name: "EFFIO Open API & Webhooks", kind: "api", icon: Webhook, desc: { en: "Push orders from any system; receive anomaly alerts in your workflow.", pt: "Envie ordens de qualquer sistema; receba alertas de anomalia no seu fluxo." }, defaultStatus: "connected" },
];

const KEY = "effio_integrations";

export default function Integrations() {
  const { empresaId, info, t, lang, fmt } = usePlant();
  const { toast } = useToast();
  const [state, setState] = useState<Record<string, Status>>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {
      return {};
    }
  });
  const statusOf = (c: Connector) => state[c.id] ?? c.defaultStatus;
  const toggle = (c: Connector) => {
    const next = { ...state, [c.id]: statusOf(c) === "connected" ? "available" : "connected" } as Record<string, Status>;
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast({ title: next[c.id] === "connected" ? t("int.connectedToast", { name: c.name }) : t("int.disconnectedToast", { name: c.name }) });
  };

  const sample = info && empresaId ? workOrders(empresaId, 1).planned[0] : null;
  const payload = JSON.stringify(
    {
      plant_id: empresaId ?? 4,
      order_id: sample?.id ?? "WO-28231",
      work_center: sample?.lineId ?? "press1",
      sku: sample?.sku ?? "AL-6063-WIN",
      planned_qty: sample?.plannedQty ?? 23.2,
      unit: "t",
      start: new Date().toISOString().slice(0, 13) + ":00:00Z",
      status: "released",
    },
    null,
    2,
  );
  const curl = `curl -X POST https://YOUR-EFFIO-HOST/api/v1/production-orders \\\n  -H "Authorization: Bearer $EFFIO_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${payload}'`;

  const mapping = [
    ["Work order / Production order", "order_id", "AUFNR"],
    ["Work center / Line", "work_center", "ARBPL"],
    ["Material / SKU", "sku", "MATNR"],
    ["Planned quantity", "planned_qty", "GAMNG"],
    ["Confirmed quantity", "produced_qty", "IGMNG"],
    ["Scrap", "scrap_qty", "XMNGA"],
    ["Start / finish", "start · end", "GSTRP · GLTRP"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("int.title")} subtitle={t("int.subtitle")} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CONNECTORS.map((c) => {
          const st = statusOf(c);
          return (
            <Card key={c.id} className={`flex flex-col shadow-sm ${c.id === "partner" ? "border-primary/50" : ""}`} data-testid={`connector-${c.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <c.icon className="h-6 w-6 text-primary" />
                  {st === "connected" ? (
                    <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#0ca30c" }} />{t("int.connected")}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">{t("int.available")}</Badge>
                  )}
                </div>
                <CardTitle className="pt-2 text-base">{c.name}</CardTitle>
                <CardDescription>{c.desc[lang]}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-2">
                {st === "connected" && <div className="mb-2 text-xs text-muted-foreground">{t("int.lastSync", { min: c.kind === "meter" ? 1 : 12 })}</div>}
                <Button size="sm" variant={st === "connected" ? "outline" : "default"} className="w-full gap-1.5" onClick={() => toggle(c)}>
                  <PlugZap className="h-4 w-4" /> {st === "connected" ? t("int.disconnect") : t("int.connect")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("int.mapping")}</CardTitle>
            <CardDescription>{t("int.mappingDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("int.erpField")}</TableHead>
                  <TableHead>EFFIO</TableHead>
                  <TableHead>SAP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapping.map(([label, effio, sap]) => (
                  <TableRow key={effio}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="font-mono text-xs">{effio}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{sap}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>{t("int.api")}</CardTitle>
              <CardDescription>{t("int.apiDesc")}</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard?.writeText(curl).catch(() => undefined);
                toast({ title: t("int.copied") });
              }}
            >
              <Copy className="h-4 w-4" /> {t("int.copy")}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[300px] overflow-auto rounded-lg bg-stone-950 p-4 text-xs leading-relaxed text-stone-100">{curl}</pre>
            <div className="mt-3 text-xs text-muted-foreground">
              {t("int.webhook")} <span className="font-mono">anomaly.detected</span>, <span className="font-mono">forecast.peak_risk</span>, <span className="font-mono">sec.drift</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {info && (
        <p className="text-xs text-muted-foreground">
          {t("int.footer", { plant: info.plant.name, tariff: fmt.money(info.region.tariffPerKwh, 3), note: info.region.tariffNote })}
        </p>
      )}
    </div>
  );
}
