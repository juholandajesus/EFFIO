import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

const cadastroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres."),
  email: z.string().email("E-mail inválido."),
  telefone: z.string().min(10, "Telefone inválido."),
  senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres."),
  razao_social: z.string().min(2, "Razão social obrigatória."),
  cnpj: z.string().min(14, "CNPJ inválido."),
  setor_atividade: z.string().min(2, "Setor de atividade obrigatório."),
  tipo_plano: z.enum(["mercado_livre", "bess", "completo"]),
});

export default function Cadastro() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof cadastroSchema>>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      nome: "", email: "", telefone: "", senha: "",
      razao_social: "", cnpj: "", setor_atividade: "", tipo_plano: "mercado_livre",
    },
  });

  async function onSubmit(values: z.infer<typeof cadastroSchema>) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register/gestor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro no cadastro", description: data.error ?? "Tente novamente.", variant: "destructive" });
        return;
      }
      login(data.token, data.refresh_token, data.usuario, data.empresa);
      toast({ title: "Conta criada com sucesso!", description: `Bem-vindo, ${data.usuario.nome}!` });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Erro de conexão", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 text-primary mb-8 hover:opacity-80 transition-opacity">
        <Zap className="h-10 w-10 fill-current" />
        <span className="font-bold text-3xl text-foreground tracking-tight">EFFIO</span>
      </Link>

      <Card className="w-full max-w-xl shadow-lg border-primary/20">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
          <CardDescription>Cadastre sua empresa e comece a gerir energia de forma inteligente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl><Input placeholder="João da Silva" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="telefone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(11) 99999-9999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail Corporativo</FormLabel>
                  <FormControl><Input placeholder="gestor@empresa.com.br" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="senha" render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-muted-foreground mb-3">Dados da Empresa</p>
                <div className="space-y-4">
                  <FormField control={form.control} name="razao_social" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão Social</FormLabel>
                      <FormControl><Input placeholder="Empresa Energia S.A." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="cnpj" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl><Input placeholder="00.000.000/0001-00" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="setor_atividade" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setor de Atividade</FormLabel>
                        <FormControl><Input placeholder="Indústria" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="tipo_plano" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                          <SelectItem value="bess">BESS</SelectItem>
                          <SelectItem value="completo">Completo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 text-base mt-2" disabled={isLoading}>
                {isLoading ? "Criando conta..." : "Criar Conta"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 text-sm text-muted-foreground">
          Já possui conta?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline ml-1">Faça login</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
