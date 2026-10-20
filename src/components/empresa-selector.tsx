import { useListEmpresas, getListEmpresasQueryKey } from "@workspace/api-client-react";
import { useEmpresa } from "@/context/empresa-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

const PLANO_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  bess: "BESS",
  completo: "Completo",
};

const PLANO_COLORS: Record<string, string> = {
  mercado_livre: "text-amber-600",
  bess: "text-blue-600",
  completo: "text-emerald-600",
};

export function EmpresaSelector() {
  const { empresaAtiva, setEmpresaAtiva } = useEmpresa();
  const { data: empresas } = useListEmpresas({
    query: { queryKey: getListEmpresasQueryKey() },
  });

  const handleChange = (value: string) => {
    if (value === "__none__") {
      setEmpresaAtiva(null);
      return;
    }
    const found = empresas?.find((e) => String(e.id) === value) ?? null;
    setEmpresaAtiva(found);
  };

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Select
        value={empresaAtiva ? String(empresaAtiva.id) : "__none__"}
        onValueChange={handleChange}
      >
        <SelectTrigger
          className="w-[220px] h-8 text-sm border-dashed"
          data-testid="empresa-selector"
        >
          <SelectValue placeholder="Selecione uma empresa…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">Nenhuma empresa</span>
          </SelectItem>
          {empresas?.map((e) => (
            <SelectItem key={e.id} value={String(e.id)}>
              <div className="flex flex-col">
                <span className="font-medium">{e.razao_social}</span>
                <span className={`text-xs ${PLANO_COLORS[e.tipo_plano] ?? "text-muted-foreground"}`}>
                  Plano: {PLANO_LABELS[e.tipo_plano] ?? e.tipo_plano}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
