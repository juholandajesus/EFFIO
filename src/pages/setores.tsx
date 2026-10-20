import { useState } from "react";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Setor {
  id: number;
  nome: string;
  categoria: string;
  descricao: string | null;
  created_at: string;
}

async function fetchSetores(token: string | null): Promise<Setor[]> {
  const res = await fetch("/api/setores", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Erro ao buscar setores");
  return res.json();
}

export default function Setores() {
  const { isGestor } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Setor | null>(null);
  const [form, setForm] = useState({ nome: "", categoria: "", descricao: "" });

  const { data: setores = [], isLoading } = useQuery<Setor[]>({
    queryKey: ["setores"],
    queryFn: () => fetchSetores(null),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const url = editando ? `/api/setores/${editando.id}` : "/api/setores";
      const method = editando ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editando ? "Setor atualizado!" : "Setor criado!" });
      qc.invalidateQueries({ queryKey: ["setores"] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/setores/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => {
      toast({ title: "Setor removido." });
      qc.invalidateQueries({ queryKey: ["setores"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: "", categoria: "", descricao: "" });
    setOpen(true);
  }

  function abrirEditar(s: Setor) {
    setEditando(s);
    setForm({ nome: s.nome, categoria: s.categoria, descricao: s.descricao ?? "" });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Setores</h1>
            <p className="text-sm text-muted-foreground">Gerencie os setores produtivos da empresa</p>
          </div>
        </div>
        {isGestor && (
          <Button onClick={abrirNovo} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Setor
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{setores.length} setor{setores.length !== 1 ? "es" : ""} cadastrado{setores.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Carregando...</p>
          ) : setores.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Nenhum setor cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  {isGestor && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell><Badge variant="secondary">{s.categoria}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.descricao ?? "—"}</TableCell>
                    {isGestor && (
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => abrirEditar(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => excluir.mutate(s.id)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Setor" : "Novo Setor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do Setor</Label>
              <Input className="mt-1" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Produção" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input className="mt-1" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex.: Industrial" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input className="mt-1" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o setor..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.nome || !form.categoria}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
