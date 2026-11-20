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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { LangToggle, useT } from "@/i18n";
import { isDemoMode } from "@/lib/api-base";
import { DEMO_EMAIL, DEMO_SENHA } from "@/mock/seed";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid e-mail / E-mail inválido" }),
  senha: z.string().min(6, { message: "Min. 6 characters / Mín. 6 caracteres" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useT();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, senha: values.senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("login.error"), description: data.error ?? t("login.invalid"), variant: "destructive" });
        return;
      }
      login(data.token, data.refresh_token, data.usuario, data.empresa);
      setLocation("/dashboard");
    } catch (err) {
      console.error("[EFFIO] falha na requisição:", err);
      toast({
        title: t("login.connError"),
        description: err instanceof Error ? err.message : t("login.retry"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <div className="absolute right-4 top-4"><LangToggle /></div>
      <Link href="/" className="flex items-center gap-2 text-primary mb-8 hover:opacity-80 transition-opacity">
        <Zap className="h-10 w-10 fill-current" />
        <span className="font-bold text-3xl text-foreground tracking-tight">EFFIO</span>
      </Link>

      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.email")}</FormLabel>
                  <FormControl><Input placeholder="manager@company.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="senha" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.password")}</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full h-11 text-base mt-6" disabled={isLoading}>
                {isLoading ? t("login.loading") : t("login.submit")}
              </Button>
            </form>
          </Form>
          {isDemoMode && (
            <div className="mt-6 space-y-2 border-t pt-4">
              <div className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("login.quickDemo")}</div>
              <Button variant="outline" type="button" className="w-full" disabled={isLoading} data-testid="demo-br" onClick={() => onSubmit({ email: DEMO_EMAIL, senha: DEMO_SENHA })}>
                {t("login.demoBr")}
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/cadastro" className="text-primary font-medium hover:underline ml-1">{t("login.signup")}</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
