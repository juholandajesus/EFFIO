/**
 * Backend simulado (modo demo). Reproduz as rotas do backend Express do EFFIO
 * dentro do navegador, guardando os dados no localStorage.
 */
import { criarSeed, type Db, type DbUsuario } from "./seed";

const STORAGE_KEY = "effio_demo_db_v1";
let db: Db | null = null;

function load(): Db {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      db = JSON.parse(raw) as Db;
      return db;
    }
  } catch {
    /* localStorage indisponível: segue só em memória */
  }
  db = criarSeed();
  save();
  return db;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* sem persistência */
  }
}

export function resetDemoDb() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  db = null;
  load();
}

function nextId(table: keyof Db["seq"]): number {
  const d = load();
  d.seq[table] = (d.seq[table] ?? 0) + 1;
  return d.seq[table];
}

// ───────────── utilidades HTTP ─────────────

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Ctx {
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  body: any;
  user: TokenUser | null;
}

interface TokenUser {
  sub: number;
  empresa_id: number | null;
  perfil: string;
  email: string;
}

function makeToken(u: DbUsuario): string {
  return `demo.${btoa(JSON.stringify({ sub: u.id }))}`;
}

function readToken(header: string | null): TokenUser | null {
  if (!header?.startsWith("Bearer demo.")) return null;
  try {
    const { sub } = JSON.parse(atob(header.slice("Bearer demo.".length)));
    const u = load().usuarios.find((x) => x.id === sub);
    if (!u) return null;
    return { sub: u.id, empresa_id: u.empresa_id, perfil: u.perfil, email: u.email };
  } catch {
    return null;
  }
}

function requireAuth(ctx: Ctx): TokenUser {
  if (!ctx.user) throw new HttpError(401, "Token de acesso ausente.");
  return ctx.user;
}

function requirePerfil(ctx: Ctx, ...perfis: string[]): TokenUser {
  const u = requireAuth(ctx);
  if (!perfis.includes(u.perfil)) throw new HttpError(403, "Permissão insuficiente.");
  return u;
}

function requireEmpresa(u: TokenUser): number {
  if (!u.empresa_id) throw new HttpError(400, "Sem empresa vinculada.");
  return u.empresa_id;
}

function safeUser(u: DbUsuario) {
  const { senha: _s, ...rest } = u;
  return rest;
}

function now() {
  return new Date().toISOString();
}

const round = (n: number, d = 4) => Number(n.toFixed(d));

// ───────────── agregações de consumo ─────────────

function consumoFiltrado(q: URLSearchParams) {
  let rows = load().consumo;
  const id = q.get("id_empresa");
  if (id) rows = rows.filter((r) => r.id_empresa === Number(id));
  const nome = q.get("nome_empresa");
  if (nome) rows = rows.filter((r) => r.nome_empresa === nome);
  const sub = q.get("submercado");
  if (sub) rows = rows.filter((r) => r.submercado === sub);
  const ini = q.get("data_inicio");
  if (ini) rows = rows.filter((r) => r.data >= ini);
  const fim = q.get("data_fim");
  if (fim) rows = rows.filter((r) => r.data <= fim);
  const tipo = q.get("tipo_operacao");
  if (tipo) rows = rows.filter((r) => r.tipo_operacao === tipo);
  return rows;
}

function groupSum<K extends string>(rows: ReturnType<typeof consumoFiltrado>, key: (r: (typeof rows)[number]) => K) {
  const map = new Map<K, { montante_mwh: number; custo: number }>();
  for (const r of rows) {
    const k = key(r);
    const acc = map.get(k) ?? { montante_mwh: 0, custo: 0 };
    acc.montante_mwh += r.montante_mwh;
    acc.custo += r.montante_mwh * r.preco_pld;
    map.set(k, acc);
  }
  return [...map.entries()].map(([k, v]) => ({ key: k, montante_mwh: round(v.montante_mwh), custo: round(v.custo, 2) }));
}

// ───────────── CSV ─────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
      } else if (c === delim && !quoted) {
        out.push(cur.trim()); cur = "";
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const header = split(lines[0]);
  return lines.slice(1).map((l) => {
    const cols = split(l);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
  });
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

// ───────────── rotas ─────────────

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$",
  );
  routes.push({ method, pattern, keys, handler });
}

const created = (body: unknown) => ({ __status: 201, body });
const noContent = () => ({ __status: 204, body: null });

route("GET", "/healthz", () => ({ status: "ok" }));

// Auth
route("POST", "/auth/login", ({ body }) => {
  const { email, senha } = body ?? {};
  if (!email || !senha) throw new HttpError(400, "E-mail e senha são obrigatórios.");
  const d = load();
  const u = d.usuarios.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
  if (!u || u.senha !== senha) throw new HttpError(401, "Credenciais inválidas.");
  if (u.status === "inativo" || u.status === "recusado") throw new HttpError(403, "Acesso bloqueado.");
  const empresa = d.empresas.find((e) => e.id === u.empresa_id) ?? null;
  return { token: makeToken(u), refresh_token: makeToken(u), usuario: safeUser(u), empresa, perfil: u.perfil };
});

route("POST", "/auth/register/gestor", ({ body }) => {
  const { nome, cpf, email, telefone, senha, razao_social, cnpj, setor_atividade, tipo_plano } = body ?? {};
  if (!nome || !email || !senha || !razao_social || !cnpj)
    throw new HttpError(400, "Campos obrigatórios: nome, email, senha, razao_social, cnpj.");
  const d = load();
  if (d.usuarios.some((x) => x.email.toLowerCase() === String(email).toLowerCase()))
    throw new HttpError(409, "E-mail já cadastrado.");
  const empresa = {
    id: nextId("empresas"), razao_social, cnpj, setor: setor_atividade ?? null,
    demanda_contratada_kw: null, distribuidora: null, tipo_plano: tipo_plano ?? "mercado_livre", created_at: now(),
  };
  d.empresas.push(empresa);
  const usuario: DbUsuario = {
    id: nextId("usuarios"), nome, email, cpf: cpf ?? "", telefone: telefone ?? "", senha,
    perfil: "gestor_principal", status: "ativo", empresa_id: empresa.id, created_at: now(),
  };
  d.usuarios.push(usuario);
  save();
  return created({ usuario: safeUser(usuario), empresa, token: makeToken(usuario), refresh_token: makeToken(usuario) });
});

route("POST", "/auth/register/colaborador", ({ body }) => {
  const { nome, cpf, email, telefone, senha, empresa_id } = body ?? {};
  if (!nome || !email || !senha || !empresa_id)
    throw new HttpError(400, "Campos obrigatórios: nome, email, senha, empresa_id.");
  const d = load();
  if (d.usuarios.some((x) => x.email.toLowerCase() === String(email).toLowerCase()))
    throw new HttpError(409, "E-mail já cadastrado.");
  const usuario: DbUsuario = {
    id: nextId("usuarios"), nome, email, cpf: cpf ?? "", telefone: telefone ?? "", senha,
    perfil: "colaborador", status: "pendente", empresa_id: Number(empresa_id), created_at: now(),
  };
  d.usuarios.push(usuario);
  save();
  return created({ usuario: safeUser(usuario), status: "pendente" });
});

route("POST", "/auth/refresh", ({ body }) => {
  const u = readToken(`Bearer ${body?.refresh_token ?? ""}`);
  if (!u) throw new HttpError(401, "Refresh token inválido.");
  const usuario = load().usuarios.find((x) => x.id === u.sub)!;
  return { token: makeToken(usuario) };
});

route("POST", "/auth/logout", () => ({ ok: true }));

// Empresas
route("GET", "/empresas", () => load().empresas);
route("GET", "/empresas/:id", ({ params }) => {
  const e = load().empresas.find((x) => x.id === Number(params.id));
  if (!e) throw new HttpError(404, "Empresa não encontrada");
  return e;
});
route("POST", "/empresas", ({ body }) => {
  const { razao_social, cnpj, setor, demanda_contratada_kw, distribuidora, tipo_plano } = body ?? {};
  if (!razao_social || !cnpj) throw new HttpError(400, "razao_social e cnpj são obrigatórios");
  const e = {
    id: nextId("empresas"), razao_social, cnpj, setor: setor ?? null,
    demanda_contratada_kw: demanda_contratada_kw != null && demanda_contratada_kw !== "" ? Number(demanda_contratada_kw) : null,
    distribuidora: distribuidora ?? null, tipo_plano: tipo_plano ?? "mercado_livre", created_at: now(),
  };
  load().empresas.push(e);
  save();
  return created(e);
});
route("PATCH", "/empresas/:id", ({ params, body }) => {
  const e = load().empresas.find((x) => x.id === Number(params.id));
  if (!e) throw new HttpError(404, "Empresa não encontrada");
  for (const k of ["razao_social", "cnpj", "setor", "distribuidora", "tipo_plano"] as const) {
    if (body?.[k] !== undefined) (e as any)[k] = body[k];
  }
  if (body?.demanda_contratada_kw !== undefined)
    e.demanda_contratada_kw = body.demanda_contratada_kw === null || body.demanda_contratada_kw === "" ? null : Number(body.demanda_contratada_kw);
  save();
  return e;
});
route("DELETE", "/empresas/:id", ({ params }) => {
  const d = load();
  const i = d.empresas.findIndex((x) => x.id === Number(params.id));
  if (i < 0) throw new HttpError(404, "Empresa não encontrada");
  d.empresas.splice(i, 1);
  save();
  return noContent();
});

// Dashboard
route("GET", "/dashboard", ({ query }) => {
  const id = query.get("id_empresa");
  const q = new URLSearchParams(id ? { id_empresa: id } : {});
  const rows = consumoFiltrado(q);
  const total_montante = rows.reduce((s, r) => s + r.montante_mwh, 0);
  const total_custo = rows.reduce((s, r) => s + r.montante_mwh * r.preco_pld, 0);
  const bySub = groupSum(rows, (r) => r.submercado).sort((a, b) => b.montante_mwh - a.montante_mwh);
  const byTipo = groupSum(rows, (r) => r.tipo_operacao).sort((a, b) => b.montante_mwh - a.montante_mwh);
  const byDia = groupSum(rows, (r) => r.data).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 90);
  return {
    kpis: {
      total_montante_mwh: round(total_montante),
      total_custo: round(total_custo, 2),
      total_registros: rows.length,
      total_empresas: load().empresas.length,
    },
    por_submercado: bySub.map((r) => ({ submercado: r.key, montante_mwh: r.montante_mwh, custo: r.custo })),
    por_tipo_operacao: byTipo.map((r) => ({ tipo_operacao: r.key, montante_mwh: r.montante_mwh, custo: r.custo })),
    serie_temporal: byDia.map((r) => ({ data: r.key, montante_mwh: r.montante_mwh, custo: r.custo })),
  };
});

// Diagnóstico
route("GET", "/diagnostico", ({ query }) => {
  const id = query.get("id_empresa");
  const rows = consumoFiltrado(new URLSearchParams(id ? { id_empresa: id } : {}));
  const datas = rows.map((r) => r.data).sort();
  const diagnosticos: unknown[] = [];
  if (rows.length) {
    const porDiaEmp = groupSum(rows, (r) => `${r.data}|${r.nome_empresa}`);
    const maiorConsumo = [...porDiaEmp].sort((a, b) => b.montante_mwh - a.montante_mwh)[0];
    const maiorCusto = [...porDiaEmp].sort((a, b) => b.custo - a.custo)[0];
    const sub = groupSum(rows, (r) => r.submercado).sort((a, b) => b.montante_mwh - a.montante_mwh)[0];
    const tipo = groupSum(rows, (r) => r.tipo_operacao).sort((a, b) => b.montante_mwh - a.montante_mwh)[0];
    const [d1, e1] = maiorConsumo.key.split("|");
    const [d2, e2] = maiorCusto.key.split("|");
    diagnosticos.push(
      { tipo: "maior_dia_consumo", descricao: "Maior dia de consumo de energia", valor: maiorConsumo.montante_mwh.toFixed(4), unidade: "MWh", data: d1, empresa: e1 },
      { tipo: "maior_dia_custo", descricao: "Maior dia de custo energético", valor: maiorCusto.custo.toFixed(2), unidade: "R$", data: d2, empresa: e2 },
      { tipo: "maior_submercado", descricao: "Submercado com maior consumo total", valor: sub.montante_mwh.toFixed(4), unidade: "MWh", data: null, empresa: sub.key },
      { tipo: "maior_tipo_operacao", descricao: "Tipo de operação com maior consumo total", valor: tipo.montante_mwh.toFixed(4), unidade: "MWh", data: null, empresa: tipo.key },
    );
  }
  return {
    resumo: {
      total_registros: rows.length,
      periodo_inicio: datas[0] ?? null,
      periodo_fim: datas[datas.length - 1] ?? null,
      total_empresas: new Set(rows.map((r) => r.id_empresa)).size,
    },
    diagnosticos,
  };
});

// Consumo horário
route("GET", "/consumo-horario", ({ query }) => {
  const page = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.get("limit") ?? "50", 10) || 50));
  const rows = consumoFiltrado(query)
    .slice()
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const total = rows.length;
  return {
    registros: rows.slice((page - 1) * limit, page * limit),
    resumo: {
      total_montante_mwh: round(rows.reduce((s, r) => s + r.montante_mwh, 0)),
      total_custo: round(rows.reduce((s, r) => s + r.montante_mwh * r.preco_pld, 0), 2),
      count: total,
    },
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
});

// Upload CSV
route("POST", "/upload-csv", async ({ body }) => {
  const file = body instanceof FormData ? body.get("file") : null;
  if (!(file instanceof Blob)) return { processadas: 0, erros: ["Nenhum arquivo enviado"], status: "erro" };
  const rows = parseCsv(await file.text());
  const d = load();
  const erros: string[] = [];
  let processadas = 0;
  rows.forEach((row, i) => {
    const linha = i + 2;
    const data = parseDate(row.Data);
    const idEmpresa = parseInt(row.ID_Empresa, 10);
    const montante = parseFloat((row.MontanteMWh ?? "").replace(",", "."));
    const preco = parseFloat((row["PrecoPLD_R$"] ?? "").replace(",", "."));
    if (!data) return void erros.push(`Linha ${linha}: data inválida "${row.Data}"`);
    if (isNaN(idEmpresa)) return void erros.push(`Linha ${linha}: ID_Empresa inválido "${row.ID_Empresa}"`);
    if (isNaN(montante) || isNaN(preco)) return void erros.push(`Linha ${linha}: valores numéricos inválidos`);
    d.consumo.push({
      id: nextId("consumo"), data, hora: row.Hora || "00:00", id_empresa: idEmpresa,
      nome_empresa: row.NomeEmpresa ?? "", tipo_operacao: row.TipoOperacao ?? "",
      montante_mwh: montante, preco_pld: preco, submercado: row.Submercado ?? "",
    });
    processadas++;
  });
  save();
  return { processadas, erros: erros.slice(0, 20), status: erros.length === 0 ? "sucesso" : processadas > 0 ? "parcial" : "erro" };
});

// BESS
route("GET", "/bess", ({ query }) => {
  const id = query.get("empresa_id");
  const all = load().bess;
  return id ? all.filter((b) => b.empresa_id === Number(id)) : all;
});
route("GET", "/bess/:id", ({ params }) => {
  const b = load().bess.find((x) => x.id === Number(params.id));
  if (!b) throw new HttpError(404, "Unidade BESS não encontrada");
  return b;
});
const BESS_FIELDS = [
  "empresa_id", "nome_unidade", "localizacao", "tipo_bess", "fabricante_bms", "fabricante_inversor",
  "protocolo_comunicacao", "gateway_iot", "broker_mensageria", "frequencia_coleta_segundos",
  "variaveis_monitoradas", "status_integracao", "observacoes",
] as const;
route("POST", "/bess", ({ body }) => {
  if (!body?.empresa_id || !body?.nome_unidade || !body?.tipo_bess)
    throw new HttpError(400, "empresa_id, nome_unidade e tipo_bess são obrigatórios");
  const b: any = { id: nextId("bess"), created_at: now() };
  for (const k of BESS_FIELDS) b[k] = body[k] ?? null;
  b.empresa_id = Number(body.empresa_id);
  b.variaveis_monitoradas = body.variaveis_monitoradas ?? [];
  b.status_integracao = body.status_integracao ?? "Não integrado";
  b.frequencia_coleta_segundos = body.frequencia_coleta_segundos ? Number(body.frequencia_coleta_segundos) : null;
  load().bess.push(b);
  save();
  return created(b);
});
route("PATCH", "/bess/:id", ({ params, body }) => {
  const b: any = load().bess.find((x) => x.id === Number(params.id));
  if (!b) throw new HttpError(404, "Unidade BESS não encontrada");
  for (const k of BESS_FIELDS) if (body?.[k] !== undefined) b[k] = body[k];
  save();
  return b;
});
route("DELETE", "/bess/:id", ({ params }) => {
  const d = load();
  const i = d.bess.findIndex((x) => x.id === Number(params.id));
  if (i < 0) throw new HttpError(404, "Unidade BESS não encontrada");
  d.bess.splice(i, 1);
  save();
  return noContent();
});

// Setores
route("GET", "/setores", (ctx) => {
  const emp = requireEmpresa(requireAuth(ctx));
  return load().setores.filter((s) => s.empresa_id === emp);
});
route("POST", "/setores", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const { nome, categoria, descricao } = ctx.body ?? {};
  if (!nome || !categoria) throw new HttpError(400, "nome e categoria são obrigatórios.");
  const s = { id: nextId("setores"), empresa_id: emp, nome, categoria, descricao: descricao ?? null, created_at: now() };
  load().setores.push(s);
  save();
  return created(s);
});
route("PUT", "/setores/:id", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const s = load().setores.find((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
  if (!s) throw new HttpError(404, "Setor não encontrado.");
  const { nome, categoria, descricao } = ctx.body ?? {};
  if (nome) s.nome = nome;
  if (categoria) s.categoria = categoria;
  if (descricao !== undefined) s.descricao = descricao;
  save();
  return s;
});
route("DELETE", "/setores/:id", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const d = load();
  const i = d.setores.findIndex((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
  if (i < 0) throw new HttpError(404, "Setor não encontrado.");
  d.setores.splice(i, 1);
  save();
  return { ok: true };
});

// Máquinas
route("GET", "/maquinas", (ctx) => {
  const emp = requireEmpresa(requireAuth(ctx));
  const setor = ctx.query.get("setor_id");
  return load().maquinas.filter((m) => m.empresa_id === emp && (!setor || m.setor_id === Number(setor)));
});
route("GET", "/maquinas/:id", (ctx) => {
  const emp = requireEmpresa(requireAuth(ctx));
  const m = load().maquinas.find((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
  if (!m) throw new HttpError(404, "Máquina não encontrada.");
  return m;
});
route("POST", "/maquinas", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const b = ctx.body ?? {};
  if (!b.nome || !b.tipo_equipamento || !b.setor_id || !b.potencia_kw || !b.horario_inicio || !b.horario_fim)
    throw new HttpError(400, "Campos obrigatórios incompletos.");
  const m = {
    id: nextId("maquinas"), empresa_id: emp, nome: b.nome, tipo_equipamento: b.tipo_equipamento,
    setor_id: Number(b.setor_id), potencia_kw: Number(b.potencia_kw), horario_inicio: b.horario_inicio,
    horario_fim: b.horario_fim, dias_semana: b.dias_semana ?? [], marca: b.marca ?? null, modelo: b.modelo ?? null,
    ano_fabricacao: b.ano_fabricacao ? Number(b.ano_fabricacao) : null, observacoes: b.observacoes ?? null,
    status: b.status ?? "ativo", confirmacoes_ia: 0, created_at: now(),
  };
  load().maquinas.push(m);
  save();
  return created(m);
});
route("PUT", "/maquinas/:id", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const m: any = load().maquinas.find((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
  if (!m) throw new HttpError(404, "Máquina não encontrada.");
  const b = ctx.body ?? {};
  for (const k of ["nome", "tipo_equipamento", "horario_inicio", "horario_fim", "dias_semana", "status"]) if (b[k]) m[k] = b[k];
  for (const k of ["marca", "modelo", "observacoes"]) if (b[k] !== undefined) m[k] = b[k];
  if (b.setor_id) m.setor_id = Number(b.setor_id);
  if (b.potencia_kw !== undefined) m.potencia_kw = Number(b.potencia_kw);
  if (b.ano_fabricacao !== undefined) m.ano_fabricacao = b.ano_fabricacao ? Number(b.ano_fabricacao) : null;
  save();
  return m;
});
route("DELETE", "/maquinas/:id", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const d = load();
  const i = d.maquinas.findIndex((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
  if (i < 0) throw new HttpError(404, "Máquina não encontrada.");
  d.maquinas.splice(i, 1);
  save();
  return { ok: true };
});

// Contrato
route("GET", "/contrato", (ctx) => {
  const emp = requireEmpresa(requireAuth(ctx));
  const c = load().contratos.find((x) => x.empresa_id === emp);
  if (!c) throw new HttpError(404, "Contrato não configurado.");
  return c;
});
function aplicarContrato(c: any, b: any) {
  if (b.preco_mwh != null && b.preco_mwh !== "") c.preco_mwh = Number(b.preco_mwh);
  if (b.modalidade_tarifaria) c.modalidade_tarifaria = b.modalidade_tarifaria;
  if (b.tipo_energia) c.tipo_energia = b.tipo_energia;
  if (b.flexibilidade_pct != null && b.flexibilidade_pct !== "") c.flexibilidade_pct = Number(b.flexibilidade_pct);
  if (b.demanda_ponta_kw != null && b.demanda_ponta_kw !== "") c.demanda_ponta_kw = Number(b.demanda_ponta_kw);
  if (b.demanda_fora_ponta_kw != null && b.demanda_fora_ponta_kw !== "") c.demanda_fora_ponta_kw = Number(b.demanda_fora_ponta_kw);
  if (b.possui_irec != null) c.possui_irec = b.possui_irec === true || b.possui_irec === "true";
  if (b.meta_esg_pct != null && b.meta_esg_pct !== "") c.meta_esg_pct = Number(b.meta_esg_pct);
  if (b.sazonalidade) c.sazonalidade = b.sazonalidade;
  c.updated_at = now();
}
route("POST", "/contrato", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const b = ctx.body ?? {};
  if (!b.preco_mwh || !b.modalidade_tarifaria || !b.tipo_energia || !b.demanda_ponta_kw || !b.demanda_fora_ponta_kw)
    throw new HttpError(400, "Campos obrigatórios incompletos.");
  const d = load();
  if (d.contratos.some((x) => x.empresa_id === emp)) throw new HttpError(409, "Contrato já existe. Use PUT para atualizar.");
  const c: any = { id: nextId("contratos"), empresa_id: emp, flexibilidade_pct: 5, possui_irec: false, meta_esg_pct: null, sazonalidade: {}, created_at: now() };
  aplicarContrato(c, b);
  d.contratos.push(c);
  save();
  return created(c);
});
route("PUT", "/contrato", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  const c = load().contratos.find((x) => x.empresa_id === emp);
  if (!c) throw new HttpError(404, "Contrato não encontrado.");
  aplicarContrato(c, ctx.body ?? {});
  save();
  return c;
});

// Usuários
route("GET", "/usuarios", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal", "admin_effio"));
  return load().usuarios
    .filter((u) => u.empresa_id === emp)
    .map(({ id, nome, email, perfil, status, created_at }) => ({ id, nome, email, perfil, status, created_at }));
});
route("GET", "/usuarios/pendentes", (ctx) => {
  const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
  return load().usuarios
    .filter((u) => u.empresa_id === emp && u.status === "pendente")
    .map(({ id, nome, email, telefone, created_at }) => ({ id, nome, email, telefone, created_at }));
});
for (const [acao, status] of [["aprovar", "ativo"], ["recusar", "recusado"], ["inativar", "inativo"]] as const) {
  route("PUT", `/usuarios/:id/${acao}`, (ctx) => {
    const emp = requireEmpresa(requirePerfil(ctx, "gestor_principal"));
    const u = load().usuarios.find((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
    if (!u) throw new HttpError(404, "Usuário não encontrado.");
    u.status = status;
    save();
    return safeUser(u);
  });
}

// Chat
route("GET", "/chat/chamados", (ctx) => {
  const u = requireAuth(ctx);
  const emp = requireEmpresa(u);
  const gestor = u.perfil === "gestor_principal" || u.perfil === "admin_effio";
  return load().chamados.filter(
    (c) => c.empresa_id === emp && (gestor || c.aberto_por === u.sub || c.destinado_a === u.sub),
  );
});
route("POST", "/chat/chamados", (ctx) => {
  const u = requireAuth(ctx);
  const emp = requireEmpresa(u);
  const { destinado_a, titulo, setor_id, alerta_id } = ctx.body ?? {};
  if (!destinado_a || !titulo) throw new HttpError(400, "destinado_a e titulo são obrigatórios.");
  const c = {
    id: nextId("chamados"), empresa_id: emp, aberto_por: u.sub, destinado_a: Number(destinado_a), titulo,
    status: "aberto", setor_id: setor_id ? Number(setor_id) : null, alerta_id: alerta_id ? Number(alerta_id) : null,
    created_at: now(), resolvido_em: null,
  };
  load().chamados.push(c);
  save();
  return created(c);
});
route("PUT", "/chat/chamados/:id/status", (ctx) => {
  const emp = requireEmpresa(requireAuth(ctx));
  const { status } = ctx.body ?? {};
  if (!["aberto", "em_andamento", "resolvido"].includes(status)) throw new HttpError(400, "Status inválido.");
  const c = load().chamados.find((x) => x.id === Number(ctx.params.id) && x.empresa_id === emp);
  if (!c) throw new HttpError(404, "Chamado não encontrado.");
  c.status = status;
  if (status === "resolvido") c.resolvido_em = now();
  save();
  return c;
});
route("GET", "/chat/chamados/:id/mensagens", (ctx) => {
  const emp = requireEmpresa(requireAuth(ctx));
  const d = load();
  const id = Number(ctx.params.id);
  if (!d.chamados.some((c) => c.id === id && c.empresa_id === emp)) throw new HttpError(404, "Chamado não encontrado.");
  return d.mensagens
    .filter((m) => m.chamado_id === id)
    .map((m) => ({
      id: m.id, conteudo: m.conteudo, confirma_maquina_id: m.confirma_maquina_id, created_at: m.created_at,
      autor_nome: d.usuarios.find((u) => u.id === m.autor_id)?.nome ?? null, autor_id: m.autor_id,
    }));
});
route("POST", "/chat/chamados/:id/mensagens", (ctx) => {
  const u = requireAuth(ctx);
  const emp = requireEmpresa(u);
  const d = load();
  const id = Number(ctx.params.id);
  const { conteudo, confirma_maquina_id } = ctx.body ?? {};
  if (!conteudo) throw new HttpError(400, "conteudo é obrigatório.");
  if (!d.chamados.some((c) => c.id === id && c.empresa_id === emp)) throw new HttpError(404, "Chamado não encontrado.");
  const m = {
    id: nextId("mensagens"), chamado_id: id, autor_id: u.sub, conteudo,
    confirma_maquina_id: confirma_maquina_id ? Number(confirma_maquina_id) : null, created_at: now(),
  };
  d.mensagens.push(m);
  if (m.confirma_maquina_id) {
    const maq = d.maquinas.find((x) => x.id === m.confirma_maquina_id && x.empresa_id === emp);
    if (maq) maq.confirmacoes_ia += 1;
  }
  save();
  return created(m);
});

// ───────────── entrada ─────────────

export async function handleMockRequest(url: URL, init: RequestInit | undefined, request?: Request): Promise<Response> {
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const headers = new Headers(init?.headers ?? request?.headers);

  let body: any = init?.body ?? null;
  if (body == null && request && method !== "GET" && method !== "HEAD") {
    const ct = request.headers.get("content-type") ?? "";
    body = ct.includes("multipart/form-data") ? await request.formData() : await request.text();
  }
  if (typeof body === "string") {
    try { body = body ? JSON.parse(body) : null; } catch { /* corpo não-JSON */ }
  }

  // pequena latência para parecer uma API de verdade
  await new Promise((r) => setTimeout(r, 120));

  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.pattern);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    try {
      const out: any = await r.handler({
        method, path, query: url.searchParams, params, body,
        user: readToken(headers.get("Authorization")),
      });
      if (out && typeof out === "object" && "__status" in out) return json(out.body, out.__status);
      return json(out);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("[EFFIO demo]", e);
      return json({ error: "Erro interno no modo demo." }, 500);
    }
  }
  return json({ error: `Rota não disponível no modo demo: ${method} /api${path}` }, 404);
}
