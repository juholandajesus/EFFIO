import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGetConsumoHorario, getGetConsumoHorarioQueryKey, useListEmpresas, getListEmpresasQueryKey } from "@workspace/api-client-react";
import { Activity, Search, FilterX } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Consumo() {
  const [page, setPage] = useState(1);
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [submercado, setSubmercado] = useState<string>("all");
  const [tipoOperacao, setTipoOperacao] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const { data: empresas } = useListEmpresas({
    query: { queryKey: getListEmpresasQueryKey() }
  });

  const queryParams = {
    page,
    limit: 50,
    ...(empresaId !== "all" && { id_empresa: parseInt(empresaId) }),
    ...(submercado !== "all" && { submercado }),
    ...(tipoOperacao !== "all" && { tipo_operacao: tipoOperacao }),
    ...(dataInicio && { data_inicio: dataInicio }),
    ...(dataFim && { data_fim: dataFim }),
  };

  const { data: consumo, isLoading, isFetching } = useGetConsumoHorario(queryParams, {
    query: { 
      queryKey: getGetConsumoHorarioQueryKey(queryParams),
      placeholderData: (prev) => prev // keep previous data while fetching new page
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value);
  };

  const resetFilters = () => {
    setEmpresaId("all");
    setSubmercado("all");
    setTipoOperacao("all");
    setDataInicio("");
    setDataFim("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Registros de Consumo</h1>
          <p className="text-muted-foreground mt-1">Histórico detalhado por hora, empresa e submercado.</p>
        </div>
        
        {consumo?.resumo && (
          <div className="flex gap-4 text-sm">
            <div className="bg-card border px-3 py-1.5 rounded-md flex items-center gap-2">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold text-primary">{formatNumber(consumo.resumo.total_montante_mwh)} MWh</span>
            </div>
            <div className="bg-card border px-3 py-1.5 rounded-md flex items-center gap-2">
              <span className="text-muted-foreground">Custo:</span>
              <span className="font-semibold text-secondary">{formatCurrency(consumo.resumo.total_custo)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Filtros Avançados</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Empresa</label>
            <Select value={empresaId} onValueChange={(v) => { setEmpresaId(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas?.map(emp => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>{emp.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Submercado</label>
            <Select value={submercado} onValueChange={(v) => { setSubmercado(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="SE">Sudeste/Centro-Oeste (SE/CO)</SelectItem>
                <SelectItem value="S">Sul (S)</SelectItem>
                <SelectItem value="NE">Nordeste (NE)</SelectItem>
                <SelectItem value="N">Norte (N)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tipo de Operação</label>
            <Select value={tipoOperacao} onValueChange={(v) => { setTipoOperacao(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CONSUMO">Consumo</SelectItem>
                <SelectItem value="COMPRA">Compra</SelectItem>
                <SelectItem value="VENDA">Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Data Início</label>
            <Input 
              type="date" 
              value={dataInicio} 
              onChange={(e) => { setDataInicio(e.target.value); setPage(1); }} 
            />
          </div>

          <div className="space-y-1.5 flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium">Data Fim</label>
              <Input 
                type="date" 
                value={dataFim} 
                onChange={(e) => { setDataFim(e.target.value); setPage(1); }} 
              />
            </div>
            <Button variant="outline" size="icon" onClick={resetFilters} title="Limpar Filtros">
              <FilterX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card relative">
        {(isLoading || isFetching) && consumo && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Activity className="h-8 w-8 text-primary animate-pulse" />
          </div>
        )}
        
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Data / Hora</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Submercado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Montante (MWh)</TableHead>
              <TableHead className="text-right">Preço PLD (R$)</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !consumo ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : consumo?.registros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhum registro encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              consumo?.registros.map((registro) => (
                <TableRow key={registro.id} className="text-sm">
                  <TableCell>
                    <div className="font-medium">{format(parseISO(registro.data), 'dd/MM/yyyy')}</div>
                    <div className="text-xs text-muted-foreground">{registro.hora}</div>
                  </TableCell>
                  <TableCell className="font-medium">{registro.nome_empresa}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{registro.submercado}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      registro.tipo_operacao.toUpperCase() === 'CONSUMO' ? 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/20' :
                      registro.tipo_operacao.toUpperCase() === 'COMPRA' ? 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 border-blue-500/20' :
                      'bg-green-500/20 text-green-700 hover:bg-green-500/30 border-green-500/20'
                    } variant="secondary">
                      {registro.tipo_operacao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(registro.montante_mwh)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(registro.preco_pld)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatCurrency(registro.montante_mwh * registro.preco_pld)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {consumo && consumo.pagination.total_pages > 1 && (
          <div className="p-4 border-t flex items-center justify-between bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Mostrando página <span className="font-medium text-foreground">{consumo.pagination.page}</span> de <span className="font-medium text-foreground">{consumo.pagination.total_pages}</span> 
              {" "}({consumo.pagination.total} registros)
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(consumo.pagination.total_pages, p + 1))}
                disabled={page === consumo.pagination.total_pages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
