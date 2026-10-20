import { BatteryCharging, CheckCircle, AlertTriangle, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanoGuard } from "@/components/plano-guard";
import { useEmpresa } from "@/context/empresa-context";
import { useListBessUnidades, getListBessUnidadesQueryKey } from "@workspace/api-client-react";

const DIAGNOSTICOS_MOCK = [
  {
    tipo: "cobertura_variaveis",
    titulo: "Cobertura de Variáveis",
    icon: CheckCircle,
    cor: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  {
    tipo: "latencia_coleta",
    titulo: "Latência de Coleta",
    icon: Clock,
    cor: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  {
    tipo: "alertas_soh",
    titulo: "Alertas de SOH",
    icon: AlertTriangle,
    cor: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
  },
];

export default function DiagnosticosBess() {
  const { empresaAtiva } = useEmpresa();

  const { data: bessUnidades } = useListBessUnidades(
    { empresa_id: empresaAtiva?.id },
    { query: { queryKey: getListBessUnidadesQueryKey({ empresa_id: empresaAtiva?.id }) } }
  );

  const total = bessUnidades?.length ?? 0;
  const integradas = bessUnidades?.filter((b) => b.status_integracao === "Integrado").length ?? 0;
  const coberturaIntegracao = total > 0 ? Math.round((integradas / total) * 100) : 0;

  return (
    <PlanoGuard requires="bess">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Diagnósticos BESS</h1>
            <p className="text-sm text-muted-foreground">
              Análise de saúde e integração das unidades — {empresaAtiva?.razao_social}
            </p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-sm text-muted-foreground mb-1">Total de Unidades</p>
              <p className="text-3xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-sm text-muted-foreground mb-1">Unidades Integradas</p>
              <p className="text-3xl font-bold text-green-600">{integradas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-sm text-muted-foreground mb-1">Cobertura de Integração</p>
              <p className="text-3xl font-bold text-primary">{coberturaIntegracao}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Diagnósticos por unidade */}
        {total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
              <BatteryCharging className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhuma unidade BESS cadastrada</p>
              <p className="text-sm mt-1">Cadastre unidades no módulo BESS para ver diagnósticos.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bessUnidades?.map((bess) => (
              <Card key={bess.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BatteryCharging className="h-4 w-4 text-primary" />
                    {bess.nome_unidade}
                    <span className="text-muted-foreground font-normal">· {bess.tipo_bess}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3">
                  {/* Status de integração */}
                  <div className={`rounded-lg border p-3 ${
                    bess.status_integracao === "Integrado"
                      ? "bg-green-50 border-green-200"
                      : bess.status_integracao === "Em análise"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-gray-50 border-gray-200"
                  }`}>
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <p className="font-semibold text-sm mt-1">{bess.status_integracao}</p>
                  </div>

                  {/* Variáveis monitoradas */}
                  <div className="rounded-lg border p-3 bg-blue-50 border-blue-200">
                    <p className="text-xs font-medium text-muted-foreground">Variáveis</p>
                    <p className="font-semibold text-sm mt-1 text-blue-700">
                      {bess.variaveis_monitoradas?.length ?? 0} configuradas
                    </p>
                  </div>

                  {/* Protocolo */}
                  <div className="rounded-lg border p-3 bg-purple-50 border-purple-200">
                    <p className="text-xs font-medium text-muted-foreground">Protocolo</p>
                    <p className="font-semibold text-sm mt-1 text-purple-700">
                      {bess.protocolo_comunicacao ?? "Não definido"}
                    </p>
                  </div>

                  {/* Variáveis lista */}
                  {(bess.variaveis_monitoradas?.length ?? 0) > 0 && (
                    <div className="col-span-3 flex flex-wrap gap-1.5 mt-1">
                      {(bess.variaveis_monitoradas ?? []).map((v) => (
                        <span
                          key={v}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-dashed border-amber-300 bg-amber-50/50">
          <CardContent className="flex items-center gap-3 pt-4 pb-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              <strong>Diagnósticos avançados</strong> — Análise de degradação de SOH, alertas de temperatura fora do range e anomalias de corrente serão disponibilizados após integração dos gateways IoT.
            </p>
          </CardContent>
        </Card>
      </div>
    </PlanoGuard>
  );
}
