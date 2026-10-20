import { Lock } from "lucide-react";
import { useEmpresa } from "@/context/empresa-context";
import { Card, CardContent } from "@/components/ui/card";

interface PlanoGuardProps {
  requires: "mercado_livre" | "bess" | "completo";
  children: React.ReactNode;
}

const PLANO_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  bess: "BESS",
  completo: "Completo (Mercado Livre + BESS)",
};

export function PlanoGuard({ requires, children }: PlanoGuardProps) {
  const { empresaAtiva, hasMercadoLivre, hasBess, hasCompleto } = useEmpresa();

  if (!empresaAtiva) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col items-center gap-3 pt-8 pb-8 text-center">
            <Lock className="h-10 w-10 text-amber-500" />
            <p className="font-semibold text-amber-900">Selecione uma empresa</p>
            <p className="text-sm text-amber-700">
              Use o seletor no topo da tela para escolher a empresa ativa e acessar este módulo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allowed =
    requires === "mercado_livre"
      ? hasMercadoLivre
      : requires === "bess"
      ? hasBess
      : hasCompleto;

  if (!allowed) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full border-orange-200 bg-orange-50">
          <CardContent className="flex flex-col items-center gap-3 pt-8 pb-8 text-center">
            <Lock className="h-10 w-10 text-orange-500" />
            <p className="font-semibold text-orange-900">
              Módulo não disponível no plano atual
            </p>
            <p className="text-sm text-orange-700">
              Este módulo requer o plano{" "}
              <strong>{PLANO_LABELS[requires]}</strong>. A empresa{" "}
              <strong>{empresaAtiva.razao_social}</strong> está no plano{" "}
              <strong>{PLANO_LABELS[empresaAtiva.tipo_plano] ?? empresaAtiva.tipo_plano}</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
