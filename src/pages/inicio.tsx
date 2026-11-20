import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Info, Play } from "lucide-react";
import { getAuthHeaders } from "@/context/auth-context";
import { usePlant } from "@/industry/use-plant";
import { detectAnomalies, forecast, siteHourly } from "@/industry/engine";
import { anomalyEvidence, anomalyTitle } from "@/industry/copilot";
import { estimatedShares, suspectsFor } from "@/industry/attribution";
import { useMachines, useTickets } from "@/industry/use-machines";
import { CurveThumb, Row, Tile } from "@/components/cinema";
import { openCopilot } from "@/components/copilot-panel";
import { eventWindow } from "@/pages/landing";
import { NoPlant } from "@/industry/ui";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Bess {
  id: number;
  nome_unidade: string;
  localizacao: string | null;
  tipo_bess: string;
  status_integracao: string;
  protocolo_comunicacao: string | null;
}

/**
 * Início: the plant at a glance, the Netflix way. The billboard is the most
 * expensive open problem; rows below are what to watch next.
 */
export default function Inicio() {
  const { empresaId, info, fmt, t, lang } = usePlant();
  const [, go] = useLocation();
  const machines = useMachines(info ? empresaId : null);
  const tickets = useTickets(!!info);
  const { data: bess = [] } = useQuery<Bess[]>({
    queryKey: ["bess", empresaId],
    enabled: !!empresaId,
    queryFn: () => fetch(`/api/bess?empresa_id=${empresaId}`, { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])),
  });

  if (!empresaId || !info) {
    return (
      <div className="p-6">
        <NoPlant />
      </div>
    );
  }

  const anomalies = detectAnomalies(empresaId);
  const ticketOf = (id: string) => [...tickets].reverse().find((tk) => tk.anomalia_id === id);
  const featured = anomalies.find((a) => a.annualizedCost > 0 && !ticketOf(a.id)?.confirmado_maquina_id) ?? anomalies[0];
  const curve = siteHourly(empresaId, 10);
  const fc = forecast(empresaId);
  const shares = estimatedShares(empresaId, machines).slice(0, 8);
  const openTickets = tickets.filter((tk) => (tk as { status: string }).status !== "resolvido");

  // the billboard backdrop: the whole 10-day curve, the featured event lit up
  const t0 = new Date(curve[0].ts).getTime();
  const hl: [number, number] | undefined = featured
    ? [Math.round((new Date(featured.start).getTime() - t0) / 3600_000), Math.round((new Date(featured.end).getTime() - t0) / 3600_000)]
    : undefined;
  const top = featured ? suspectsFor(featured, machines, 1).suspects[0] : undefined;
  const confirmed = featured ? machines.find((m) => m.id === ticketOf(featured.id)?.confirmado_maquina_id) : undefined;

  // daily forecast tiles
  const days = Array.from({ length: 7 }, (_, d) => {
    const pts = fc.points.slice(d * 24, d * 24 + 24);
    const peak = Math.max(...pts.map((p) => p.kw));
    return { ts: pts[0].ts, values: pts.map((p) => p.kw), peak, pct: (peak / fc.contractedKw) * 100 };
  });

  return (
    <div className="cn min-h-full pb-24">
      {featured && (
        <section className="relative flex min-h-[72vh] items-end overflow-hidden" data-testid="billboard">
          <div className="absolute inset-0 opacity-70">
            <CurveThumb values={curve.map((p) => p.kw)} highlight={hl} />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090c10] via-[#090c10]/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#090c10] to-transparent" />
          <div className="relative z-10 max-w-2xl px-[4%] pb-[10vh]">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="cn-badge bg-[color:var(--cn-sodio)] text-[#1d1300]">{t(`anom.kind.${featured.kind}` as "anom.kind.baseload")}</span>
              <span className="text-[color:var(--cn-nevoa)]">{t("anom.since", { date: fmt.dateTime(featured.start) })}</span>
            </div>
            <h1 className="cn-big mt-4">{anomalyTitle(featured, lang)}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {featured.annualizedCost > 0 && <span className="font-bold text-[color:var(--cn-sodio)]">{fmt.money(featured.annualizedCost)} / {t("common.year")}</span>}
              {confirmed ? (
                <span>{t("home.confirmed", { machine: confirmed.nome })}</span>
              ) : (
                top && <span>{t("home.suspect", { machine: top.machine.nome, p: Math.round(top.probability * 100) })}</span>
              )}
            </div>
            <p className="mt-4 max-w-[40em] leading-relaxed text-[color:var(--cn-nevoa)]">{anomalyEvidence(featured, lang, fmt)}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="cn-play" onClick={() => openCopilot(lang === "pt" ? `Explique: ${anomalyTitle(featured, lang)}` : `Explain: ${anomalyTitle(featured, lang)}`)} data-testid="billboard-play">
                <Play className="h-5 w-5 fill-current" /> {t("home.solve")}
              </button>
              <button className="cn-more" onClick={() => go("/anomalies")}>
                <Info className="h-5 w-5" /> {t("home.more")}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="relative z-10 -mt-6 space-y-12">
        <Row title={t("home.rowPriorities")} testId="row-priorities">
          {anomalies.map((a) => {
            const w = eventWindow(empresaId, a);
            const tk = ticketOf(a.id);
            const conf = machines.find((m) => m.id === tk?.confirmado_maquina_id);
            const s = suspectsFor(a, machines, 1).suspects[0];
            return (
              <Tile
                key={a.id}
                label={anomalyTitle(a, lang)}
                onOpen={() => go("/anomalies")}
                face={
                  <>
                    <CurveThumb values={w.values} highlight={w.highlight} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
                      <div className="text-sm font-semibold leading-tight">{anomalyTitle(a, lang)}</div>
                    </div>
                    {tk && <span className="cn-badge absolute left-2 top-2 bg-black/70">{conf ? t("home.badgeConfirmed") : t("home.badgeWaiting")}</span>}
                  </>
                }
                details={
                  <>
                    <div className="font-bold text-[color:var(--cn-sodio)]">{a.annualizedCost > 0 ? `${fmt.money(a.annualizedCost)}/${t("common.yearShort")}` : `${a.peakPct}%`}</div>
                    <div className="mt-1 text-[color:var(--cn-nevoa)]">
                      {conf ? t("home.confirmed", { machine: conf.nome }) : s ? t("home.suspect", { machine: s.machine.nome, p: Math.round(s.probability * 100) }) : ""}
                    </div>
                  </>
                }
              />
            );
          })}
        </Row>

        <Row title={t("home.rowMachines")} testId="row-machines">
          {shares.map((x) => (
            <Tile
              key={x.machine.id}
              label={x.machine.nome}
              onOpen={() => go("/maquinas")}
              face={
                <div className="absolute inset-0 flex flex-col justify-between bg-[color:var(--cn-painel)] p-4">
                  <span className="text-5xl font-light tabular-nums" style={{ fontStretch: "122%" }}>{Math.round(x.share * 100)}%</span>
                  <span>
                    <span className="block text-sm font-semibold leading-tight">{x.machine.nome}</span>
                    <span className="text-xs text-[color:var(--cn-nevoa)]">{x.machine.potencia_kw} kW · {x.machine.horario_inicio}–{x.machine.horario_fim}</span>
                  </span>
                </div>
              }
              details={
                <>
                  <div className="font-bold text-[color:var(--cn-sodio)]">≈ {fmt.money(x.cost)}/{t("home.month")}</div>
                  <div className="mt-1 text-[color:var(--cn-nevoa)]">
                    {x.machine.confirmacoes_ia > 0 ? t("home.learned", { n: x.machine.confirmacoes_ia }) : t("home.estimate")}
                  </div>
                </>
              }
            />
          ))}
        </Row>

        <Row title={t("home.rowWeek")} testId="row-week">
          {days.map((d) => (
            <Tile
              key={d.ts}
              label={fmt.date(d.ts, { weekday: "long" })}
              onOpen={() => go("/anomalies#forecast")}
              face={
                <>
                  <CurveThumb values={d.values} tone={d.pct > 90 ? "amber" : "arc"} max={fc.contractedKw * 1.05} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
                    <div className="text-sm font-semibold leading-tight">{cap(fmt.date(d.ts, { weekday: "long", day: "2-digit", month: "short" }))}</div>
                  </div>
                </>
              }
              details={<div className="text-[color:var(--cn-nevoa)]">{t("home.dayPeak", { kw: fmt.num(d.peak), pct: fmt.num(d.pct, 0) })}</div>}
            />
          ))}
        </Row>

        {openTickets.length > 0 && (
          <Row title={t("home.rowTickets")} testId="row-tickets">
            {openTickets.map((tk) => (
              <Tile
                key={tk.id}
                label={tk.titulo}
                onOpen={() => go("/chat")}
                face={
                  <div className="absolute inset-0 flex flex-col justify-end bg-[color:var(--cn-aco)] p-4">
                    <span className="line-clamp-3 text-sm font-semibold leading-snug">{tk.titulo}</span>
                  </div>
                }
                details={<div className="text-[color:var(--cn-nevoa)]">{tk.confirmado_maquina_id ? t("home.badgeConfirmed") : t("home.badgeWaiting")}</div>}
              />
            ))}
          </Row>
        )}

        {bess.length > 0 && (
          <Row title={t("home.rowBess")} testId="row-bess">
            {bess.map((b) => (
              <Tile
                key={b.id}
                label={b.nome_unidade}
                onOpen={() => go("/bess")}
                face={
                  <div className="absolute inset-0 flex flex-col justify-between bg-[color:var(--cn-painel)] p-4">
                    <span className="flex gap-1" aria-hidden="true">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className="h-8 w-3 rounded-sm" style={{ background: i < (b.status_integracao === "Integrado" ? 4 : 2) ? "var(--cn-arco)" : "var(--cn-aco)" }} />
                      ))}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{b.nome_unidade}</span>
                      <span className="text-xs text-[color:var(--cn-nevoa)]">{b.tipo_bess}{b.localizacao ? ` · ${b.localizacao}` : ""}</span>
                    </span>
                  </div>
                }
                details={<div className="text-[color:var(--cn-nevoa)]">{b.status_integracao}{b.protocolo_comunicacao ? ` · ${b.protocolo_comunicacao}` : ""}</div>}
              />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
