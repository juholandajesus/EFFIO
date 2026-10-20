import { GitMerge, Zap, BatteryCharging, TrendingUp, BarChart3, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanoGuard } from "@/components/plano-guard";
import { useEmpresa } from "@/context/empresa-context";
import {
  useGetDashboard,
  getGetDashboardQueryKey,
  useListBessUnidades,
  getListBessUnidadesQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardIntegrado() {
  const { empresaAtiva } = useEmpresa();

  const queryParams = empresaAtiva ? { id_empresa: empresaAtiva.id } : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dashboard } = useGetDashboard(queryParams, {
    query: { queryKey: getGetDashboardQueryKey(queryParams) },
  }) as { data: any };

  const { data: bessUnidades } = useListBessUnidades(
    { empresa_id: empresaAtiva?.id },
    { query: { queryKey: getListBessUnidadesQueryKey({ empresa_id: empresaAtiva?.id }) } }
  );

  const formatMwh = (v: number) => `${v.toFixed(1)} MWh`;
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const topEmpresas = dashboard?.por_empresa?.slice(0, 5) ?? [];

  return (
    <PlanoGuard requires="completo">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg">
            <GitMerge className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Integrado</h1>
            <p className="text-sm text-muted-foreground">
              Visão unificada: Mercado Livre + BESS — {empresaAtiva?.razao_social}
            </p>
          </div>
        </div>

        {/* Mercado Livre Summary */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mercado Livre</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Total Consumo</p>
                <p className="text-xl font-bold text-amber-600">
                  {dashboard?.resumo ? formatMwh(dashboard.resumo.total_montante_mwh) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Custo Total</p>
                <p className="text-xl font-bold text-orange-600">
                  {dashboard?.resumo ? formatCurrency(dashboard.resumo.total_custo) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Registros CSV</p>
                <p className="text-xl font-bold">{dashboard?.resumo?.total_registros ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Período</p>
                <p className="text-sm font-bold">
                  {dashboard?.resumo
                    ? `${dashboard.resumo.periodo_inicio?.slice(0, 7) ?? "—"} → ${dashboard.resumo.periodo_fim?.slice(0, 7) ?? "—"}`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* BESS Summary */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BatteryCharging className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">BESS</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Unidades BESS</p>
                <p className="text-xl font-bold text-blue-600">{bessUnidades?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Integradas</p>
                <p className="text-xl font-bold text-green-600">
                  {bessUnidades?.filter((b) => b.status_integracao === "Integrado").length ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">SOC Médio (sim.)</p>
                <p className="text-xl font-bold">87%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">Potência Ativa (sim.)</p>
                <p className="text-xl font-bold">1.2 MW</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Combined Chart */}
        {topEmpresas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Consumo Mercado Livre por Submercado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard?.por_submercado ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="submercado" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} MWh`, "Consumo"]}
                  />
                  <Bar dataKey="total_montante_mwh" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Intelligence Banner */}
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <Activity className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Inteligência Energética Integrada</p>
              <p className="text-emerald-700 text-sm mt-1">
                A combinação dos dados do Mercado Livre (CSV/CCEE) com os dados de telemetria BESS permitirá otimização de despacho, arbitragem energética e redução de custos de exposição. Disponível após integração dos gateways IoT.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PlanoGuard>
  );
}
