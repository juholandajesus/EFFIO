import { Link } from "wouter";
import { LangToggle, useT } from "@/i18n";
import { usePlant } from "@/industry/use-plant";
import { dailySeries, detectAnomalies, forecast, type Anomaly } from "@/industry/engine";
import { LoadTrace } from "@/components/load-trace";
import { FaiscaMark } from "@/components/faisca-mark";
import { RichText } from "@/industry/ui";
import { suspectsFor } from "@/industry/attribution";
import { defaultRegister } from "@/industry/use-machines";

const DEMO_PLANT = 1;

export default function Landing() {
  const { t } = useT();
  const { fmt, lang } = usePlant(DEMO_PLANT);

  const anomalies = detectAnomalies(DEMO_PLANT);
  const find = (k: Anomaly["kind"]) => anomalies.find((a) => a.kind === k);
  const leak = find("baseload");
  const idle = find("off_hours");
  const register = defaultRegister(DEMO_PLANT);
  const top = (a?: Anomaly) => (a ? suspectsFor(a, register, 1).suspects[0] : undefined);
  const leakSuspect = top(leak);
  const idleSuspect = top(idle);
  const pctOf = (p?: number) => `${Math.round((p ?? 0) * 100)}%`;
  const peak = find("demand_peak");
  const fc = forecast(DEMO_PLANT);
  const days = dailySeries(DEMO_PLANT, 14);
  const out = (xs: typeof days) => xs.reduce((a, p) => a + p.output, 0);
  const outPct = ((out(days.slice(7)) - out(days.slice(0, 7))) / out(days.slice(0, 7))) * 100;

  const callout = (a: Anomaly) => {
    if (a.kind === "baseload") return <RichText text={t("land.coLeak", { cost: fmt.money(a.annualizedCost), machine: leakSuspect?.machine.nome ?? "", p: pctOf(leakSuspect?.probability) })} />;
    if (a.kind === "off_hours") return <RichText text={t("land.coIdle", { cost: fmt.money(a.annualizedCost), machine: idleSuspect?.machine.nome ?? "", p: pctOf(idleSuspect?.probability) })} />;
    if (a.kind === "demand_peak") return <RichText text={t("land.coPeak", { pct: fmt.num(a.peakPct ?? 0, 0) })} />;
    return null;
  };

  const peakWhen = peak ? new Date(peak.start) : null;
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  const transcript = [
    {
      q: t("land.q1"),
      a: t("land.a1", {
        out: fmt.pct(outPct, 1),
        cost: fmt.money((leak?.annualizedCost ?? 0) + (idle?.annualizedCost ?? 0)),
        m1: idleSuspect?.machine.nome ?? "",
        p1: pctOf(idleSuspect?.probability),
        m2: leakSuspect?.machine.nome ?? "",
        p2: pctOf(leakSuspect?.probability),
      }),
    },
    {
      q: t("land.q2"),
      a: t("land.a2", {
        when: peakWhen ? peakWhen.toLocaleDateString(locale, { weekday: "long" }) : "",
        hour: peakWhen ? peakWhen.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : "",
        pct: fmt.num(peak?.peakPct ?? 0, 0),
        fc: fmt.num(fc.peakPct, 0),
      }),
    },
    { q: t("land.q3"), a: t("land.a3", { machine: idleSuspect?.machine.nome ?? "", cost: fmt.money(idle?.annualizedCost ?? 0) }) },
  ];

  const box = [
    [t("land.b1"), t("land.b1d")],
    [t("land.b2"), t("land.b2d")],
    [t("land.b3"), t("land.b3d")],
    [t("land.b4"), t("land.b4d")],
  ];

  return (
    <div className="vt min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <FaiscaMark size={30} />
          <span className="text-xl font-extrabold" style={{ fontStretch: "125%" }}>EFFIO</span>
        </Link>
        <nav className="flex items-center gap-3">
          <LangToggle />
          <Link href="/login" className="vt-btn vt-btn-ghost h-10 text-sm">{t("land.login")}</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-10 md:pt-14">
          <h1 className="vt-display max-w-[19ch]">{t("land.h1")}</h1>
          <p className="vt-lede mt-5">{t("land.sub")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login" className="vt-btn vt-btn-lit" data-testid="landing-demo">{t("land.demo")}</Link>
            <Link href="/cadastro" className="vt-btn vt-btn-ghost">{t("land.signup")}</Link>
          </div>
        </section>

        <section aria-label={t("land.caption")}>
          <LoadTrace empresaId={DEMO_PLANT} callouts={callout} />
          <p className="vt-small mx-auto max-w-6xl px-6 pt-3">{t("land.caption")}</p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-24 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="vt-h2 max-w-[14ch]">{t("land.askTitle")}</h2>
            <p className="vt-lede mt-4">{t("land.askSub")}</p>
          </div>
          <div className="space-y-9">
            {transcript.map((x) => (
              <div key={x.q} className="space-y-3">
                <p className="vt-q pl-[3.15rem]">“{x.q}”</p>
                <div className="vt-line">
                  <FaiscaMark size={32} />
                  <div className="text-[1.05rem] leading-relaxed [&_strong]:text-[color:var(--vt-sodio)]">
                    <RichText text={x.a} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <h2 className="vt-h2">{t("land.boxTitle")}</h2>
          <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {box.map(([term, desc]) => (
              <div key={term} className="pt-4" style={{ borderTop: "1px solid var(--vt-trilho)" }}>
                <dt className="text-lg font-bold" style={{ fontStretch: "112%" }}>{term}</dt>
                <dd className="mt-1.5 leading-relaxed" style={{ color: "var(--vt-neblina)" }}>{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="px-6 py-20" style={{ background: "var(--vt-painel)" }}>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <p className="vt-h2 max-w-[20ch]">{t("land.final")}</p>
            <Link href="/login" className="vt-btn vt-btn-lit">{t("land.demo")}</Link>
          </div>
        </section>
      </main>

      <footer className="vt-small mx-auto max-w-6xl px-6 py-8">© {new Date().getFullYear()} EFFIO. {t("land.rights")}</footer>
    </div>
  );
}
