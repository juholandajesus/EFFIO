import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/context/auth-context";
import { plantFor } from "./plants";
import type { RegisteredMachine } from "./attribution";
import type { AgentAction } from "./copilot";

/** The register from the plant definition (used before login, e.g. on the landing page). */
export function defaultRegister(empresaId: number): RegisteredMachine[] {
  return (plantFor(empresaId)?.machines ?? []).map((m) => ({
    id: m.id,
    nome: m.name,
    setor_id: m.sectorId,
    tipo_equipamento: m.type,
    potencia_kw: m.kw,
    horario_inicio: m.start,
    horario_fim: m.end,
    dias_semana: m.days,
    status: "ativo",
    confirmacoes_ia: 0,
  }));
}

/** The client's machine register, live from the Machines screen (with confirmations). */
export function useMachines(empresaId: number | null) {
  const { data } = useQuery<RegisteredMachine[]>({
    queryKey: ["maquinas"],
    enabled: !!empresaId,
    queryFn: async () => {
      const res = await fetch("/api/maquinas", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });
  return data && data.length ? data : empresaId ? defaultRegister(empresaId) : [];
}

export interface Ticket {
  id: number;
  titulo: string;
  status: string;
  destinado_a: number;
  anomalia_id?: string | null;
  suspeitos?: { maquina_id: number; nome: string; prob: number }[] | null;
  confirmado_maquina_id?: number | null;
}

export function useTickets(enabled: boolean) {
  const { data } = useQuery<Ticket[]>({
    queryKey: ["chamados"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/chat/chamados", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    },
  });
  return data ?? [];
}

/**
 * Opens a ticket for the sector with Faísca's suspects, so the team can say
 * which machine it was. Goes to the first active team member (in a real
 * deployment: the person in charge of the suspect's sector).
 */
export async function requestConfirmation(action: AgentAction): Promise<{ ticketId: number; owner: string }> {
  const headers = { "Content-Type": "application/json", ...getAuthHeaders() };
  const users = await fetch("/api/usuarios", { headers }).then((r) => (r.ok ? r.json() : []));
  const owner = (users as { id: number; nome: string; perfil: string; status: string }[]).find((u) => u.perfil === "colaborador" && u.status === "ativo");
  if (!owner) throw new Error("no active team member");
  const res = await fetch("/api/chat/chamados", {
    method: "POST",
    headers,
    body: JSON.stringify({ destinado_a: owner.id, titulo: action.title, anomalia_id: action.anomalyId, suspeitos: action.suspects }),
  });
  const ticket = await res.json();
  if (!res.ok) throw new Error(ticket.error ?? res.statusText);
  await fetch(`/api/chat/chamados/${ticket.id}/mensagens`, { method: "POST", headers, body: JSON.stringify({ conteudo: action.body }) });
  return { ticketId: ticket.id, owner: owner.nome };
}

export function useInvalidateTickets() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["chamados"] });
    qc.invalidateQueries({ queryKey: ["maquinas"] });
  };
}
