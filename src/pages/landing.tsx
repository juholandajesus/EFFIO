import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Play, Info } from "lucide-react";
import { LangToggle, useT } from "@/i18n";
import { usePlant } from "@/industry/use-plant";
import { detectAnomalies, forecast, siteHourly, type Anomaly } from "@/industry/engine";
import { anomalyTitle } from "@/industry/copilot";
import { estimatedShares, suspectsFor } from "@/industry/attribution";
import { defaultRegister } from "@/industry/use-machines";
import { StrikeCurve, type Hotspot } from "@/components/strike-curve";
import { BrandLockup } from "@/components/brand-mark";
import { CurveThumb, Row, Tile } from "@/components/cinema";

const DEMO_PLANT = 1;

/** The curve around an event, plus where the event sits in it. */
export function eventWindow(empresaId: number, a: Anomaly) {
  const series = siteHourly(empresaId, 10);
  const t0 = new Date(series[0].ts).getTime();
  const s = Math.round((new Date(a.start).getTime() - t0) / 3600_000);
  const e = Math.round((new Date(a.end).getTime() - t0) / 3600_000);
  const from = Math.max(0, Math.min(s, series.length - 1) - 30);
  const to = Math.min(series.length, Math.max(e, s + 1) + 30);
  return { values: series.slice(from, to).map((p) => p.kw), highlight: [s - from, e - from] as [number, number] };
}

/** The plant's last week, hour by hour, with each event's place in it. */
function weekWindow(empresaId: number, anomalies: Anomaly[]) {
  const series = siteHourly(empresaId, 7);
  const t0 = new Date(series[0].ts).getTime();
  const idx = (iso: string) => Math.round((new Date(iso).getTime() - t0) / 3600_000);
  const events = anomalies
    .map((a) => ({ a, start: idx(a.start), end: idx(a.end) }))
    .filter((e) => e.end > 0 && e.start < series.length)
    .map((e) => ({ ...e, start: Math.max(0, e.start), end: Math.min(series.length - 1, e.end) }));
  return { values: series.map((p) => p.kw), events };
}

export default function Landing() {
  const { t, lang } = useT();
  const { fmt } = usePlant(DEMO_PLANT);
  const [, go] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const register = defaultRegister(DEMO_PLANT);
  const anomalies = detectAnomalies(DEMO_PLANT);
  const fc = forecast(DEMO_PLANT);
  const peakHour = new Date(fc.peak.ts).getHours();
  const heaviest = estimatedShares(DEMO_PLANT, register)[0];

  // the last 7 days, hour by hour, and the costly events inside them
  const week = weekWindow(DEMO_PLANT, anomalies);
  const costly = week.events.filter((e) => e.a.annualizedCost > 0).sort((x, y) => y.a.annualizedCost - x.a.annualizedCost);
  const hotspots: Hotspot[] = (narrow ? costly.slice(0, 1) : costly.slice(0, 2)).map(({ a, start, end }) => ({
    start,
    end,
    onOpen: () => go("/login"),
    label: (
      <>
        {anomalyTitle(a, lang)} <strong>{t("cine.perYear", { cost: fmt.money(a.annualizedCost) })}</strong>
      </>
    ),
  }));

  const episodes = [
    { n: 1, title: t("cine.ep1"), body: t("cine.ep1b") },
    { n: 2, title: t("cine.ep2"), body: t("cine.ep2b") },
    { n: 3, title: t("cine.ep3"), body: t("cine.ep3b") },
  ];

  // a 24h battery plan from the forecast: charge at night, discharge around the forecast peak
  const plan = Array.from({ length: 24 }, (_, h) => (h < 6 ? "charge" : h >= peakHour - 1 && h <= peakHour + 2 ? "discharge" : "hold"));

  return (
    <div className="cn min-h-screen">
      <header className={`cn-nav fixed inset-x-0 top-0 z-30 flex items-center justify-between px-[4%] py-4 transition-colors duration-300 ${scrolled ? "bg-[#090c10]/90 backdrop-blur" : ""}`}>
        <Link href="/" aria-label="EFFIO">
          <BrandLockup />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#encontrou" className="text-[color:var(--cn-nevoa)] hover:text-white">{t("cine.navFound")}</a>
          <a href="#como" className="text-[color:var(--cn-nevoa)] hover:text-white">{t("cine.navHow")}</a>
          <a href="#bess" className="text-[color:var(--cn-nevoa)] hover:text-white">BESS</a>
        </nav>
        <div className="flex items-center gap-3">
          <LangToggle dark />
          <Link href="/login" className="rounded px-3 py-1.5 hover:bg-white/10">{t("land.login")}</Link>
        </div>
      </header>

      {/* hero: a bolt strikes the plant's real curve and lights up where the money leaks */}
      <section className="relative min-h-[100svh] overflow-hidden pb-[250px] md:pb-[330px]">
        <StrikeCurve values={week.values} hotspots={hotspots} narrow={narrow} />
        <div className="pointer-events-none absolute left-0 top-0 hidden h-[60%] w-1/2 bg-gradient-to-r from-[#090c10]/70 to-transparent md:block" />
        <div className="relative z-10 max-w-3xl px-[4%] pt-[15vh] md:pt-[16vh]">
          <h1 className="cn-hero-title cn-reveal cn-late">
            <span><span>{t("cine.h1a")}</span></span>
            <span><span><b>{t("cine.h1b")}</b></span></span>
          </h1>
          <p className="cn-fade mt-6 max-w-[34em] text-lg leading-relaxed text-[color:var(--cn-nevoa)]" style={{ animationDelay: "1.2s" }}>
            {t("cine.sub")}
          </p>
          <div className="cn-fade mt-8 flex flex-wrap gap-3" style={{ animationDelay: "1.5s" }}>
            <button className="cn-play" onClick={() => go("/login")} data-testid="landing-demo">
              <Play className="h-5 w-5 fill-current" /> {t("land.demo")}
            </button>
            <a className="cn-more" href="#como">
              <Info className="h-5 w-5" /> {t("cine.howBtn")}
            </a>
          </div>
        </div>
      </section>

      <main className="relative z-10 mt-6 space-y-16 pb-24">
        <div id="encontrou">
          <Row title={t("cine.rowFound")} testId="row-found">
            {anomalies.map((a) => {
              const w = eventWindow(DEMO_PLANT, a);
              const top = suspectsFor(a, register, 1).suspects[0];
              return (
                <Tile
                  key={a.id}
                  label={anomalyTitle(a, lang)}
                  onOpen={() => go("/login")}
                  face={
                    <>
                      <CurveThumb values={w.values} highlight={w.highlight} />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
                        <div className="text-sm font-semibold leading-tight">{anomalyTitle(a, lang)}</div>
                      </div>
                    </>
                  }
                  details={
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[color:var(--cn-sodio)]">
                          {a.annualizedCost > 0 ? `${fmt.money(a.annualizedCost)}/${t("common.yearShort")}` : `${a.peakPct}%`}
                        </span>
                        <span className="cn-badge border border-white/30">{t(`anom.kind.${a.kind}` as "anom.kind.baseload")}</span>
                      </div>
                      {top && <div className="mt-1 text-[color:var(--cn-nevoa)]">{t("cine.suspect", { machine: top.machine.nome, p: Math.round(top.probability * 100) })}</div>}
                    </>
                  }
                />
              );
            })}
            <Tile
              label={t("cine.tileForecast")}
              onOpen={() => go("/login")}
              face={
                <>
                  <CurveThumb values={fc.points.map((p) => p.kw)} tone="arc" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
                    <div className="text-sm font-semibold leading-tight">{t("cine.tileForecast")}</div>
                  </div>
                </>
              }
              details={<div className="text-[color:var(--cn-nevoa)]">{t("cine.tileForecastD", { kw: fmt.num(fc.peak.kw), pct: fmt.num(fc.peakPct, 0) })}</div>}
            />
            {heaviest && (
              <Tile
                label={heaviest.machine.nome}
                onOpen={() => go("/login")}
                face={
                  <div className="absolute inset-0 flex flex-col justify-between bg-[color:var(--cn-painel)] p-4">
                    <span className="text-5xl font-light tabular-nums" style={{ fontStretch: "122%" }}>{Math.round(heaviest.share * 100)}%</span>
                    <span className="text-sm font-semibold leading-tight">{t("cine.tileHeavy", { machine: heaviest.machine.nome })}</span>
                  </div>
                }
                details={<div className="text-[color:var(--cn-nevoa)]">{t("cine.tileHeavyD", { cost: fmt.money(heaviest.cost) })}</div>}
              />
            )}
          </Row>
        </div>

        <section id="como" className="px-[4%]">
          <h2 className="cn-h2 pb-6">{t("cine.rowHow")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {episodes.map((ep) => (
              <div key={ep.n} className="flex items-end gap-2">
                <span className="cn-rank select-none" aria-hidden="true">{ep.n}</span>
                <div className="min-w-0 flex-1 pb-2 pl-2">
                  <div className="text-lg font-semibold" style={{ fontStretch: "112%" }}>{ep.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--cn-nevoa)]">{ep.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="bess" className="mx-[4%] grid items-center gap-10 rounded-xl bg-[color:var(--cn-painel)] p-8 md:grid-cols-[1fr_1.2fr] md:p-12">
          <div>
            <p className="cn-big">{t("cine.bessTitle")}</p>
            <p className="mt-5 max-w-[32em] leading-relaxed text-[color:var(--cn-nevoa)]">{t("cine.bessBody")}</p>
          </div>
          <div>
            <div className="mb-3 flex justify-between text-xs text-[color:var(--cn-nevoa)]">
              <span>00h</span>
              <span>{t("cine.bessPlan", { h: peakHour })}</span>
              <span>23h</span>
            </div>
            <div className="flex h-24 items-end gap-[2px]" role="img" aria-label={t("cine.bessPlan", { h: peakHour })}>
              {plan.map((p, h) => (
                <div
                  key={h}
                  className="flex-1 rounded-sm"
                  style={{
                    background: p === "charge" ? "var(--cn-arco)" : p === "discharge" ? "var(--cn-sodio)" : "var(--cn-aco)",
                    height: p === "hold" ? "30%" : "100%",
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-6 text-sm">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--cn-arco)]" />{t("cine.charge")}</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--cn-sodio)]" />{t("cine.discharge")}</span>
            </div>
          </div>
        </section>

        <section className="px-[4%] pt-6 text-center">
          <p className="cn-big mx-auto max-w-[18ch]">{t("cine.final")}</p>
          <button className="cn-play mt-8" onClick={() => go("/login")}>
            <Play className="h-5 w-5 fill-current" /> {t("land.demo")}
          </button>
        </section>
      </main>

      <footer className="px-[4%] pb-10 text-sm text-[color:var(--cn-nevoa)]">© {new Date().getFullYear()} EFFIO. {t("land.rights")}</footer>
    </div>
  );
}
