import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Clock, MessageSquareShare, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/context/auth-context";
import { usePlant } from "@/industry/use-plant";
import { detectAnomalies, forecast, type Anomaly } from "@/industry/engine";
import { anomalyEvidence, anomalyTitle } from "@/industry/copilot";
import { suspectsFor } from "@/industry/attribution";
import { requestConfirmation, useInvalidateTickets, useMachines, useTickets } from "@/industry/use-machines";
import { AXIS, GRID, Kpi, Legend, NoPlant, PageHeader, SERIES, SERIES_SOFT, MUTED_INK, SeverityBadge, STATUS, TOOLTIP } from "@/industry/ui";
import { openCopilot } from "@/components/copilot-panel";
import { FaiscaMark } from "@/components/faisca-mark";

const DONE_KEY = "effio_anomalies_done";

function loadDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function Anomalies() {
  const { empresaId, info, fmt, t, lang } = usePlant();
  const { toast } = useToast();
  const [done, setDone] = useState<string[]>(loadDone);
  const [asking, setAsking] = useState<string | null>(null);
  const machines = useMachines(info ? empresaId : null);
  const tickets = useTickets(!!info);
  const invalidate = useInvalidateTickets();
  const { data: users = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["usuarios-nomes"],
    enabled: !!info,
    queryFn: () => fetch("/api/usuarios", { headers: getAuthHeaders() }).then((r) => (r.ok ? r.json() : [])),
  });

  useEffect(() => {
    if (window.location.hash === "#forecast") document.getElementById("forecast")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (!empresaId || !info) return <NoPlant />;

  const all = detectAnomalies(empresaId);
  const open = all.filter((a) => !done.includes(a.id));
  const f = forecast(empresaId);
  const totalAnnual = open.reduce((a, x) => a + x.annualizedCost, 0);
  const nameOf = (id: number) => users.find((u) => u.id === id)?.nome ?? "";

  const markDone = (a: Anomaly) => {
    const next = [...done, a.id];
    setDone(next);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    toast({ title: t("anom.resolvedToast") });
  };

  const ask = async (a: Anomaly) => {
    const { suspects } = suspectsFor(a, machines);
    setAsking(a.id);
    try {
      const when = fmt.dateTime(a.start);
      const list = suspects.map((s) => `${s.machine.nome} (${Math.round(s.probability * 100)}%)`).join(", ");
      const { owner } = await requestConfirmation({
        kind: "confirm_ticket",
        label: "",
        title: lang === "pt" ? `Confirmar: ${anomalyTitle(a, "pt").toLowerCase()} (${when})` : `Confirm: ${anomalyTitle(a, "en").toLowerCase()} (${when})`,
        body:
          lang === "pt"
            ? `[Faísca] ${anomalyEvidence(a, "pt", fmt)} Meus suspeitos: ${list}. Você consegue confirmar qual foi? É só tocar na máquina aqui no chamado.`
            : `[Faísca] ${anomalyEvidence(a, "en", fmt)} My suspects: ${list}. Can you confirm which one it was? Just tap the machine here in the ticket.`,
        anomalyId: a.id,
        suspects: suspects.map((s) => ({ maquina_id: s.machine.id, nome: s.machine.nome, prob: Math.round(s.probability * 100) })),
      });
      invalidate();
      toast({ title: t("anom.askedToast", { name: owner }) });
    } catch (e) {
      toast({ title: t("copilot.ticketFail", { err: e instanceof Error ? e.message : String(e) }), variant: "destructive" });
    } finally {
      setAsking(null);
    }
  };

  const fcData = f.points.map((p) => ({ ...p, band: [p.low, p.high] as [number, number] }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("anom.title")} subtitle={t("anom.subtitle")} />

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi tone="accent" label={t("anom.open")} value={String(open.length)} hint={t("anom.openHint", { n: open.filter((a) => a.severity === "high").length })} />
        <Kpi label={t("anom.annualImpact")} value={fmt.money(totalAnnual)} hint={t("anom.annualImpactHint")} />
        <Kpi label={t("anom.fcPeak")} value={`${fmt.num(f.peak.kw)} kW`} hint={t("anom.fcPeakHint", { when: fmt.dateTime(f.peak.ts), pct: fmt.num(f.peakPct, 0) })} />
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
        <FaiscaMark size={28} />
        <p className="text-muted-foreground">{t("anom.howItWorks")}</p>
      </div>

      <div className="space-y-3">
        {open.length === 0 && (
          <Card>
            <CardContent className="flex items-center gap-3 py-6 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5" style={{ color: STATUS.good }} /> {t("anom.none")}
            </CardContent>
          </Card>
        )}
        {open.map((a) => {
          const title = anomalyTitle(a, lang);
          const { suspects, other } = suspectsFor(a, machines);
          const ticket = [...tickets].reverse().find((tk) => tk.anomalia_id === a.id);
          const confirmed = ticket?.confirmado_maquina_id ? machines.find((m) => m.id === ticket.confirmado_maquina_id) : null;
          return (
            <Card key={a.id} className="shadow-sm" data-testid="anomaly-card">
              <CardContent className="grid gap-5 py-5 lg:grid-cols-[1fr_17rem]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs text-muted-foreground">
                      {t(`anom.kind.${a.kind}` as "anom.kind.baseload")} · {fmt.dateTime(a.start)} → {a.ongoing ? t("anom.ongoing") : fmt.dateTime(a.end)}
                    </span>
                  </div>
                  <div className="text-lg font-semibold">{title}</div>
                  <p className="text-sm text-muted-foreground">{anomalyEvidence(a, lang, fmt)}</p>

                  {confirmed ? (
                    <div className="flex items-center gap-2 rounded-lg border p-3 text-sm" data-testid="anomaly-confirmed">
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: STATUS.good }} />
                      <span>{t("anom.confirmedBy", { name: nameOf(ticket!.destinado_a), machine: confirmed.nome })}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-3">
                      <div className="mb-2 text-sm font-medium">{t("anom.suspects")}</div>
                      <div className="space-y-2">
                        {suspects.map((s, i) => (
                          <div key={s.machine.id} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm">
                            <span className="truncate">{s.machine.nome}</span>
                            <div className="h-2 rounded-full bg-muted">
                              <div className="h-2 rounded-full" style={{ width: `${s.probability * 100}%`, background: i === 0 ? SERIES[0] : SERIES_SOFT }} />
                            </div>
                            <span className="text-right tabular-nums">{Math.round(s.probability * 100)}%</span>
                          </div>
                        ))}
                        <div className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm text-muted-foreground">
                          <span>{t("anom.otherLoads")}</span>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-muted" style={{ width: `${other * 100}%` }} />
                          </div>
                          <span className="text-right tabular-nums">{Math.round(other * 100)}%</span>
                        </div>
                      </div>
                      {ticket && ticket.confirmado_maquina_id === 0 && <p className="mt-2 text-xs text-muted-foreground">{t("anom.noneOfThese")}</p>}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {ticket && !confirmed ? (
                      <Button size="sm" variant="outline" className="gap-1.5" asChild>
                        <Link href="/chat">
                          <Clock className="h-4 w-4" /> {t("anom.waiting", { name: nameOf(ticket.destinado_a) })}
                        </Link>
                      </Button>
                    ) : !confirmed ? (
                      <Button size="sm" className="gap-1.5" disabled={asking === a.id} onClick={() => ask(a)} data-testid="ask-sector">
                        <MessageSquareShare className="h-4 w-4" /> {t("anom.askSector")}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openCopilot(lang === "pt" ? `Explique: ${title}` : `Explain: ${title}`)}>
                      <Sparkles className="h-4 w-4" /> {t("anom.explain")}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => markDone(a)}>
                      <CheckCircle2 className="h-4 w-4" /> {t("anom.resolve")}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 content-start gap-4 lg:grid-cols-1 lg:text-right">
                  {a.kind === "demand_peak" ? (
                    <div>
                      <div className="text-2xl font-bold tabular-nums">{fmt.num(a.peakKw ?? 0)} kW</div>
                      <div className="text-xs text-muted-foreground">{t("anom.ofContracted", { kw: fmt.num(f.contractedKw) })}</div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="text-2xl font-bold tabular-nums">{fmt.money(a.annualizedCost)}</div>
                        <div className="text-xs text-muted-foreground">{a.ongoing ? t("anom.perYearIfContinues") : t("anom.perYearIfRepeats")}</div>
                      </div>
                      <div>
                        <div className="font-semibold tabular-nums">{fmt.energy(a.excessKwh)}</div>
                        <div className="text-xs text-muted-foreground">{t("anom.excessSoFar", { cost: fmt.money(a.excessCost) })}</div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm" id="forecast">
        <CardHeader>
          <CardTitle>{t("fc.title")}</CardTitle>
          <CardDescription>{t("fc.desc", { kwh: fmt.energy(f.kwhTotal), cost: fmt.money(f.costTotal) })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Legend
            items={[
              { label: t("fc.expected"), color: SERIES[0] },
              { label: t("fc.range"), color: SERIES_SOFT },
              { label: t("fc.contracted"), color: STATUS.critical, dashed: true },
            ]}
          />
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fcData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="ts" {...AXIS} tickFormatter={(d) => fmt.date(d, { weekday: "short", day: "2-digit" })} interval={23} />
                <YAxis {...AXIS} width={60} tickFormatter={(v) => fmt.num(v)} domain={[0, Math.ceil((f.contractedKw * 1.08) / 500) * 500]} label={{ value: "kW", angle: -90, position: "insideLeft", fill: MUTED_INK, fontSize: 11 }} />
                <Tooltip
                  {...TOOLTIP}
                  labelFormatter={(d) => fmt.dateTime(d)}
                  formatter={(v: number | number[], name) =>
                    Array.isArray(v) ? [`${fmt.num(v[0])}–${fmt.num(v[1])} kW`, t("fc.range")] : [`${fmt.num(v)} kW`, name === "kw" ? t("fc.expected") : String(name)]
                  }
                />
                <Area dataKey="band" stroke="none" fill={SERIES_SOFT} fillOpacity={0.8} isAnimationActive={false} />
                <ReferenceLine y={f.contractedKw} stroke={STATUS.critical} strokeDasharray="5 4" />
                <Line dataKey="kw" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">{t("fc.method")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
