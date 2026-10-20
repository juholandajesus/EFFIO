import { useState } from "react";
import { FileText, Save, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getAuthHeaders } from "@/context/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Contrato {
  id: number;
  preco_mwh: number;
  modalidade_tarifaria: string;
  tipo_energia: string;
  flexibilidade_pct: number;
  demanda_ponta_kw: number;
  demanda_fora_ponta_kw: number;
  possui_irec: boolean;
  meta_esg_pct: number | null;
  sazonalidade: Record<string, number>;
}

const emptyForm = {
  preco_mwh: "", modalidade_tarifaria: "TH_AZUL", tipo_energia: "CONVENCIONAL",
  flexibilidade_pct: "5", demanda_ponta_kw: "", demanda_fora_ponta_kw: "",
  possui_irec: "false", meta_esg_pct: "",
};

export default function Contrato() {
  const { isGestor } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: contrato, isLoading, error } = useQuery<Contrato>({
    queryKey: ["contrato"],
    queryFn: async () => {
      const res = await fetch("/api/contrato", { headers: getAuthHeaders() });
      if (res.status === 404) return null as unknown as Contrato;
      if (!res.ok) throw new Error("Erro ao buscar contrato");
      return res.json();
    },
    retry: false,
  });

  function iniciarEdicao() {
    if (contrato) {
      setForm({
        preco_mwh: String(contrato.preco_mwh),
        modalidade_tarifaria: contrato.modalidade_tarifaria,
        tipo_energia: contrato.tipo_energia,
        flexibilidade_pct: String(contrato.flexibilidade_pct),
        demanda_ponta_kw: String(contrato.demanda_ponta_kw),
        demanda_fora_ponta_kw: String(contrato.demanda_fora_ponta_kw),
        possui_irec: String(contrato.possui_irec),
        meta_esg_pct: contrato.meta_esg_pct != null ? String(contrato.meta_esg_pct) : "",
      });
    }
    setEditando(true);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const url = "/api/contrato";
      const method = contrato ? "PUT" : "POST";
      const body = {
        ...form,
        preco_mwh: Number(form.preco_mwh),
        flexibilidade_pct: Number(form.flexibilidade_pct),
        demanda_ponta_kw: Number(form.demanda_ponta_kw),
        demanda_fora_ponta_kw: Number(form.demanda_fora_ponta_kw),
        possui_irec: form.possui_irec === "true",
        meta_esg_pct: form.meta_esg_pct ? Number(form.meta_esg_pct) : null,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contrato salvo com sucesso!" });
      qc.invalidateQueries({ queryKey: ["contrato"] });
      setEditando(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const fmt = (v: number, prefix = "") => `${prefix}${v.toLocaleString("pt-BR")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contrato de Energia</h1>
            <p className="text-sm text-muted-foreground">Parâmetros contratuais do Mercado Livre</p>
          </div>
        </div>
        {isGestor && !editando && (
          <Button onClick={iniciarEdicao} variant="outline" className="gap-2">
            <Edit className="h-4 w-4" /> {contrato ? "Editar Contrato" : "Configurar Contrato"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : !contrato && !editando ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum contrato configurado.</p>
            {isGestor && (
              <Button onClick={iniciarEdicao} className="mt-4 gap-2">
                <Edit className="h-4 w-4" /> Configurar Contrato
              </Button>
            )}
          </CardContent>
        </Card>
      ) : editando ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Contrato</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço MWh (R$)</Label>
                <Input className="mt-1" type="number" value={form.preco_mwh} onChange={e => setForm(f => ({ ...f, preco_mwh: e.target.value }))} placeholder="280.00" />
              </div>
              <div>
                <Label>Flexibilidade (%)</Label>
                <Input className="mt-1" type="number" value={form.flexibilidade_pct} onChange={e => setForm(f => ({ ...f, flexibilidade_pct: e.target.value }))} />
              </div>
              <div>
                <Label>Modalidade Tarifária</Label>
                <Select value={form.modalidade_tarifaria} onValueChange={v => setForm(f => ({ ...f, modalidade_tarifaria: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TH_AZUL">TH Azul</SelectItem>
                    <SelectItem value="TH_VERDE">TH Verde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Energia</Label>
                <Select value={form.tipo_energia} onValueChange={v => setForm(f => ({ ...f, tipo_energia: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I50">I50</SelectItem>
                    <SelectItem value="I100">I100</SelectItem>
                    <SelectItem value="CONVENCIONAL">Convencional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Demanda Ponta (kW)</Label>
                <Input className="mt-1" type="number" value={form.demanda_ponta_kw} onChange={e => setForm(f => ({ ...f, demanda_ponta_kw: e.target.value }))} />
              </div>
              <div>
                <Label>Demanda Fora Ponta (kW)</Label>
                <Input className="mt-1" type="number" value={form.demanda_fora_ponta_kw} onChange={e => setForm(f => ({ ...f, demanda_fora_ponta_kw: e.target.value }))} />
              </div>
              <div>
                <Label>Possui I-REC?</Label>
                <Select value={form.possui_irec} onValueChange={v => setForm(f => ({ ...f, possui_irec: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Meta ESG (%)</Label>
                <Input className="mt-1" type="number" value={form.meta_esg_pct} onChange={e => setForm(f => ({ ...f, meta_esg_pct: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
                <Save className="h-4 w-4" />{salvar.isPending ? "Salvando..." : "Salvar Contrato"}
              </Button>
              <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : contrato ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Preço MWh", value: fmt(contrato.preco_mwh, "R$ "), color: "text-amber-600" },
            { label: "Flexibilidade", value: `${contrato.flexibilidade_pct}%`, color: "" },
            { label: "Demanda Ponta", value: `${fmt(contrato.demanda_ponta_kw)} kW`, color: "" },
            { label: "Demanda Fora Ponta", value: `${fmt(contrato.demanda_fora_ponta_kw)} kW`, color: "" },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="pt-5 pb-5">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-2">
            <CardContent className="pt-5 pb-5 flex gap-3 flex-wrap">
              <Badge variant="secondary">{contrato.modalidade_tarifaria}</Badge>
              <Badge variant="secondary">{contrato.tipo_energia}</Badge>
              {contrato.possui_irec && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">I-REC</Badge>}
              {contrato.meta_esg_pct && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">ESG {contrato.meta_esg_pct}%</Badge>}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
