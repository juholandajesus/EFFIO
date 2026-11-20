import { BatteryCharging, Thermometer, Zap, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanoGuard } from "@/components/plano-guard";
import { useEmpresa } from "@/context/empresa-context";
import { useListBessUnidades, getListBessUnidadesQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  "Integrado": "bg-green-500/15 text-green-300 border-green-500/30",
  "Em análise": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "Não integrado": "bg-muted text-muted-foreground border-border",
};

const MOCK_METRICS = [
  { label: "SOC Médio", value: "87%", icon: BatteryCharging, color: "text-green-400", bg: "bg-green-500/10" },
  { label: "SOH Médio", value: "94%", icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Temperatura Média", value: "32°C", icon: Thermometer, color: "text-orange-400", bg: "bg-orange-500/10" },
  { label: "Potência Ativa", value: "1.2 MW", icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10" },
];

export default function DashboardBess() {
  const { empresaAtiva } = useEmpresa();

  const { data: bessUnidades } = useListBessUnidades(
    { empresa_id: empresaAtiva?.id },
    { query: { queryKey: getListBessUnidadesQueryKey({ empresa_id: empresaAtiva?.id }) } }
  );

  const integradas = bessUnidades?.filter((b) => b.status_integracao === "Integrado") ?? [];
  const emAnalise = bessUnidades?.filter((b) => b.status_integracao === "Em análise") ?? [];
  const naoIntegradas = bessUnidades?.filter((b) => b.status_integracao === "Não integrado") ?? [];

  return (
    <PlanoGuard requires="bess">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard BESS</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral das unidades de armazenamento — {empresaAtiva?.razao_social}
            </p>
          </div>
        </div>

        {/* KPI Cards — mock data (telemetria real em breve) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {MOCK_METRICS.map((m) => (
            <Card key={m.label}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <div className={`p-1.5 rounded-md ${m.bg}`}>
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">dados simulados</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status das unidades */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-300">Integradas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-300">{integradas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">unidades ativas</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-300">Em Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-300">{emAnalise.length}</p>
              <p className="text-xs text-muted-foreground mt-1">em configuração</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Não Integradas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-muted-foreground">{naoIntegradas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">aguardando integração</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de unidades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unidades Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {!bessUnidades || bessUnidades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BatteryCharging className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma unidade BESS cadastrada para esta empresa.</p>
                <p className="text-sm mt-1">Acesse o módulo BESS para cadastrar unidades.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bessUnidades.map((bess) => (
                  <div
                    key={bess.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BatteryCharging className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{bess.nome_unidade}</p>
                        <p className="text-xs text-muted-foreground">
                          {bess.tipo_bess}
                          {bess.localizacao ? ` · ${bess.localizacao}` : ""}
                          {bess.protocolo_comunicacao ? ` · ${bess.protocolo_comunicacao}` : ""}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        STATUS_COLORS[bess.status_integracao] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {bess.status_integracao}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <TrendingUp className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-300">
              <strong>Telemetria em tempo real</strong> — Gráficos de SOC, temperatura e potência ativa com dados ao vivo serão disponibilizados em breve após integração dos gateways IoT.
            </p>
          </CardContent>
        </Card>
      </div>
    </PlanoGuard>
  );
}
