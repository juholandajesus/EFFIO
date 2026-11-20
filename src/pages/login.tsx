import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { EnergyCore } from "@/components/energy-core";
import { Play } from "lucide-react";
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
      setLocation("/inicio");
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
    <div className="cn relative flex min-h-screen items-center justify-end overflow-hidden">
      <EnergyCore focus={[-0.4, 0]} scale={0.95} className="hidden lg:block" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-[#090c10]/90 via-[#090c10]/40 to-transparent" />

      <Link href="/" className="cn-nav absolute left-[4%] top-5 z-10 flex items-center gap-2.5">
        <FaiscaMark size={26} />
        <span className="text-lg font-bold tracking-[0.3em]" style={{ fontStretch: "125%" }}>EFFIO</span>
      </Link>
      <div className="absolute right-[4%] top-5 z-10"><LangToggle dark /></div>

      <p className="pointer-events-none absolute bottom-[8vh] left-[4%] z-10 hidden max-w-md text-lg leading-snug lg:block" style={{ fontStretch: "110%" }}>
        {t("login.faisca", { cost: fmt.money(savings) })}
        <span className="mt-2 block text-sm text-[color:var(--cn-nevoa)]">{t("login.faiscaSign")}</span>
      </p>

      <main className="relative z-10 mx-[4%] my-20 w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1217]/80 p-8 backdrop-blur-xl md:p-10">
        <h1 className="text-3xl font-light" style={{ fontStretch: "122%" }}>{t("login.title")}</h1>
        <p className="mt-1.5 text-[color:var(--cn-nevoa)]">{t("login.subtitle")}</p>

        {isDemoMode && (
          <button
            type="button"
            disabled={isLoading}
            data-testid="demo-br"
            onClick={() => onSubmit({ email: DEMO_EMAIL, senha: DEMO_SENHA })}
            className="cn-play mt-8 w-full justify-center disabled:opacity-60"
          >
            <Play className="h-5 w-5 fill-current" /> {t("login.demoBr")}
          </button>
        )}
        {isDemoMode && <p className="mt-2 text-center text-xs text-[color:var(--cn-nevoa)]">{t("login.demoHint")}</p>}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4 border-t border-white/10 pt-6">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[color:var(--cn-nevoa)]">{t("login.email")}</FormLabel>
                <FormControl><Input className="h-11 border-white/15 bg-white/5 text-white placeholder:text-white/35" placeholder={t("login.emailPh")} autoComplete="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="senha" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[color:var(--cn-nevoa)]">{t("login.password")}</FormLabel>
                <FormControl><Input className="h-11 border-white/15 bg-white/5 text-white" type="password" autoComplete="current-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <button type="submit" className="cn-more w-full justify-center" disabled={isLoading}>
              {isLoading ? t("login.loading") : t("login.submit")}
            </button>
          </form>
        </Form>
        <p className="mt-6 text-sm text-[color:var(--cn-nevoa)]">
          {t("login.noAccount")}{" "}
          <Link href="/cadastro" className="font-semibold text-white underline underline-offset-4">{t("login.signup")}</Link>
        </p>
      </main>
    </div>
  );
}
