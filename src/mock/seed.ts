/** Dados de demonstração do modo demo. Nada aqui vai para servidor nenhum. */

export interface DbUsuario {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  senha: string;
  perfil: "gestor_principal" | "colaborador" | "admin_effio";
  status: "ativo" | "pendente" | "recusado" | "inativo";
  empresa_id: number | null;
  created_at: string;
}

export interface DbEmpresa {
  id: number;
  razao_social: string;
  cnpj: string;
  setor: string | null;
  demanda_contratada_kw: number | null;
  distribuidora: string | null;
  tipo_plano: string;
  created_at: string;
}

export interface DbSetor {
  id: number;
  empresa_id: number;
  nome: string;
  categoria: string;
  descricao: string | null;
  created_at: string;
}

export interface DbMaquina {
  id: number;
  empresa_id: number;
  setor_id: number;
  nome: string;
  tipo_equipamento: string;
  potencia_kw: number;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: string[];
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: number | null;
  observacoes: string | null;
  status: string;
  confirmacoes_ia: number;
  created_at: string;
}

export interface DbContrato {
  id: number;
  empresa_id: number;
  preco_mwh: number;
  modalidade_tarifaria: string;
  tipo_energia: string;
  flexibilidade_pct: number;
  demanda_ponta_kw: number;
  demanda_fora_ponta_kw: number;
  possui_irec: boolean;
  meta_esg_pct: number | null;
  sazonalidade: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface DbBess {
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

export interface DbConsumo {
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

export interface DbChamado {
  id: number;
  empresa_id: number;
  aberto_por: number;
  destinado_a: number;
  titulo: string;
  status: string;
  setor_id: number | null;
  alerta_id: number | null;
  created_at: string;
  resolvido_em: string | null;
}

export interface DbMensagem {
  id: number;
  chamado_id: number;
  autor_id: number;
  conteudo: string;
  confirma_maquina_id: number | null;
  created_at: string;
}

export interface Db {
  version: number;
  seq: Record<string, number>;
  usuarios: DbUsuario[];
  empresas: DbEmpresa[];
  setores: DbSetor[];
  maquinas: DbMaquina[];
  contratos: DbContrato[];
  bess: DbBess[];
  consumo: DbConsumo[];
  chamados: DbChamado[];
  mensagens: DbMensagem[];
}

export const DEMO_EMAIL = "demo@effio.com.br";
export const DEMO_SENHA = "effio123";

// Gerador pseudoaleatório determinístico (os mesmos dados toda vez)
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function isoDaysAgo(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function gerarConsumo(): DbConsumo[] {
  const rand = rng(42);
  const rows: DbConsumo[] = [];
  const perfis = [
    { id: 1, nome: "Metalúrgica Horizonte Ltda", sub: "SE/CO", base: 1.6 },
    { id: 2, nome: "Frigorífico Vale Verde S.A.", sub: "S", base: 1.1 },
  ];
  let id = 1;
  const DIAS = 30;
  for (let dia = DIAS - 1; dia >= 0; dia--) {
    const d = new Date();
    d.setDate(d.getDate() - dia);
    const data = dateOnly(d);
    const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
    const pldDia = 90 + rand() * 260; // R$/MWh
    for (const p of perfis) {
      for (let h = 0; h < 24; h++) {
        const ponta = h >= 18 && h <= 20;
        const turno = h >= 6 && h <= 22 ? 1 : 0.45;
        const carga = p.base * turno * (fimDeSemana ? 0.55 : 1) * (0.85 + rand() * 0.3);
        const pld = pldDia * (ponta ? 1.6 : h >= 10 && h <= 16 ? 0.8 : 1) * (0.9 + rand() * 0.2);
        rows.push({
          id: id++,
          data,
          hora: `${String(h).padStart(2, "0")}:00`,
          id_empresa: p.id,
          nome_empresa: p.nome,
          tipo_operacao: ponta ? "Consumo Ponta" : "Consumo Fora Ponta",
          montante_mwh: Number(carga.toFixed(4)),
          preco_pld: Number(pld.toFixed(2)),
          submercado: p.sub,
        });
      }
    }
  }
  return rows;
}

export function criarSeed(): Db {
  const consumo = gerarConsumo();
  return {
    version: 1,
    seq: {
      usuarios: 4, empresas: 3, setores: 4, maquinas: 5, contratos: 1,
      bess: 3, consumo: consumo.length, chamados: 1, mensagens: 3,
    },
    usuarios: [
      { id: 1, nome: "Ana Gestora", email: DEMO_EMAIL, cpf: "", telefone: "(11) 99999-0000", senha: DEMO_SENHA, perfil: "gestor_principal", status: "ativo", empresa_id: 1, created_at: isoDaysAgo(60) },
      { id: 2, nome: "Carlos Souza", email: "carlos@effio.com.br", cpf: "", telefone: "(11) 98888-1111", senha: DEMO_SENHA, perfil: "colaborador", status: "ativo", empresa_id: 1, created_at: isoDaysAgo(40) },
      { id: 3, nome: "Mariana Lima", email: "mariana@effio.com.br", cpf: "", telefone: "(11) 97777-2222", senha: DEMO_SENHA, perfil: "colaborador", status: "pendente", empresa_id: 1, created_at: isoDaysAgo(2) },
      { id: 4, nome: "Rafael Torres", email: "rafael@effio.com.br", cpf: "", telefone: "(11) 96666-3333", senha: DEMO_SENHA, perfil: "colaborador", status: "pendente", empresa_id: 1, created_at: isoDaysAgo(1) },
    ],
    empresas: [
      { id: 1, razao_social: "Metalúrgica Horizonte Ltda", cnpj: "12.345.678/0001-90", setor: "Metalurgia", demanda_contratada_kw: 2500, distribuidora: "Enel SP", tipo_plano: "completo", created_at: isoDaysAgo(60) },
      { id: 2, razao_social: "Frigorífico Vale Verde S.A.", cnpj: "98.765.432/0001-10", setor: "Alimentos", demanda_contratada_kw: 1800, distribuidora: "Copel", tipo_plano: "mercado_livre", created_at: isoDaysAgo(50) },
      { id: 3, razao_social: "Têxtil Aurora Ltda", cnpj: "45.678.901/0001-23", setor: "Têxtil", demanda_contratada_kw: 900, distribuidora: "Cemig", tipo_plano: "bess", created_at: isoDaysAgo(30) },
    ],
    setores: [
      { id: 1, empresa_id: 1, nome: "Usinagem", categoria: "Produção", descricao: "Tornos e centros de usinagem CNC", created_at: isoDaysAgo(55) },
      { id: 2, empresa_id: 1, nome: "Fundição", categoria: "Produção", descricao: "Fornos de indução", created_at: isoDaysAgo(55) },
      { id: 3, empresa_id: 1, nome: "Utilidades", categoria: "Utilidades", descricao: "Compressores e climatização", created_at: isoDaysAgo(55) },
      { id: 4, empresa_id: 1, nome: "Administrativo", categoria: "Administrativo", descricao: null, created_at: isoDaysAgo(55) },
    ],
    maquinas: [
      { id: 1, empresa_id: 1, setor_id: 1, nome: "Centro de Usinagem CNC 01", tipo_equipamento: "CNC", potencia_kw: 45, horario_inicio: "06:00", horario_fim: "22:00", dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"], marca: "Romi", modelo: "D 800", ano_fabricacao: 2019, observacoes: null, status: "ativo", confirmacoes_ia: 3, created_at: isoDaysAgo(50) },
      { id: 2, empresa_id: 1, setor_id: 1, nome: "Torno CNC 02", tipo_equipamento: "Torno", potencia_kw: 22, horario_inicio: "06:00", horario_fim: "14:00", dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"], marca: "Romi", modelo: "GL 240", ano_fabricacao: 2017, observacoes: null, status: "ativo", confirmacoes_ia: 1, created_at: isoDaysAgo(50) },
      { id: 3, empresa_id: 1, setor_id: 2, nome: "Forno de Indução", tipo_equipamento: "Forno", potencia_kw: 350, horario_inicio: "07:00", horario_fim: "17:00", dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"], marca: "Inductotherm", modelo: "VIP", ano_fabricacao: 2015, observacoes: "Evitar operar no horário de ponta", status: "ativo", confirmacoes_ia: 5, created_at: isoDaysAgo(50) },
      { id: 4, empresa_id: 1, setor_id: 3, nome: "Compressor de Ar 01", tipo_equipamento: "Compressor", potencia_kw: 75, horario_inicio: "00:00", horario_fim: "23:59", dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"], marca: "Atlas Copco", modelo: "GA 75", ano_fabricacao: 2020, observacoes: null, status: "ativo", confirmacoes_ia: 0, created_at: isoDaysAgo(50) },
      { id: 5, empresa_id: 1, setor_id: 3, nome: "Chiller Central", tipo_equipamento: "Climatização", potencia_kw: 120, horario_inicio: "08:00", horario_fim: "18:00", dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"], marca: "Carrier", modelo: "30XA", ano_fabricacao: 2018, observacoes: null, status: "manutencao", confirmacoes_ia: 0, created_at: isoDaysAgo(50) },
    ],
    contratos: [
      { id: 1, empresa_id: 1, preco_mwh: 245.5, modalidade_tarifaria: "TH_AZUL", tipo_energia: "I50", flexibilidade_pct: 10, demanda_ponta_kw: 2200, demanda_fora_ponta_kw: 2500, possui_irec: true, meta_esg_pct: 80, sazonalidade: {}, created_at: isoDaysAgo(45), updated_at: isoDaysAgo(45) },
    ],
    bess: [
      { id: 1, empresa_id: 1, nome_unidade: "BESS Galpão A", localizacao: "Guarulhos - SP", tipo_bess: "Íon-lítio", fabricante_bms: "BYD", fabricante_inversor: "SMA", protocolo_comunicacao: "Modbus TCP", gateway_iot: "Moxa UC-8100", broker_mensageria: "MQTT", frequencia_coleta_segundos: 60, variaveis_monitoradas: ["SOC", "SOH", "Temperatura", "Tensão", "Corrente"], status_integracao: "Integrado", observacoes: null, created_at: isoDaysAgo(40) },
      { id: 2, empresa_id: 1, nome_unidade: "BESS Subestação", localizacao: "Guarulhos - SP", tipo_bess: "Íon-lítio", fabricante_bms: "CATL", fabricante_inversor: "WEG", protocolo_comunicacao: "CANBus", gateway_iot: null, broker_mensageria: null, frequencia_coleta_segundos: 300, variaveis_monitoradas: ["SOC", "Temperatura"], status_integracao: "Em análise", observacoes: "Aguardando liberação de rede", created_at: isoDaysAgo(20) },
      { id: 3, empresa_id: 3, nome_unidade: "BESS Aurora 01", localizacao: "Juiz de Fora - MG", tipo_bess: "Chumbo-ácido", fabricante_bms: null, fabricante_inversor: null, protocolo_comunicacao: null, gateway_iot: null, broker_mensageria: null, frequencia_coleta_segundos: null, variaveis_monitoradas: [], status_integracao: "Não integrado", observacoes: null, created_at: isoDaysAgo(10) },
    ],
    consumo,
    chamados: [
      { id: 1, empresa_id: 1, aberto_por: 1, destinado_a: 2, titulo: "Forno de indução ligado na ponta", status: "em_andamento", setor_id: 2, alerta_id: null, created_at: isoDaysAgo(3), resolvido_em: null },
    ],
    mensagens: [
      { id: 1, chamado_id: 1, autor_id: 1, conteudo: "Carlos, o forno apareceu ligado entre 18h e 20h ontem. Pode verificar?", confirma_maquina_id: null, created_at: isoDaysAgo(3, 9) },
      { id: 2, chamado_id: 1, autor_id: 2, conteudo: "Verifiquei: era uma ordem urgente. Vou reprogramar para amanhã cedo.", confirma_maquina_id: 3, created_at: isoDaysAgo(3, 11) },
      { id: 3, chamado_id: 1, autor_id: 1, conteudo: "Perfeito, obrigada!", confirma_maquina_id: null, created_at: isoDaysAgo(2, 8) },
    ],
  };
}
