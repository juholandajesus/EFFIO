import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGetDiagnostico, getGetDiagnosticoQueryKey, useListEmpresas, getListEmpresasQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, AlertTriangle, TrendingUp, CalendarDays, Factory, Activity } from "lucide-react";
import { PlanoGuard } from "@/components/plano-guard";

export default function Diagnosticos() {
  const [empresaId, setEmpresaId] = useState<string>("all");

  const { data: empresas } = useListEmpresas({
    query: { queryKey: getListEmpresasQueryKey() }
  });

  const queryParams = empresaId !== "all" ? { id_empresa: parseInt(empresaId) } : {};
  const { data: diagnostico, isLoading } = useGetDiagnostico(queryParams, {
    query: { queryKey: getGetDiagnosticoQueryKey(queryParams) }
  });

  const getIconForType = (tipo: string) => {
    switch (tipo) {
      case 'pico_consumo': return <TrendingUp className="h-5 w-5 text-primary" />;
      case 'pico_custo': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'submercado_critico': return <Factory className="h-5 w-5 text-secondary" />;
      case 'operacao_principal': return <Activity className="h-5 w-5 text-blue-500" />;
      default: return <Zap className="h-5 w-5 text-primary" />;
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "dd 'de' MMMM, yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <PlanoGuard requires="mercado_livre">
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Diagnósticos Mercado Livre</h1>
          <p className="text-muted-foreground mt-1">Insights automáticos baseados no perfil de carga processado.</p>
        </div>
        
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

      {isLoading || !diagnostico ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary p-3 rounded-full text-primary-foreground">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Resumo do Período Analisado</h3>
                <p className="text-muted-foreground text-sm">
                  Baseado em {diagnostico.resumo.total_registros.toLocaleString('pt-BR')} registros 
                  de {diagnostico.resumo.total_empresas} empresa(s).
                </p>
              </div>
            </div>
            {diagnostico.resumo.periodo_inicio && diagnostico.resumo.periodo_fim && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Período</div>
                <div className="font-medium text-lg">
                  {format(parseISO(diagnostico.resumo.periodo_inicio), 'dd/MM/yyyy')} a {format(parseISO(diagnostico.resumo.periodo_fim), 'dd/MM/yyyy')}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {diagnostico.diagnosticos.map((item, index) => (
              <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start space-y-0 pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight mb-1">{item.descricao}</CardTitle>
                    {item.empresa && (
                      <CardDescription className="flex items-center gap-1">
                        <Factory className="h-3 w-3" /> {item.empresa}
                      </CardDescription>
                    )}
                  </div>
                  <div className="bg-muted p-2 rounded-lg ml-4">
                    {getIconForType(item.tipo)}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-extrabold tracking-tighter ${item.tipo === 'pico_custo' ? 'text-destructive' : 'text-foreground'}`}>
                      {item.valor}
                    </span>
                    <span className="text-lg font-medium text-muted-foreground">{item.unidade}</span>
                  </div>
                  {item.data && (
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Registrado em {formatDate(item.data)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {diagnostico.diagnosticos.length === 0 && (
              <div className="col-span-2 text-center py-12 text-muted-foreground border rounded-xl border-dashed">
                Não há dados suficientes para gerar diagnósticos. Faça upload de mais arquivos CSV.
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </PlanoGuard>
  );
}
