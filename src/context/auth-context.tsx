import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: "gestor_principal" | "colaborador" | "admin_effio";
  status: string;
  empresa_id: number | null;
}

export interface EmpresaAuth {
  id: number;
  razao_social: string;
  cnpj: string;
  tipo_plano: string;
}

interface AuthContextValue {
  token: string | null;
  usuario: UsuarioLogado | null;
  empresa: EmpresaAuth | null;
  isAuthenticated: boolean;
  isGestor: boolean;
  isColaborador: boolean;
  login: (token: string, refresh_token: string, usuario: UsuarioLogado, empresa: EmpresaAuth | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "effio_token";
const REFRESH_KEY = "effio_refresh";
const USER_KEY = "effio_user";
const EMP_KEY = "effio_empresa";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UsuarioLogado) : null;
  });
  const [empresa, setEmpresa] = useState<EmpresaAuth | null>(() => {
    const raw = localStorage.getItem(EMP_KEY);
    return raw ? (JSON.parse(raw) as EmpresaAuth) : null;
  });

  function login(
    newToken: string,
    refresh_token: string,
    newUsuario: UsuarioLogado,
    newEmpresa: EmpresaAuth | null,
  ) {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(REFRESH_KEY, refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(newUsuario));
    if (newEmpresa) localStorage.setItem(EMP_KEY, JSON.stringify(newEmpresa));
    setToken(newToken);
    setUsuario(newUsuario);
    setEmpresa(newEmpresa);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EMP_KEY);
    setToken(null);
    setUsuario(null);
    setEmpresa(null);
  }

  const isAuthenticated = Boolean(token && usuario);
  const isGestor = usuario?.perfil === "gestor_principal" || usuario?.perfil === "admin_effio";
  const isColaborador = usuario?.perfil === "colaborador";

  return (
    <AuthContext.Provider value={{ token, usuario, empresa, isAuthenticated, isGestor, isColaborador, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
