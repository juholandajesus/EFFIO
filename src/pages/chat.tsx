import { useState, useRef, useEffect } from "react";
import { MessageSquare, Plus, Send, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Chamado {
  id: number;
  titulo: string;
  status: string;
  aberto_por: number;
  destinado_a: number;
  created_at: string;
}

interface Mensagem {
  id: number;
  conteudo: string;
  autor_id: number;
  autor_nome: string | null;
  created_at: string;
  confirma_maquina_id: number | null;
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: string;
}

const STATUS_COLORS: Record<string, string> = {
  aberto: "bg-amber-100 text-amber-800",
  em_andamento: "bg-blue-100 text-blue-800",
  resolvido: "bg-green-100 text-green-800",
};

export default function Chat() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [chamadoAtivo, setChamadoAtivo] = useState<Chamado | null>(null);
  const [openNovo, setOpenNovo] = useState(false);
  const [novoChamado, setNovoChamado] = useState({ titulo: "", destinado_a: "" });
  const [mensagem, setMensagem] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: chamados = [] } = useQuery<Chamado[]>({
    queryKey: ["chamados"],
    queryFn: async () => {
      const res = await fetch("/api/chat/chamados", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: mensagens = [] } = useQuery<Mensagem[]>({
    queryKey: ["mensagens", chamadoAtivo?.id],
    queryFn: async () => {
      if (!chamadoAtivo) return [];
      const res = await fetch(`/api/chat/chamados/${chamadoAtivo.id}/mensagens`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!chamadoAtivo,
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const criarChamado = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/chat/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ titulo: novoChamado.titulo, destinado_a: Number(novoChamado.destinado_a) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Chamado aberto!" });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      setOpenNovo(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const enviarMensagem = useMutation({
    mutationFn: async () => {
      if (!chamadoAtivo || !mensagem.trim()) return;
      const res = await fetch(`/api/chat/chamados/${chamadoAtivo.id}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ conteudo: mensagem.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      setMensagem("");
      qc.invalidateQueries({ queryKey: ["mensagens", chamadoAtivo?.id] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mudarStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!chamadoAtivo) return;
      const res = await fetch(`/api/chat/chamados/${chamadoAtivo.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      setChamadoAtivo(null);
    },
  });

  const usuarioNome = (id: number) => usuarios.find(u => u.id === id)?.nome ?? `#${id}`;

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <MessageSquare className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chat Interno</h1>
            <p className="text-sm text-muted-foreground">Chamados e comunicação entre equipes</p>
          </div>
        </div>
        <Button onClick={() => setOpenNovo(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Chamado
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 h-[calc(100%-5rem)]">
        <Card className="overflow-hidden">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm">Chamados ({chamados.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto h-full">
            {chamados.length === 0 ? (
              <p className="text-muted-foreground text-sm p-4 text-center">Nenhum chamado.</p>
            ) : (
              chamados.map(c => (
                <button key={c.id} onClick={() => setChamadoAtivo(c)}
                  className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${chamadoAtivo?.id === c.id ? "bg-muted" : ""}`}>
                  <p className="font-medium text-sm truncate">{c.titulo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] ?? ""}`}>{c.status.replace("_", " ")}</span>
                    <span className="text-xs text-muted-foreground truncate">→ {usuarioNome(c.destinado_a)}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 overflow-hidden flex flex-col">
          {!chamadoAtivo ? (
            <CardContent className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione um chamado para ver as mensagens</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="py-3 px-4 border-b flex-row items-center gap-3 space-y-0">
                <Button size="sm" variant="ghost" onClick={() => setChamadoAtivo(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{chamadoAtivo.titulo}</p>
                  <p className="text-xs text-muted-foreground">{usuarioNome(chamadoAtivo.aberto_por)} → {usuarioNome(chamadoAtivo.destinado_a)}</p>
                </div>
                <div className="flex gap-2">
                  {chamadoAtivo.status !== "em_andamento" && (
                    <Button size="sm" variant="outline" onClick={() => mudarStatus.mutate("em_andamento")}>Em andamento</Button>
                  )}
                  {chamadoAtivo.status !== "resolvido" && (
                    <Button size="sm" variant="outline" className="text-green-700" onClick={() => mudarStatus.mutate("resolvido")}>Resolver</Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensagens.map(m => {
                  const minha = m.autor_id === usuario?.id;
                  return (
                    <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 ${minha ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {!minha && <p className="text-xs font-semibold mb-1 opacity-70">{m.autor_nome ?? "Usuário"}</p>}
                        <p className="text-sm">{m.conteudo}</p>
                        <p className={`text-xs mt-1 opacity-60 ${minha ? "text-right" : ""}`}>
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </CardContent>

              <div className="p-3 border-t flex gap-2">
                <Input
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviarMensagem.mutate()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1"
                />
                <Button size="sm" onClick={() => enviarMensagem.mutate()} disabled={!mensagem.trim() || enviarMensagem.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Chamado</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Título</Label>
              <Input className="mt-1" value={novoChamado.titulo} onChange={e => setNovoChamado(f => ({ ...f, titulo: e.target.value }))} placeholder="Descreva o assunto..." />
            </div>
            <div>
              <Label>Destinatário</Label>
              <select
                value={novoChamado.destinado_a}
                onChange={e => setNovoChamado(f => ({ ...f, destinado_a: e.target.value }))}
                className="w-full mt-1 border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                {usuarios.filter(u => u.id !== usuario?.id).map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.perfil.replace("_", " ")})</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNovo(false)}>Cancelar</Button>
            <Button onClick={() => criarChamado.mutate()} disabled={criarChamado.isPending || !novoChamado.titulo || !novoChamado.destinado_a}>
              {criarChamado.isPending ? "Abrindo..." : "Abrir Chamado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
