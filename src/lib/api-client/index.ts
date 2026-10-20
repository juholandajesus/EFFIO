/**
 * Recriação local do pacote "@workspace/api-client-react" do monorepo do Replit.
 * Mesma API (estilo Orval): hooks do React Query + funções de query key.
 * Os tipos foram tirados das rotas do backend (Express) do EFFIO.
 */
import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

// ───────────────────────── Tipos ─────────────────────────

export interface Empresa {
  id: number;
  razao_social: string;
  cnpj: string;
  setor: string | null;
  demanda_contratada_kw: number | null;
  distribuidora: string | null;
  tipo_plano: "mercado_livre" | "bess" | "completo" | string;
  created_at: string;
}

export type EmpresaInput = Partial<Omit<Empresa, "id" | "created_at">> & {
  razao_social?: string;
  cnpj?: string;
};

export interface BessUnidade {
  id: number;
  empresa_id: number;
  nome_unidade: string;
  localizacao: string | null;
  tipo_bess: string;
  fabricante_bms: string | null;
  fabricante_inversor: string | null;
  protocolo_comunicacao: string | null;
  gateway_iot: string | null;
  broker_mensageria: string | null;
  frequencia_coleta_segundos: number | null;
  variaveis_monitoradas: string[];
  status_integracao: string;
  observacoes: string | null;
  created_at: string;
}

export type BessUnidadeInput = Partial<Omit<BessUnidade, "id" | "created_at">>;

export interface Dashboard {
  kpis: {
    total_montante_mwh: number;
    total_custo: number;
    total_registros: number;
    total_empresas: number;
  };
  por_submercado: { submercado: string; montante_mwh: number; custo: number }[];
  por_tipo_operacao: { tipo_operacao: string; montante_mwh: number; custo: number }[];
  serie_temporal: { data: string; montante_mwh: number; custo: number }[];
}

export interface DiagnosticoItem {
  tipo: string;
  descricao: string;
  valor: string;
  unidade: string;
  data: string | null;
  empresa: string | null;
}

export interface Diagnostico {
  resumo: {
    total_registros: number;
    periodo_inicio: string | null;
    periodo_fim: string | null;
    total_empresas: number;
  };
  diagnosticos: DiagnosticoItem[];
}

export interface ConsumoRegistro {
  id: number;
  data: string;
  hora: string;
  id_empresa: number;
  nome_empresa: string;
  tipo_operacao: string;
  montante_mwh: number;
  preco_pld: number;
  submercado: string;
}

export interface ConsumoHorario {
  registros: ConsumoRegistro[];
  resumo: { total_montante_mwh: number; total_custo: number; count: number };
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface UploadResult {
  processadas: number;
  erros: string[];
  status: "sucesso" | "parcial" | "erro";
}

export interface DashboardParams { id_empresa?: number }
export interface DiagnosticoParams { id_empresa?: number }
export interface ListBessUnidadesParams { empresa_id?: number }
export interface ConsumoHorarioParams {
  id_empresa?: number;
  nome_empresa?: string;
  submercado?: string;
  data_inicio?: string;
  data_fim?: string;
  tipo_operacao?: string;
  page?: number;
  limit?: number;
}

// ───────────────────────── Fetch ─────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("effio_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function withQuery(url: string, params?: object): string {
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

/** Todas as chamadas passam por fetch("/api/..."), que é redirecionado em src/lib/api-base.ts */
export async function customFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders(), ...(init.headers as Record<string, string>) };
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, (data && (data as { error?: string }).error) || res.statusText, data);
  }
  return data as T;
}

// ───────────────────────── Helpers de hooks ─────────────────────────

type QueryOpts<T> = { query?: Partial<UseQueryOptions<T, ApiError, T, QueryKey>> };
type MutOpts<T, V> = { mutation?: UseMutationOptions<T, ApiError, V> };

function makeQuery<T>(key: QueryKey, fn: () => Promise<T>, options?: QueryOpts<T>) {
  return useQuery<T, ApiError, T, QueryKey>({
    queryFn: fn,
    ...options?.query,
    queryKey: options?.query?.queryKey ?? key,
  });
}

// ───────────────────────── Empresas ─────────────────────────

export const getListEmpresasQueryKey = () => ["/api/empresas"] as const;
export const listEmpresas = () => customFetch<Empresa[]>("/api/empresas");
export function useListEmpresas(options?: QueryOpts<Empresa[]>) {
  return makeQuery(getListEmpresasQueryKey(), listEmpresas, options);
}

export const createEmpresa = (data: EmpresaInput) =>
  customFetch<Empresa>("/api/empresas", { method: "POST", body: JSON.stringify(data) });
export function useCreateEmpresa(options?: MutOpts<Empresa, { data: EmpresaInput }>) {
  return useMutation({ mutationFn: ({ data }) => createEmpresa(data), ...options?.mutation });
}

export const updateEmpresa = (id: number, data: EmpresaInput) =>
  customFetch<Empresa>(`/api/empresas/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export function useUpdateEmpresa(options?: MutOpts<Empresa, { id: number; data: EmpresaInput }>) {
  return useMutation({ mutationFn: ({ id, data }) => updateEmpresa(id, data), ...options?.mutation });
}

export const deleteEmpresa = (id: number) => customFetch<void>(`/api/empresas/${id}`, { method: "DELETE" });
export function useDeleteEmpresa(options?: MutOpts<void, { id: number }>) {
  return useMutation({ mutationFn: ({ id }) => deleteEmpresa(id), ...options?.mutation });
}

// ───────────────────────── Dashboard / Diagnóstico / Consumo ─────────────────────────

export const getGetDashboardQueryKey = (params?: DashboardParams) =>
  ["/api/dashboard", ...(params ? [params] : [])] as const;
export const getDashboard = (params?: DashboardParams) =>
  customFetch<Dashboard>(withQuery("/api/dashboard", params));
export function useGetDashboard(params?: DashboardParams, options?: QueryOpts<Dashboard>) {
  return makeQuery(getGetDashboardQueryKey(params), () => getDashboard(params), options);
}

export const getGetDiagnosticoQueryKey = (params?: DiagnosticoParams) =>
  ["/api/diagnostico", ...(params ? [params] : [])] as const;
export const getDiagnostico = (params?: DiagnosticoParams) =>
  customFetch<Diagnostico>(withQuery("/api/diagnostico", params));
export function useGetDiagnostico(params?: DiagnosticoParams, options?: QueryOpts<Diagnostico>) {
  return makeQuery(getGetDiagnosticoQueryKey(params), () => getDiagnostico(params), options);
}

export const getGetConsumoHorarioQueryKey = (params?: ConsumoHorarioParams) =>
  ["/api/consumo-horario", ...(params ? [params] : [])] as const;
export const getConsumoHorario = (params?: ConsumoHorarioParams) =>
  customFetch<ConsumoHorario>(withQuery("/api/consumo-horario", params));
export function useGetConsumoHorario(params?: ConsumoHorarioParams, options?: QueryOpts<ConsumoHorario>) {
  return makeQuery(getGetConsumoHorarioQueryKey(params), () => getConsumoHorario(params), options);
}

// ───────────────────────── BESS ─────────────────────────

export const getListBessUnidadesQueryKey = (params?: ListBessUnidadesParams) =>
  ["/api/bess", ...(params ? [params] : [])] as const;
export const listBessUnidades = (params?: ListBessUnidadesParams) =>
  customFetch<BessUnidade[]>(withQuery("/api/bess", params));
export function useListBessUnidades(params?: ListBessUnidadesParams, options?: QueryOpts<BessUnidade[]>) {
  return makeQuery(getListBessUnidadesQueryKey(params), () => listBessUnidades(params), options);
}

export const createBessUnidade = (data: BessUnidadeInput) =>
  customFetch<BessUnidade>("/api/bess", { method: "POST", body: JSON.stringify(data) });
export function useCreateBessUnidade(options?: MutOpts<BessUnidade, { data: BessUnidadeInput }>) {
  return useMutation({ mutationFn: ({ data }) => createBessUnidade(data), ...options?.mutation });
}

export const updateBessUnidade = (id: number, data: BessUnidadeInput) =>
  customFetch<BessUnidade>(`/api/bess/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export function useUpdateBessUnidade(options?: MutOpts<BessUnidade, { id: number; data: BessUnidadeInput }>) {
  return useMutation({ mutationFn: ({ id, data }) => updateBessUnidade(id, data), ...options?.mutation });
}

export const deleteBessUnidade = (id: number) => customFetch<void>(`/api/bess/${id}`, { method: "DELETE" });
export function useDeleteBessUnidade(options?: MutOpts<void, { id: number }>) {
  return useMutation({ mutationFn: ({ id }) => deleteBessUnidade(id), ...options?.mutation });
}
