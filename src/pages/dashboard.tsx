import { useState } from "react";
import { useGetDashboard, getGetDashboardQueryKey, useListEmpresas, getListEmpresasQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, DollarSign, Database, Building2 } from "lucide-react";
import { PlanoGuard } from "@/components/plano-guard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const COLORS = ['#F59E0B', '#EA580C', '#D97706', '#C2410C', '#B45309'];

export default function Dashboard() {
  const [empresaId, setEmpresaId] = useState<string>("all");

  const { data: empresas } = useListEmpresas({
    query: { queryKey: getListEmpresasQueryKey() }
  });

  const queryParams = empresaId !== "all" ? { id_empresa: parseInt(empresaId) } : {};
  const { data: dashboard, isLoading } = useGetDashboard(queryParams, {
    query: { queryKey: getGetDashboardQueryKey(queryParams) }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  };

  return (
    <PlanoGuard requires="mercado_livre">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Mercado Livre</h1>
        
        <div className="w-full sm:w-72">
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresas?.map(emp => (
                <SelectItem key={emp.id} value={emp.id.toString()}>{emp.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading || !dashboard ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total MWh</CardTitle>
                <Zap className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="kpi-mwh">{formatNumber(dashboard.kpis.total_montante_mwh)}</div>
                <p className="text-xs text-muted-foreground mt-1">Consumo registrado no período</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-secondary shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary" data-testid="kpi-custo">{formatCurrency(dashboard.kpis.total_custo)}</div>
                <p className="text-xs text-muted-foreground mt-1">Baseado em preços PLD</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Registros</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="kpi-registros">{dashboard.kpis.total_registros.toLocaleString('pt-BR')}</div>
                <p className="text-xs text-muted-foreground mt-1">Linhas processadas</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Empresas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="kpi-empresas">{dashboard.kpis.total_empresas}</div>
                <p className="text-xs text-muted-foreground mt-1">Com dados de consumo</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle>Série Temporal (MWh diário)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.serie_temporal} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="data" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}MWh`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${formatNumber(value)} MWh`, 'Consumo']}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Line type="monotone" dataKey="montante_mwh" stroke="#F59E0B" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#F59E0B", stroke: "#fff", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Por Tipo de Operação</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboard.por_tipo_operacao}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="montante_mwh"
                      nameKey="tipo_operacao"
                    >
                      {dashboard.por_tipo_operacao.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [`${formatNumber(value)} MWh`, 'Consumo']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-full shadow-sm">
              <CardHeader>
                <CardTitle>Consumo por Submercado (MWh)</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.por_submercado} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="submercado" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      formatter={(value: number) => [`${formatNumber(value)} MWh`, 'Consumo']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="montante_mwh" fill="#EA580C" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
    </PlanoGuard>
  );
}
