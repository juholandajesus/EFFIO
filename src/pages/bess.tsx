import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBessUnidades,
  useCreateBessUnidade,
  useUpdateBessUnidade,
  useDeleteBessUnidade,
  useListEmpresas,
  getListBessUnidadesQueryKey,
} from "@workspace/api-client-react";
import type { BessUnidade } from "@workspace/api-client-react";
import {
  BatteryCharging,
  Plus,
  Pencil,
  Trash2,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const TIPOS_BESS = ["Íon-lítio", "Chumbo-ácido", "Fluxo", "Sódio-enxofre", "Híbrido", "Outro"] as const;
const PROTOCOLOS = ["Modbus TCP", "CANBus", "Outro"] as const;
const STATUS_INTEGRACAO = ["Não integrado", "Em análise", "Integrado"] as const;
const VARIAVEIS_DISPONIVEIS = [
  "SOC",
  "SOH",
  "potência ativa",
  "potência reativa",
  "tensão",
  "corrente",
  "temperatura",
] as const;

const STATUS_COLORS: Record<string, string> = {
  "Integrado": "bg-green-100 text-green-800 border-green-200",
  "Em análise": "bg-amber-100 text-amber-800 border-amber-200",
  "Não integrado": "bg-gray-100 text-gray-600 border-gray-200",
};

const formSchema = z.object({
  empresa_id: z.string().min(1, "Selecione uma empresa"),
  nome_unidade: z.string().min(1, "Nome da unidade é obrigatório"),
  localizacao: z.string().optional(),
  tipo_bess: z.string().min(1, "Selecione o tipo de BESS"),
  fabricante_bms: z.string().optional(),
  fabricante_inversor: z.string().optional(),
  protocolo_comunicacao: z.string().optional(),
  gateway_iot: z.string().optional(),
  broker_mensageria: z.string().optional(),
  frequencia_coleta_segundos: z.string().optional(),
  variaveis_monitoradas: z.array(z.string()).default([]),
  status_integracao: z.string().default("Não integrado"),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function bessToForm(b: BessUnidade): FormValues {
  return {
    empresa_id: String(b.empresa_id),
    nome_unidade: b.nome_unidade,
    localizacao: b.localizacao ?? "",
    tipo_bess: b.tipo_bess,
    fabricante_bms: b.fabricante_bms ?? "",
    fabricante_inversor: b.fabricante_inversor ?? "",
    protocolo_comunicacao: b.protocolo_comunicacao ?? "",
    gateway_iot: b.gateway_iot ?? "",
    broker_mensageria: b.broker_mensageria ?? "",
    frequencia_coleta_segundos: b.frequencia_coleta_segundos != null ? String(b.frequencia_coleta_segundos) : "",
    variaveis_monitoradas: b.variaveis_monitoradas ?? [],
    status_integracao: b.status_integracao,
    observacoes: b.observacoes ?? "",
  };
}

export default function Bess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBess, setEditingBess] = useState<BessUnidade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BessUnidade | null>(null);

  const { data: bessUnidades, isLoading } = useListBessUnidades(
    {},
    { query: { queryKey: getListBessUnidadesQueryKey() } }
  );
  const { data: empresas } = useListEmpresas();

  const createBess = useCreateBessUnidade();
  const updateBess = useUpdateBessUnidade();
  const deleteBess = useDeleteBessUnidade();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      empresa_id: "",
      nome_unidade: "",
      localizacao: "",
      tipo_bess: "",
      fabricante_bms: "",
      fabricante_inversor: "",
      protocolo_comunicacao: "",
      gateway_iot: "",
      broker_mensageria: "",
      frequencia_coleta_segundos: "",
      variaveis_monitoradas: [],
      status_integracao: "Não integrado",
      observacoes: "",
    },
  });

  function openCreate() {
    setEditingBess(null);
    form.reset({
      empresa_id: "",
      nome_unidade: "",
      localizacao: "",
      tipo_bess: "",
      fabricante_bms: "",
      fabricante_inversor: "",
      protocolo_comunicacao: "",
      gateway_iot: "",
      broker_mensageria: "",
      frequencia_coleta_segundos: "",
      variaveis_monitoradas: [],
      status_integracao: "Não integrado",
      observacoes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(bess: BessUnidade) {
    setEditingBess(bess);
    form.reset(bessToForm(bess));
    setDialogOpen(true);
  }

  function onSubmit(values: FormValues) {
    const payload = {
      empresa_id: parseInt(values.empresa_id, 10),
      nome_unidade: values.nome_unidade,
      localizacao: values.localizacao || undefined,
      tipo_bess: values.tipo_bess,
      fabricante_bms: values.fabricante_bms || undefined,
      fabricante_inversor: values.fabricante_inversor || undefined,
      protocolo_comunicacao: values.protocolo_comunicacao || undefined,
      gateway_iot: values.gateway_iot || undefined,
      broker_mensageria: values.broker_mensageria || undefined,
      frequencia_coleta_segundos: values.frequencia_coleta_segundos
        ? parseInt(values.frequencia_coleta_segundos, 10)
        : undefined,
      variaveis_monitoradas: values.variaveis_monitoradas,
      status_integracao: values.status_integracao,
      observacoes: values.observacoes || undefined,
    };

    if (editingBess) {
      updateBess.mutate(
        { id: editingBess.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBessUnidadesQueryKey() });
            setDialogOpen(false);
            toast({ title: "Unidade BESS atualizada com sucesso" });
          },
          onError: () => toast({ title: "Erro ao atualizar unidade BESS", variant: "destructive" }),
        }
      );
    } else {
      createBess.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBessUnidadesQueryKey() });
            setDialogOpen(false);
            toast({ title: "Unidade BESS cadastrada com sucesso" });
          },
          onError: () => toast({ title: "Erro ao cadastrar unidade BESS", variant: "destructive" }),
        }
      );
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteBess.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBessUnidadesQueryKey() });
          setDeleteTarget(null);
          toast({ title: "Unidade BESS removida" });
        },
        onError: () => toast({ title: "Erro ao remover unidade BESS", variant: "destructive" }),
      }
    );
  }

  const getEmpresaNome = (id: number) =>
    empresas?.find((e) => e.id === id)?.razao_social ?? `Empresa #${id}`;

  const isPending = createBess.isPending || updateBess.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <BatteryCharging className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">BESS</h1>
            <p className="text-sm text-muted-foreground">Battery Energy Storage System</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-new-bess">
          <Plus className="h-4 w-4 mr-2" />
          Nova Unidade
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex gap-3 pt-4 pb-4">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900 text-sm">Módulo de Armazenamento Energético</p>
            <p className="text-amber-700 text-sm mt-1">
              Este módulo é destinado a empresas com sistemas de armazenamento de energia (BESS —
              Battery Energy Storage System). Cadastre aqui as informações técnicas das suas unidades
              para centralizar o monitoramento e facilitar a integração futura com sensores e telemetria
              em tempo real.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Unidades Cadastradas
            {bessUnidades && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {bessUnidades.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !bessUnidades || bessUnidades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BatteryCharging className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma unidade BESS cadastrada</p>
              <p className="text-sm mt-1">Clique em "Nova Unidade" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bessUnidades.map((bess) => (
                  <TableRow key={bess.id} data-testid={`row-bess-${bess.id}`}>
                    <TableCell className="font-medium">
                      {bess.nome_unidade}
                      {bess.localizacao && (
                        <p className="text-xs text-muted-foreground">{bess.localizacao}</p>
                      )}
                    </TableCell>
                    <TableCell>{getEmpresaNome(bess.empresa_id)}</TableCell>
                    <TableCell>{bess.tipo_bess}</TableCell>
                    <TableCell>{bess.protocolo_comunicacao ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_COLORS[bess.status_integracao] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {bess.status_integracao}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(bess)}
                          data-testid={`button-edit-bess-${bess.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(bess)}
                          data-testid={`button-delete-bess-${bess.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBess ? "Editar Unidade BESS" : "Nova Unidade BESS"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Empresa */}
                <FormField
                  control={form.control}
                  name="empresa_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-empresa">
                            <SelectValue placeholder="Selecione a empresa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {empresas?.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nome */}
                <FormField
                  control={form.control}
                  name="nome_unidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Unidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: BESS Bloco A" data-testid="input-nome-unidade" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Localização */}
                <FormField
                  control={form.control}
                  name="localizacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: Sala Elétrica 01" data-testid="input-localizacao" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo BESS */}
                <FormField
                  control={form.control}
                  name="tipo_bess"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de BESS *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo-bess">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS_BESS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fabricante BMS */}
                <FormField
                  control={form.control}
                  name="fabricante_bms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabricante BMS</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: Huawei, BYD" data-testid="input-fabricante-bms" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fabricante Inversor */}
                <FormField
                  control={form.control}
                  name="fabricante_inversor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabricante Inversor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: SMA, ABB" data-testid="input-fabricante-inversor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Protocolo */}
                <FormField
                  control={form.control}
                  name="protocolo_comunicacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protocolo de Comunicação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-protocolo">
                            <SelectValue placeholder="Selecione o protocolo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROTOCOLOS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Frequência coleta */}
                <FormField
                  control={form.control}
                  name="frequencia_coleta_segundos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência de Coleta (seg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ex.: 60"
                          data-testid="input-frequencia"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Gateway IoT */}
                <FormField
                  control={form.control}
                  name="gateway_iot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gateway IoT</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: Raspberry Pi 4" data-testid="input-gateway" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Broker */}
                <FormField
                  control={form.control}
                  name="broker_mensageria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Broker de Mensageria</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: Mosquitto, HiveMQ" data-testid="input-broker" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status_integracao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status da Integração</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_INTEGRACAO.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Variáveis Monitoradas */}
              <FormField
                control={form.control}
                name="variaveis_monitoradas"
                render={() => (
                  <FormItem>
                    <FormLabel>Variáveis Monitoradas</FormLabel>
                    <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-muted/30">
                      {VARIAVEIS_DISPONIVEIS.map((variavel) => (
                        <FormField
                          key={variavel}
                          control={form.control}
                          name="variaveis_monitoradas"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(variavel)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ?? [];
                                    if (checked) {
                                      field.onChange([...current, variavel]);
                                    } else {
                                      field.onChange(current.filter((v) => v !== variavel));
                                    }
                                  }}
                                  data-testid={`checkbox-var-${variavel.replace(/\s/g, "-")}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-sm cursor-pointer">
                                {variavel}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observações */}
              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais sobre esta unidade BESS..."
                        rows={3}
                        data-testid="textarea-observacoes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-submit-bess">
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingBess ? "Salvar alterações" : "Cadastrar BESS"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover unidade BESS?</AlertDialogTitle>
            <AlertDialogDescription>
              A unidade <strong>{deleteTarget?.nome_unidade}</strong> será removida permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
