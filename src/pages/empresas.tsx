import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  useListEmpresas, 
  useCreateEmpresa, 
  useUpdateEmpresa, 
  useDeleteEmpresa,
  getListEmpresasQueryKey
} from "@workspace/api-client-react";
import type { Empresa } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Skeleton } from "@/components/ui/skeleton";

const PLANO_OPTIONS = [
  { value: "mercado_livre", label: "Mercado Livre", desc: "CSV, consumo energético, diagnósticos ML" },
  { value: "bess", label: "BESS", desc: "Armazenamento energético, dashboard BESS" },
  { value: "completo", label: "Completo (Mercado Livre + BESS)", desc: "Todos os módulos + dashboard integrado" },
] as const;

const PLANO_COLORS: Record<string, string> = {
  mercado_livre: "bg-amber-100 text-amber-800 border-amber-200",
  bess: "bg-blue-100 text-blue-800 border-blue-200",
  completo: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const empresaSchema = z.object({
  razao_social: z.string().min(2, "A razão social é obrigatória."),
  cnpj: z.string().min(14, "CNPJ inválido."),
  setor: z.string().optional(),
  demanda_contratada_kw: z.coerce.number().optional(),
  distribuidora: z.string().optional(),
  tipo_plano: z.enum(["mercado_livre", "bess", "completo"]).default("mercado_livre"),
});

type EmpresaFormValues = z.infer<typeof empresaSchema>;

export default function Empresas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: empresas, isLoading } = useListEmpresas({
    query: { queryKey: getListEmpresasQueryKey() }
  });

  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  const deleteEmpresa = useDeleteEmpresa();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [deletingEmpresa, setDeletingEmpresa] = useState<Empresa | null>(null);

  const form = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      razao_social: "",
      cnpj: "",
      setor: "",
      demanda_contratada_kw: undefined,
      distribuidora: "",
      tipo_plano: "mercado_livre",
    },
  });

  const openCreateForm = () => {
    setEditingEmpresa(null);
    form.reset({
      razao_social: "",
      cnpj: "",
      setor: "",
      demanda_contratada_kw: undefined,
      distribuidora: "",
      tipo_plano: "mercado_livre",
    });
    setIsFormOpen(true);
  };

  const openEditForm = (empresa: Empresa) => {
    setEditingEmpresa(empresa);
    form.reset({
      razao_social: empresa.razao_social,
      cnpj: empresa.cnpj,
      setor: empresa.setor || "",
      demanda_contratada_kw: empresa.demanda_contratada_kw || undefined,
      distribuidora: empresa.distribuidora || "",
      tipo_plano: (empresa.tipo_plano as "mercado_livre" | "bess" | "completo") || "mercado_livre",
    });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (empresa: Empresa) => {
    setDeletingEmpresa(empresa);
    setIsDeleteOpen(true);
  };

  const onSubmit = (values: EmpresaFormValues) => {
    if (editingEmpresa) {
      updateEmpresa.mutate({ id: editingEmpresa.id, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmpresasQueryKey() });
          toast({ title: "Empresa atualizada com sucesso!" });
          setIsFormOpen(false);
        },
        onError: () => {
          toast({ title: "Erro ao atualizar empresa", variant: "destructive" });
        }
      });
    } else {
      createEmpresa.mutate({ data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmpresasQueryKey() });
          toast({ title: "Empresa cadastrada com sucesso!" });
          setIsFormOpen(false);
        },
        onError: () => {
          toast({ title: "Erro ao cadastrar empresa", variant: "destructive" });
        }
      });
    }
  };

  const confirmDelete = () => {
    if (!deletingEmpresa) return;
    
    deleteEmpresa.mutate({ id: deletingEmpresa.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmpresasQueryKey() });
        toast({ title: "Empresa removida com sucesso!" });
        setIsDeleteOpen(false);
      },
      onError: () => {
        toast({ title: "Erro ao remover empresa", variant: "destructive" });
        setIsDeleteOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground mt-1">Gerencie as empresas e seus contratos de energia.</p>
        </div>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateForm} data-testid="button-create-empresa">
              <Plus className="mr-2 h-4 w-4" /> Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmpresa ? "Editar Empresa" : "Cadastrar Empresa"}</DialogTitle>
              <DialogDescription>
                {editingEmpresa ? "Atualize os dados da empresa abaixo." : "Insira os dados da nova empresa para acompanhamento de energia."}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="razao_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social</FormLabel>
                      <FormControl>
                        <Input placeholder="Indústria Exemplo S.A." {...field} data-testid="input-razao-social" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input placeholder="00.000.000/0001-00" {...field} data-testid="input-cnpj" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="setor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setor (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Siderurgia" {...field} data-testid="input-setor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="demanda_contratada_kw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Demanda Contratada (kW)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="500" {...field} value={field.value || ""} data-testid="input-demanda" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="distribuidora"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distribuidora Local</FormLabel>
                      <FormControl>
                        <Input placeholder="Enel, CPFL, Cemig..." {...field} data-testid="input-distribuidora" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo_plano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano Contratado *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo-plano">
                            <SelectValue placeholder="Selecione o plano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PLANO_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{p.label}</span>
                                <span className="text-xs text-muted-foreground">{p.desc}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createEmpresa.isPending || updateEmpresa.isPending} data-testid="button-save-empresa">
                    {(createEmpresa.isPending || updateEmpresa.isPending) ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Demanda Contratada</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : empresas?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhuma empresa cadastrada. Adicione a primeira para começar.
                </TableCell>
              </TableRow>
            ) : (
              empresas?.map((empresa) => (
                <TableRow key={empresa.id} data-testid={`row-empresa-${empresa.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {empresa.razao_social}
                    </div>
                  </TableCell>
                  <TableCell>{empresa.cnpj}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PLANO_COLORS[empresa.tipo_plano] ?? "bg-gray-100 text-gray-600"}`}>
                      {PLANO_OPTIONS.find((p) => p.value === empresa.tipo_plano)?.label ?? empresa.tipo_plano}
                    </span>
                  </TableCell>
                  <TableCell>{empresa.setor || "-"}</TableCell>
                  <TableCell>{empresa.demanda_contratada_kw ? `${empresa.demanda_contratada_kw} kW` : "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => openEditForm(empresa)}
                      data-testid={`button-edit-${empresa.id}`}
                    >
                      <Pencil className="h-4 w-4 text-primary" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => openDeleteConfirm(empresa)}
                      data-testid={`button-delete-${empresa.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a empresa 
              <span className="font-bold text-foreground"> {deletingEmpresa?.razao_social} </span>
              e todos os dados de consumo associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEmpresa.isPending}
            >
              {deleteEmpresa.isPending ? "Excluindo..." : "Excluir Empresa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
