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
import { useT } from "@/i18n";

const PLANO_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  bess: "BESS",
  completo: "Completo",
};

const PLANO_COLORS: Record<string, string> = {
  mercado_livre: "text-amber-400",
  bess: "text-blue-400",
  completo: "text-emerald-400",
};

export function EmpresaSelector() {
  const { empresaAtiva, setEmpresaAtiva } = useEmpresa();
  const { t } = useT();
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
    <div className="flex min-w-0 items-center gap-2">
      <Building2 className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground sm:block" />
      <Select
        value={empresaAtiva ? String(empresaAtiva.id) : "__none__"}
        onValueChange={handleChange}
      >
        <SelectTrigger
          className="h-8 w-[240px] min-w-0 max-w-full text-sm border-dashed"
          data-testid="empresa-selector"
        >
          <SelectValue placeholder={t("sel.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">{t("sel.none")}</span>
          </SelectItem>
          {empresas?.map((e) => (
            <SelectItem key={e.id} value={String(e.id)}>
              <div className="flex flex-col">
                <span className="font-medium">{e.razao_social}</span>
                <span className={`text-xs ${PLANO_COLORS[e.tipo_plano] ?? "text-muted-foreground"}`}>
                  {t("sel.plan")}: {PLANO_LABELS[e.tipo_plano] ? t(`plan.${e.tipo_plano}` as "plan.completo") : e.tipo_plano}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
