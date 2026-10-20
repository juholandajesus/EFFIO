import { useState } from "react";
import { UserCheck, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Pendente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  created_at: string;
}

interface Setor { id: number; nome: string; }

export default function Aprovacoes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [aprovandoId, setAprovandoId] = useState<number | null>(null);
  const [setorId, setSetorId] = useState("");

  const { data: pendentes = [], isLoading } = useQuery<Pendente[]>({
    queryKey: ["usuarios-pendentes"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios/pendentes", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: setores = [] } = useQuery<Setor[]>({
    queryKey: ["setores"],
    queryFn: async () => {
      const res = await fetch("/api/setores", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const aprovar = useMutation({
    mutationFn: async ({ id, setor_id }: { id: number; setor_id?: string }) => {
      const res = await fetch(`/api/usuarios/${id}/aprovar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ setor_id: setor_id ? Number(setor_id) : undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Colaborador aprovado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["usuarios-pendentes"] });
      setAprovandoId(null);
      setSetorId("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const recusar = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/usuarios/${id}/recusar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
    },
    onSuccess: () => {
      toast({ title: "Colaborador recusado.", variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["usuarios-pendentes"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-amber-100 p-2 rounded-lg">
          <UserCheck className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovações de Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie os pedidos de acesso pendentes</p>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Clock className="h-4 w-4 text-amber-600" />
          <p className="text-sm text-amber-800 font-medium">{pendentes.length} colaborador{pendentes.length > 1 ? "es aguardando" : " aguardando"} aprovação</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitações Pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : pendentes.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma solicitação pendente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-muted-foreground">{p.telefone}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" className="gap-1" onClick={() => { setAprovandoId(p.id); setSetorId(""); }}>
                          <CheckCircle className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => recusar.mutate(p.id)} disabled={recusar.isPending}>
                          <XCircle className="h-3 w-3" /> Recusar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aprovandoId !== null} onOpenChange={() => setAprovandoId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprovar Colaborador</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Atribuir ao Setor (opcional)</Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um setor..." /></SelectTrigger>
              <SelectContent>
                {setores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprovandoId(null)}>Cancelar</Button>
            <Button
              onClick={() => aprovandoId && aprovar.mutate({ id: aprovandoId, setor_id: setorId || undefined })}
              disabled={aprovar.isPending}
            >
              {aprovar.isPending ? "Aprovando..." : "Confirmar Aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
