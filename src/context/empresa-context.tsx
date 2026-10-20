import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Empresa } from "@workspace/api-client-react";
import { useAuth } from "@/context/auth-context";

export type TipoPlano = "mercado_livre" | "bess" | "completo";

interface EmpresaContextValue {
  empresaAtiva: Empresa | null;
  setEmpresaAtiva: (empresa: Empresa | null) => void;
  plano: TipoPlano | null;
  hasMercadoLivre: boolean;
  hasBess: boolean;
  hasCompleto: boolean;
}

const EmpresaContext = createContext<EmpresaContextValue | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { empresa: empresaAuth } = useAuth();

  const initialEmpresa = (): Empresa | null => {
    if (!empresaAuth) return null;
    return {
      id: empresaAuth.id,
      razao_social: empresaAuth.razao_social,
      cnpj: empresaAuth.cnpj,
      tipo_plano: empresaAuth.tipo_plano,
      setor: null,
      demanda_contratada_kw: null,
      distribuidora: null,
      created_at: "",
    } as Empresa;
  };

  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(initialEmpresa);

  useEffect(() => {
    if (empresaAuth && !empresaAtiva) {
      setEmpresaAtivaState({
        id: empresaAuth.id,
        razao_social: empresaAuth.razao_social,
        cnpj: empresaAuth.cnpj,
        tipo_plano: empresaAuth.tipo_plano,
        setor: null,
        demanda_contratada_kw: null,
        distribuidora: null,
        created_at: "",
      } as Empresa);
    }
    if (!empresaAuth) {
      setEmpresaAtivaState(null);
    }
  }, [empresaAuth]);

  const setEmpresaAtiva = useCallback((empresa: Empresa | null) => {
    setEmpresaAtivaState(empresa);
  }, []);

  const plano = (empresaAtiva?.tipo_plano as TipoPlano) ?? null;
  const hasMercadoLivre = plano === "mercado_livre" || plano === "completo";
  const hasBess = plano === "bess" || plano === "completo";
  const hasCompleto = plano === "completo";

  return (
    <EmpresaContext.Provider value={{ empresaAtiva, setEmpresaAtiva, plano, hasMercadoLivre, hasBess, hasCompleto }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa must be used within EmpresaProvider");
  return ctx;
}
