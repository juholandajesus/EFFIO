/**
 * EFFIO Copilot.
 *
 * By default it answers locally: it classifies the question and computes the
 * answer from the plant's own meter + ERP data with the analytics engine, so
 * every number it gives can be traced back to a screen.
 *
 * If VITE_COPILOT_URL is set, questions are sent to that endpoint together
 * with a compact data context, so any LLM (or a partner's native AI) can be
 * plugged in without touching the UI. Expected response: { "answer": string }.
 */
import {
  dailySeries, detectAnomalies, forecast, kpis, lineName, lineStats, productStats, type Anomaly,
} from "./engine";
import { getPlant } from "./engine";
import type { Fmt } from "./use-plant";

export type Intent = "explain" | "why" | "waste" | "forecast" | "idle" | "greeting" | "unknown";

/** Something Faísca can do on its own, not just say. */
export interface AgentAction {
  kind: "ticket";
  label: string;
  title: string; // ticket title
  body: string; // first message of the ticket
}

export interface CopilotAnswer {
  text: string; // light markdown: **bold**, "- " bullets, blank line = paragraph
  links?: { label: string; href: string }[];
  actions?: AgentAction[];
  intent?: Intent;
  source: "local" | "remote";
}

type Lang = "en" | "pt";

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function suggestions(lang: Lang): string[] {
  return lang === "pt"
    ? [
        "Por que o consumo subiu esta semana?",
        "Onde estou desperdiçando energia?",
        "Qual será o pico de demanda nos próximos 7 dias?",
        "Quanta energia gastamos com as linhas paradas?",
      ]
    : [
        "Why did consumption go up this week?",
        "Where am I wasting energy?",
        "What will peak demand be in the next 7 days?",
        "How much energy do we use while lines are idle?",
      ];
}

export function anomalyTitle(a: Anomaly, lang: Lang, line: string, product?: string): string {
  const pt = lang === "pt";
  switch (a.kind) {
    case "baseload":
      return pt ? `Consumo de base elevado em ${line}` : `Baseload increase on ${line}`;
    case "excess":
      return pt ? `Consumo acima do padrão em ${line}` : `Above-baseline consumption on ${line}`;
    case "idle_running":
      return pt ? `${line} consumindo energia sem produzir` : `${line} drawing power while not producing`;
    case "demand_peak":
      return pt ? `Pico de demanda em ${a.peakPct}% do contratado` : `Demand peak at ${a.peakPct}% of contracted`;
    case "sec_drift":
      return pt ? `kWh por unidade de ${product} subiu ${a.driftPct}%` : `kWh per unit of ${product} up ${a.driftPct}%`;
  }
}

export function anomalyHint(a: Anomaly, lang: Lang, lineKind: "production" | "utility"): string {
  const pt = lang === "pt";
  switch (a.kind) {
    case "baseload":
      return pt
        ? `Carga ${Math.round(((a.ratio ?? 1) - 1) * 100)}% acima da linha de base, inclusive à noite. Padrão típico de vazamento de ar comprimido ou chiller sem controle de setpoint.`
        : `Load ${Math.round(((a.ratio ?? 1) - 1) * 100)}% above baseline, including at night. Typical of a compressed-air leak or a chiller running without setpoint control.`;
    case "excess":
      return pt ? "Durante a produção, a linha consumiu mais que o padrão das últimas 4 semanas." : "While producing, the line used more than its 4-week pattern.";
    case "idle_running":
      return pt
        ? `O ERP não registra produção nessas horas, mas a carga ficou ${a.ratio}× acima do consumo em espera. Verifique se o equipamento foi mantido aquecido/energizado sem necessidade.`
        : `The ERP shows no production in these hours, yet load was ${a.ratio}× standby. Check whether the asset was kept hot/energised unnecessarily.`;
    case "demand_peak":
      return pt
        ? `Várias cargas coincidiram. Escalonar partidas ou usar o BESS para cortar o pico evita multa de ultrapassagem.`
        : `Several loads coincided. Staggering start-ups or discharging the BESS would shave this peak and avoid demand penalties.`;
    case "sec_drift":
      return lineKind === "production"
        ? pt
          ? "A linha está gastando mais energia para produzir a mesma quantidade. Causas comuns: desgaste de matriz/ferramenta, refugo maior, temperatura de processo acima do setpoint."
          : "The line needs more energy for the same output. Common causes: die/tool wear, higher scrap, process temperature above setpoint."
        : "";
  }
}

// ───────────────────────── Faísca's voice ─────────────────────────
// Sharp and direct: one short line of attitude, then the numbers. No fluff.

const OPENERS: Record<Intent, { en: string[]; pt: string[] }> = {
  why: {
    pt: ["Fui atrás do culpado.", "Conta subindo sem motivo comigo não passa."],
    en: ["I went after the culprit.", "A bill going up for no reason doesn't get past me."],
  },
  waste: {
    pt: ["Achei dinheiro escapando. Anota aí.", "Desperdício é meu assunto preferido."],
    en: ["Found money leaking. Write this down.", "Waste is my favourite subject."],
  },
  forecast: {
    pt: ["Olhei a agenda do ERP e fiz as contas.", "Futuro eu não adivinho, eu calculo."],
    en: ["I checked the ERP schedule and ran the numbers.", "I don't guess the future, I calculate it."],
  },
  idle: {
    pt: ["Máquina parada também come energia. Olha quanto:"],
    en: ["Idle machines still eat power. Here's how much:"],
  },
  explain: {
    pt: ["Esse eu resolveria hoje.", "Vamos direto ao ponto."],
    en: ["I'd fix this one today.", "Straight to the point."],
  },
  greeting: {
    pt: ["Fala! Sou o Faísca. Leio seus medidores e o ERP e aponto onde a conta está vazando."],
    en: ["Hey, I'm Faísca. I read your meters and your ERP and point out where the bill is leaking."],
  },
  unknown: {
    pt: ["Essa foge do meu painel. Eu entendo de consumo, desperdício, pico de demanda e máquina parada. Enquanto isso, o resumo:"],
    en: ["That's outside my panel. I'm good with consumption, waste, peak demand and idle machines. Meanwhile, here's the summary:"],
  },
};

function pick<T>(xs: T[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return xs[h % xs.length];
}

function voice(a: CopilotAnswer, question: string, lang: Lang): CopilotAnswer {
  if (!a.intent) return a;
  const opener = pick(OPENERS[a.intent][lang], question);
  const nudge = a.actions?.length ? (lang === "pt" ? "Quer que eu abra o chamado?" : "Want me to open the ticket?") : "";
  return { ...a, text: [opener, a.text, nudge].filter(Boolean).join("\n") };
}

function ticketFor(a: Anomaly, empresaId: number, lang: Lang, fmt: Fmt): AgentAction {
  const plant = getPlant(empresaId)!.plant;
  const line = plant.lines.find((l) => l.id === a.lineId)!;
  const prod = a.sku ? productStats(empresaId, 30).find((p) => p.sku === a.sku) : undefined;
  const title = anomalyTitle(a, lang, line.name[lang], prod?.name[lang]);
  const cost = a.annualizedCost > 0 ? fmt.money(a.annualizedCost) : null;
  const body =
    lang === "pt"
      ? `[Faísca] ${anomalyHint(a, lang, line.kind)} Detectado em ${fmt.dateTime(a.start)}.${cost ? ` Impacto estimado: ${cost} por ano.` : ""} Me avisa quando resolver que eu confirmo nas próximas leituras.`
      : `[Faísca] ${anomalyHint(a, lang, line.kind)} Detected on ${fmt.dateTime(a.start)}.${cost ? ` Estimated impact: ${cost} per year.` : ""} Let me know when it's fixed and I'll confirm it in the next readings.`;
  return { kind: "ticket", label: lang === "pt" ? "Abrir chamado" : "Open ticket", title, body };
}

/** Faísca speaks first: the most expensive open problem, with an action ready. */
export function greeting(empresaId: number, lang: Lang, fmt: Fmt, firstName?: string): CopilotAnswer {
  const top = detectAnomalies(empresaId).find((a) => a.annualizedCost > 0);
  const hi = lang === "pt" ? `Fala${firstName ? `, ${firstName}` : ""}.` : `Hey${firstName ? ` ${firstName}` : ""}.`;
  if (!top) {
    return { text: lang === "pt" ? `${hi} Tudo limpo por aqui. Pode perguntar.` : `${hi} All clean here. Ask away.`, intent: "greeting", source: "local" };
  }
  const line = getPlant(empresaId)!.plant.lines.find((l) => l.id === top.lineId)!;
  const prod = top.sku ? productStats(empresaId, 30).find((p) => p.sku === top.sku) : undefined;
  const title = anomalyTitle(top, lang, line.name[lang], prod?.name[lang]);
  const text =
    lang === "pt"
      ? `${hi} Antes de você perguntar: **${title}**, desde ${fmt.date(top.start)}, e isso custa **${fmt.money(top.annualizedCost)} por ano** se ninguém mexer.\nQuer que eu abra o chamado?`
      : `${hi} Before you ask: **${title}**, since ${fmt.date(top.start)}, and that's **${fmt.money(top.annualizedCost)} a year** if nobody touches it.\nWant me to open the ticket?`;
  return { text, intent: "greeting", actions: [ticketFor(top, empresaId, lang, fmt)], source: "local" };
}

function localAnswer(question: string, empresaId: number, lang: Lang, fmt: Fmt): CopilotAnswer {
  const q = norm(question);
  const pt = lang === "pt";
  const info = getPlant(empresaId)!;
  const L = (x: { en: string; pt: string }) => x[lang];
  const prodName = (sku?: string) => {
    if (!sku) return undefined;
    const p = productStats(empresaId, 30).find((x) => x.sku === sku);
    return p ? L(p.name) : sku;
  };

  // ── explain a specific anomaly (from the "Explain" button)
  if (q.startsWith("explain:") || q.startsWith("explique:")) {
    const wanted = q.slice(q.indexOf(":") + 1).trim();
    const a = detectAnomalies(empresaId).find((x) => {
      const prod = x.sku ? productStats(empresaId, 30).find((p) => p.sku === x.sku) : undefined;
      return norm(anomalyTitle(x, lang, L(lineName(empresaId, x.lineId)), prod ? L(prod.name) : undefined)) === wanted;
    });
    if (a) {
      const line = info.plant.lines.find((l) => l.id === a.lineId)!;
      const actions: Record<Anomaly["kind"], { en: string[]; pt: string[] }> = {
        baseload: {
          en: ["Run an ultrasonic leak survey on the compressed-air network this week", "Check chiller setpoints and schedules against the shift plan", "Set an alert if night baseload exceeds the baseline by 15%"],
          pt: ["Fazer inspeção ultrassônica de vazamentos na rede de ar comprimido esta semana", "Conferir setpoints e horários dos chillers com o plano de turnos", "Criar alerta se a carga noturna passar 15% da linha de base"],
        },
        excess: {
          en: ["Compare process parameters with the best day of the period", "Check for mechanical friction or motor issues on the line"],
          pt: ["Comparar parâmetros de processo com o melhor dia do período", "Verificar atrito mecânico ou problema de motor na linha"],
        },
        idle_running: {
          en: ["Add a shutdown/hold procedure for non-production days", "Use the ERP schedule to switch the asset to standby automatically", "Assign an owner and confirm in the internal chat"],
          pt: ["Criar procedimento de desligamento/espera para dias sem produção", "Usar a programação do ERP para colocar o equipamento em standby automaticamente", "Definir um responsável e confirmar pelo chat interno"],
        },
        demand_peak: {
          en: ["Stagger start-ups of the largest loads by 15–30 minutes", "Schedule the BESS to discharge in the forecast peak window", "Set an alert at 90% of contracted demand"],
          pt: ["Escalonar a partida das maiores cargas em 15–30 minutos", "Programar o BESS para descarregar na janela de pico prevista", "Criar alerta em 90% da demanda contratada"],
        },
        sec_drift: {
          en: ["Inspect die/tool wear and maintenance history", "Compare scrap rate in the ERP with the baseline weeks", "Check process temperature vs. setpoint"],
          pt: ["Inspecionar desgaste de matriz/ferramenta e histórico de manutenção", "Comparar a taxa de refugo no ERP com as semanas de referência", "Verificar temperatura de processo vs. setpoint"],
        },
      };
      const parts = [
        `**${anomalyTitle(a, lang, L(line.name), a.sku ? L(productStats(empresaId, 30).find((p) => p.sku === a.sku)!.name) : undefined)}**`,
        anomalyHint(a, lang, line.kind),
        a.kind === "demand_peak"
          ? pt
            ? `Pico de **${fmt.num(a.peakKw ?? 0)} kW** em ${fmt.dateTime(a.start)}, ${a.peakPct}% da demanda contratada.`
            : `Peak of **${fmt.num(a.peakKw ?? 0)} kW** on ${fmt.dateTime(a.start)}, ${a.peakPct}% of contracted demand.`
          : pt
          ? `Excesso até agora: **${fmt.energy(a.excessKwh)}** (${fmt.money(a.excessCost)}). Impacto anual estimado: **${fmt.money(a.annualizedCost)}**.`
          : `Excess so far: **${fmt.energy(a.excessKwh)}** (${fmt.money(a.excessCost)}). Estimated annual impact: **${fmt.money(a.annualizedCost)}**.`,
        pt ? "Próximos passos sugeridos:" : "Suggested next steps:",
        ...actions[a.kind][lang].map((s) => `- ${s}`),
      ];
      return { text: parts.join("\n"), intent: "explain", actions: [ticketFor(a, empresaId, lang, fmt)], source: "local" };
    }
  }

  // ── why did consumption change
  if (has(q, ["why", "por que", "porque", "subiu", "aumentou", "increase", "went up", "go up", "rise", "rose", "variou", "changed", "mudou"])) {
    const s = dailySeries(empresaId, 14);
    const last = s.slice(7).reduce((a, p) => a + p.kwh, 0);
    const prev = s.slice(0, 7).reduce((a, p) => a + p.kwh, 0);
    const outLast = s.slice(7).reduce((a, p) => a + p.output, 0);
    const outPrev = s.slice(0, 7).reduce((a, p) => a + p.output, 0);
    const linesLast = lineStats(empresaId, 7);
    const linesPrev = lineStats(empresaId, 14).map((l) => ({ ...l, kwh: l.kwh - (linesLast.find((x) => x.id === l.id)?.kwh ?? 0) }));
    const deltas = linesLast
      .map((l) => ({ l, d: l.kwh - (linesPrev.find((x) => x.id === l.id)?.kwh ?? 0) }))
      .sort((a, b) => b.d - a.d);
    const change = ((last - prev) / prev) * 100;
    const outChange = outPrev ? ((outLast - outPrev) / outPrev) * 100 : 0;
    const top = deltas.filter((x) => x.d > 0).slice(0, 2);
    const anomalies = detectAnomalies(empresaId)
      .filter((a) => top.some((t) => t.l.id === a.lineId) && a.kind !== "demand_peak")
      .sort((a, b) => top.findIndex((t) => t.l.id === a.lineId) - top.findIndex((t) => t.l.id === b.lineId));
    const parts: string[] = [];
    parts.push(
      pt
        ? `Nos últimos 7 dias a planta consumiu **${fmt.energy(last)}**, ${fmt.pct(change)} em relação aos 7 dias anteriores, enquanto a produção da linha principal variou ${fmt.pct(outChange)}.`
        : `In the last 7 days the plant used **${fmt.energy(last)}**, ${fmt.pct(change)} vs. the previous 7 days, while output on the main line changed ${fmt.pct(outChange)}.`,
    );
    if (top.length) {
      parts.push(pt ? "Maiores contribuições para a variação:" : "Biggest contributors to the change:");
      for (const t of top) parts.push(`- **${L(t.l.name)}**: +${fmt.energy(t.d)}`);
    }
    if (anomalies.length) {
      const a = anomalies[0];
      parts.push(
        pt
          ? `Causa provável: ${anomalyTitle(a, lang, L(lineName(empresaId, a.lineId)), prodName(a.sku))} (desde ${fmt.date(a.start)}). ${a.ongoing ? "Se continuar" : "Se repetir todo mês"}, custa cerca de **${fmt.money(a.annualizedCost)} por ano**.`
          : `Likely cause: ${anomalyTitle(a, lang, L(lineName(empresaId, a.lineId)), prodName(a.sku))} (since ${fmt.date(a.start)}). ${a.ongoing ? "If it continues" : "If it repeats monthly"}, it costs about **${fmt.money(a.annualizedCost)} per year**.`,
      );
    } else if (change > 0 && outChange > 0) {
      parts.push(pt ? "O aumento acompanha a produção: não há sinal de desperdício." : "The increase follows production; no sign of waste.");
    }
    return { text: parts.join("\n"), intent: "why", actions: anomalies[0] ? [ticketFor(anomalies[0], empresaId, lang, fmt)] : undefined, links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
  }

  // ── waste / savings
  if (has(q, ["waste", "wasting", "desperd", "save", "saving", "econom", "oportunidad", "opportunit", "reduce cost", "reduzir custo", "perda", "loss"])) {
    const list = detectAnomalies(empresaId).filter((a) => a.annualizedCost > 0).slice(0, 4);
    const total = list.reduce((a, x) => a + x.annualizedCost, 0);
    const k = kpis(empresaId);
    const parts = [
      pt
        ? `Encontrei **${list.length} oportunidades** que somam cerca de **${fmt.money(total)} por ano** (${fmt.num((total / (k.cost * 12)) * 100, 1)}% da conta de energia).`
        : `I found **${list.length} opportunities** worth about **${fmt.money(total)} per year** (${fmt.num((total / (k.cost * 12)) * 100, 1)}% of the energy bill).`,
    ];
    for (const a of list) parts.push(`- ${anomalyTitle(a, lang, L(lineName(empresaId, a.lineId)), prodName(a.sku))}: **${fmt.money(a.annualizedCost)}/${pt ? "ano" : "yr"}**`);
    parts.push(
      pt
        ? `Além disso, ${fmt.num(k.idlePct, 1)}% da energia do mês foi consumida com as linhas paradas (${fmt.energy(k.idleKwh)}).`
        : `On top of that, ${fmt.num(k.idlePct, 1)}% of this month's energy was used while lines were idle (${fmt.energy(k.idleKwh)}).`,
    );
    return { text: parts.join("\n"), intent: "waste", actions: list[0] ? [ticketFor(list[0], empresaId, lang, fmt)] : undefined, links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
  }

  // ── forecast / peak
  if (has(q, ["forecast", "previs", "next week", "proxima semana", "proximos", "next 7", "peak", "pico", "demand", "demanda", "amanha", "tomorrow"])) {
    const f = forecast(empresaId);
    const parts = [
      pt
        ? `Para os próximos 7 dias, com base nas ordens planejadas no ERP, prevejo **${fmt.energy(f.kwhTotal)}** (≈ ${fmt.money(f.costTotal)}).`
        : `For the next 7 days, based on the orders planned in the ERP, I forecast **${fmt.energy(f.kwhTotal)}** (≈ ${fmt.money(f.costTotal)}).`,
      pt
        ? `Pico mais provável: **${fmt.num(f.peak.kw)} kW** em ${fmt.dateTime(f.peak.ts)}, podendo chegar a ${fmt.num(f.peak.high)} kW (${fmt.num(f.peakPct, 1)}% da demanda contratada de ${fmt.num(f.contractedKw)} kW).`
        : `Most likely peak: **${fmt.num(f.peak.kw)} kW** on ${fmt.dateTime(f.peak.ts)}, possibly up to ${fmt.num(f.peak.high)} kW (${fmt.num(f.peakPct, 1)}% of the ${fmt.num(f.contractedKw)} kW contracted demand).`,
      f.peakPct > 90
        ? pt
          ? "Recomendo escalonar as partidas das prensas nesse horário ou programar o BESS para descarregar."
          : "I recommend staggering press start-ups in that window or scheduling the BESS to discharge."
        : pt
        ? "Há folga em relação à demanda contratada."
        : "There is headroom against the contracted demand.",
    ];
    return { text: parts.join("\n"), intent: "forecast", links: [{ label: pt ? "Ver previsão" : "Open forecast", href: "/anomalies#forecast" }], source: "local" };
  }

  // ── idle
  if (has(q, ["idle", "ocios", "parad", "standby", "weekend", "fim de semana", "noite", "night"])) {
    const lines = lineStats(empresaId, 30).sort((a, b) => b.idleKwh - a.idleKwh);
    const parts = [pt ? "Energia consumida fora de produção (30 dias):" : "Energy used outside production (30 days):"];
    for (const l of lines.slice(0, 4)) parts.push(`- **${L(l.name)}**: ${fmt.energy(l.idleKwh)} (${fmt.num(l.idlePct, 1)}%)`);
    return { text: parts.join("\n"), intent: "idle", links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
  }

  // ── summary (default for greetings / "how are we doing")
  const k = kpis(empresaId);
  const top = detectAnomalies(empresaId)[0];
  const parts = [
    pt
      ? `Resumo de ${info.plant.name} (30 dias): **${fmt.energy(k.kwh)}**, ${fmt.money(k.cost)}. Pico de ${fmt.num(k.peakKw)} kW (${fmt.num((k.peakKw / k.contractedKw) * 100, 0)}% do contratado).`
      : `${info.plant.name}, last 30 days: **${fmt.energy(k.kwh)}**, ${fmt.money(k.cost)}. Peak ${fmt.num(k.peakKw)} kW (${fmt.num((k.peakKw / k.contractedKw) * 100, 0)}% of contracted).`,
  ];
  if (top) parts.push(pt ? `Prioridade nº 1: ${anomalyTitle(top, lang, L(lineName(empresaId, top.lineId)), prodName(top.sku))}.` : `Priority #1: ${anomalyTitle(top, lang, L(lineName(empresaId, top.lineId)), prodName(top.sku))}.`);
  parts.push(pt ? "Você pode me perguntar sobre variação de consumo, desperdício, previsão de pico ou consumo com as linhas paradas." : "Ask me about consumption changes, waste, peak forecast or energy used while lines are idle.");
  const greeting = has(q, ["oi", "ola", "hello", "hi ", "hey", "fala", "bom dia", "boa tarde", "boa noite", "good morning", "resumo", "summary", "como estamos", "how are we"]) || q.length < 4;
  return { text: parts.join("\n"), intent: greeting ? "greeting" : "unknown", actions: top ? [ticketFor(top, empresaId, lang, fmt)] : undefined, source: "local" };
}

/** Compact context sent to an external model, so it reasons over the same numbers. */
export function copilotContext(empresaId: number) {
  const info = getPlant(empresaId)!;
  return {
    plant: { name: info.plant.name, country: info.plant.country, sector: info.plant.sector.en, contractedKw: info.plant.contractedKw },
    currency: info.region.currency,
    tariffPerKwh: info.region.tariffPerKwh,
    kpis30d: kpis(empresaId),
    products: productStats(empresaId, 30).map(({ name, unit, ...p }) => ({ ...p, name: name.en, unit: unit.en })),
    anomalies: detectAnomalies(empresaId).slice(0, 8),
    forecast7d: (({ points: _p, ...rest }) => rest)(forecast(empresaId)),
  };
}

export async function ask(question: string, empresaId: number, lang: Lang, fmt: Fmt): Promise<CopilotAnswer> {
  const url = import.meta.env.VITE_COPILOT_URL as string | undefined;
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          lang,
          persona:
            "You are Faísca, EFFIO's energy agent for industrial plants. Sharp and direct: one short line of attitude, then the numbers. Never invent figures: use only the context. Point to the most expensive problem and offer to open a ticket.",
          context: copilotContext(empresaId),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.answer === "string") return { text: data.answer, source: "remote" };
      }
    } catch {
      /* fall back to the local engine */
    }
  }
  return voice(localAnswer(question, empresaId, lang, fmt), question, lang);
}
