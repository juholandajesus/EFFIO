import { Link } from "wouter";
import { Zap, ArrowRight, BarChart3, Sparkles, Radar, BatteryCharging, Upload, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle, useT } from "@/i18n";

export default function Landing() {
  const { t } = useT();
  const features = [
    { icon: BarChart3, title: t("land.f1"), body: t("land.f1b") },
    { icon: Radar, title: t("land.f2"), body: t("land.f2b") },
    { icon: Sparkles, title: t("land.f3"), body: t("land.f3b") },
    { icon: BatteryCharging, title: t("land.f4"), body: t("land.f4b") },
  ];
  const steps = [
    { icon: Upload, title: t("land.s1"), body: t("land.s1b") },
    { icon: Factory, title: t("land.s2"), body: t("land.s2b") },
    { icon: Zap, title: t("land.s3"), body: t("land.s3b") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 py-4 flex justify-between items-center border-b">
        <div className="flex items-center gap-2 text-primary">
          <Zap className="h-8 w-8 fill-current" />
          <span className="font-bold text-2xl text-foreground tracking-tight">EFFIO</span>
        </div>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">{t("land.login")}</Link>
          </Button>
          <Button asChild>
            <Link href="/login">{t("land.demo")}</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center">
          <div className="mb-8 inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-sm font-semibold text-secondary">
            {t("land.badge")}
          </div>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight md:text-6xl">
            {t("land.h1a")} <span className="text-primary">{t("land.h1b")}</span>
          </h1>
          <p className="mb-10 max-w-2xl text-xl text-muted-foreground">{t("land.sub")}</p>
          <div className="mb-10 flex flex-col gap-4 sm:flex-row">
            <Button size="lg" className="h-14 px-8 text-lg" asChild>
              <Link href="/login">
                {t("land.demo")} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg" asChild>
              <Link href="/cadastro">{t("land.signup")}</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 text-left shadow-sm">
              <f.icon className="mb-4 h-9 w-9 text-primary" />
              <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">{t("land.how")}</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title} className="text-left">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                    <s.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="mb-1 font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} EFFIO Energy Intelligence. {t("land.rights")}</p>
      </footer>
    </div>
  );
}
