import { useState } from "react";
import { Cpu, Plus, Pencil, Trash2, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Setor { id: number; nome: string; }
interface Maquina {
  id: number; nome: string; tipo_equipamento: string; status: string;
  potencia_kw: number; horario_inicio: string; horario_fim: string;
  setor_id: number; marca: string | null; modelo: string | null;
  confirmacoes_ia: number;
}

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  inativo: "bg-gray-100 text-gray-600",
  manutencao: "bg-yellow-100 text-yellow-800",
};

const emptyForm = {
  nome: "", tipo_equipamento: "", setor_id: "", status: "ativo",
  potencia_kw: "", horario_inicio: "08:00", horario_fim: "18:00",
  dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"],
  marca: "", modelo: "", observacoes: "",
};

export default function Maquinas() {
  const { isGestor } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Maquina | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: maquinas = [], isLoading } = useQuery<Maquina[]>({
    queryKey: ["maquinas"],
    queryFn: async () => {
      const res = await fetch("/api/maquinas", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erro ao buscar máquinas");
      return res.json();
    },
  });

  const { data: setores = [] } = useQuery<Setor[]>({
    queryKey: ["setores"],
    queryFn: async () => {
      const res = await fetch("/api/setores", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const url = editando ? `/api/maquinas/${editando.id}` : "/api/maquinas";
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...form, potencia_kw: Number(form.potencia_kw), setor_id: Number(form.setor_id) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editando ? "Máquina atualizada!" : "Máquina cadastrada!" });
      qc.invalidateQueries({ queryKey: ["maquinas"] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/maquinas/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => {
      toast({ title: "Máquina removida." });
      qc.invalidateQueries({ queryKey: ["maquinas"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function abrirNovo() {
    setEditando(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function abrirEditar(m: Maquina) {
    setEditando(m);
    setForm({
      nome: m.nome, tipo_equipamento: m.tipo_equipamento, setor_id: String(m.setor_id),
      status: m.status, potencia_kw: String(m.potencia_kw),
      horario_inicio: m.horario_inicio, horario_fim: m.horario_fim,
      dias_semana: [], marca: m.marca ?? "", modelo: m.modelo ?? "", observacoes: "",
    });
    setOpen(true);
  }

  function toggleDia(dia: string) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(dia)
        ? f.dias_semana.filter(d => d !== dia)
        : [...f.dias_semana, dia],
    }));
  }

  const setorNome = (id: number) => setores.find(s => s.id === id)?.nome ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Cpu className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Máquinas</h1>
            <p className="text-sm text-muted-foreground">Cadastro e gestão de equipamentos por setor</p>
          </div>
        </div>
        {isGestor && (
          <Button onClick={abrirNovo} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Máquina
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{maquinas.length} equipamento{maquinas.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : maquinas.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Nenhuma máquina cadastrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Potência</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IA</TableHead>
                  {isGestor && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {maquinas.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.tipo_equipamento}</TableCell>
                    <TableCell>{setorNome(m.setor_id)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Zap className="h-3 w-3 text-amber-500" />{m.potencia_kw} kW
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />{m.horario_inicio}–{m.horario_fim}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[m.status] ?? ""}`}>
                        {m.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {m.confirmacoes_ia > 0 && (
                        <Badge variant="destructive" className="text-xs">{m.confirmacoes_ia}×</Badge>
                      )}
                    </TableCell>
                    {isGestor && (
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => abrirEditar(m)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir.mutate(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar Máquina" : "Nova Máquina"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input className="mt-1" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Compressor A1" />
              </div>
              <div>
                <Label>Tipo de Equipamento</Label>
                <Input className="mt-1" value={form.tipo_equipamento} onChange={e => setForm(f => ({ ...f, tipo_equipamento: e.target.value }))} placeholder="Compressor de ar" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Setor</Label>
                <Select value={form.setor_id} onValueChange={v => setForm(f => ({ ...f, setor_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {setores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Potência (kW)</Label>
                <Input className="mt-1" type="number" value={form.potencia_kw} onChange={e => setForm(f => ({ ...f, potencia_kw: e.target.value }))} placeholder="75" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input className="mt-1" type="time" value={form.horario_inicio} onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input className="mt-1" type="time" value={form.horario_fim} onChange={e => setForm(f => ({ ...f, horario_fim: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Dias de Operação</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {DIAS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDia(d)}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${form.dias_semana.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marca (opcional)</Label>
                <Input className="mt-1" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Atlas Copco" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.nome || !form.setor_id || !form.potencia_kw}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
