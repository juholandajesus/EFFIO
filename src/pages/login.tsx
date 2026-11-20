import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { LangToggle, useT } from "@/i18n";
import { isDemoMode } from "@/lib/api-base";
import { DEMO_EMAIL, DEMO_SENHA } from "@/mock/seed";
import { FaiscaMark } from "@/components/faisca-mark";
import { LoadTrace } from "@/components/load-trace";
import { usePlant } from "@/industry/use-plant";
import { kpis } from "@/industry/engine";

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
  const { fmt } = usePlant(1);
  const savings = kpis(1).savingsAnnual;

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
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]" style={{ fontFamily: "var(--vt-font)" }}>
      <aside className="vt relative hidden flex-col justify-between overflow-hidden lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-10 pt-8">
          <FaiscaMark size={30} />
          <span className="text-xl font-extrabold" style={{ fontStretch: "125%" }}>EFFIO</span>
        </Link>
        <div className="px-10">
          <p className="vt-h2 max-w-[16ch]">{t("login.faisca", { cost: fmt.money(savings) })}</p>
          <p className="vt-small mt-3">{t("login.faiscaSign")}</p>
        </div>
        <LoadTrace empresaId={1} compact callouts={() => null} />
      </aside>

      <main className="relative flex flex-col items-center justify-center bg-background p-6">
        <div className="absolute right-5 top-5"><LangToggle /></div>
        <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
          <FaiscaMark size={30} />
          <span className="text-xl font-extrabold" style={{ fontStretch: "125%" }}>EFFIO</span>
        </Link>
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-extrabold" style={{ fontStretch: "118%" }}>{t("login.title")}</h1>
          <p className="mt-1.5 text-muted-foreground">{t("login.subtitle")}</p>

          {isDemoMode && (
            <button
              type="button"
              disabled={isLoading}
              data-testid="demo-br"
              onClick={() => onSubmit({ email: DEMO_EMAIL, senha: DEMO_SENHA })}
              className="vt mt-8 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-shadow hover:shadow-[0_0_0_2px_var(--vt-arco)] disabled:opacity-60"
            >
              <FaiscaMark size={34} flicker />
              <span>
                <span className="block font-bold" style={{ fontStretch: "110%" }}>{t("login.demoBr")}</span>
                <span className="vt-small block">{t("login.demoHint")}</span>
              </span>
            </button>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.email")}</FormLabel>
                  <FormControl><Input className="h-11" placeholder={t("login.emailPh")} autoComplete="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="senha" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login.password")}</FormLabel>
                  <FormControl><Input className="h-11" type="password" autoComplete="current-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="mt-2 h-11 w-full rounded-full text-base font-semibold" disabled={isLoading}>
                {isLoading ? t("login.loading") : t("login.submit")}
              </Button>
            </form>
          </Form>
          <p className="mt-8 text-sm text-muted-foreground">
            {t("login.noAccount")}{" "}
            <Link href="/cadastro" className="font-semibold text-foreground underline underline-offset-4">{t("login.signup")}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
