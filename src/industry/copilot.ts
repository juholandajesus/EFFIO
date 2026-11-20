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
  carbon, dailySeries, detectAnomalies, forecast, kpis, lineName, lineStats, productStats, type Anomaly,
} from "./engine";
import { getPlant } from "./engine";
import type { Fmt } from "./use-plant";

export interface CopilotAnswer {
  text: string; // light markdown: **bold**, "- " bullets, blank line = paragraph
  links?: { label: string; href: string }[];
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
        "Qual o custo de energia por tonelada de cada produto?",
        "Qual será o pico de demanda nos próximos 7 dias?",
        "Quanto CO₂ emitimos e como reduzir?",
      ]
    : [
        "Why did consumption go up this week?",
        "Where am I wasting energy?",
        "What is the energy cost per unit of each product?",
        "What will peak demand be in the next 7 days?",
        "How much CO₂ do we emit and how can we cut it?",
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
      return { text: parts.join("\n"), links: [{ label: pt ? "Abrir chamado no chat interno" : "Open a ticket in internal chat", href: "/chat" }], source: "local" };
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
    return { text: parts.join("\n"), links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
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
    return { text: parts.join("\n"), links: [{ label: pt ? "Ver anomalias" : "Open anomalies", href: "/anomalies" }], source: "local" };
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
    return { text: parts.join("\n"), links: [{ label: pt ? "Ver previsão" : "Open forecast", href: "/anomalies#forecast" }], source: "local" };
  }

  // ── carbon
  if (has(q, ["co2", "co₂", "carbon", "carbono", "emiss", "emit", "esg", "cbam", "scope", "escopo", "clima", "climate", "net zero"])) {
    const c = carbon(empresaId);
    const parts = [
      pt
        ? `Nos últimos 30 dias, a eletricidade da planta gerou **${fmt.num(c.co2_30T, 1)} tCO₂e** (Escopo 2, fator da rede ${c.factor} kgCO₂e/kWh). No ritmo atual: **${fmt.num(c.annualT)} t/ano**.`
        : `In the last 30 days the plant's electricity produced **${fmt.num(c.co2_30T, 1)} tCO₂e** (Scope 2, grid factor ${c.factor} kgCO₂e/kWh). At this rate: **${fmt.num(c.annualT)} t/year**.`,
      pt ? "Alavancas de redução (t/ano):" : "Reduction levers (t/year):",
      `- ${pt ? "Corrigir as anomalias detectadas" : "Fix the detected anomalies"}: **${fmt.num(c.levers.fixAnomalies)} t**`,
      `- ${pt ? "Cortar 30% do consumo com linhas paradas" : "Cut 30% of idle-line consumption"}: **${fmt.num(c.levers.shiftIdle)} t**`,
      `- ${pt ? "Cobrir 20% com solar (PPA ou on-site)" : "Cover 20% with solar (PPA or on-site)"}: **${fmt.num(c.levers.solar20)} t**`,
    ];
    return { text: parts.join("\n"), links: [{ label: pt ? "Ver relatório ESG" : "Open ESG report", href: "/carbon" }], source: "local" };
  }

  // ── per product
  const products = productStats(empresaId, 30);
  const named = products.find((p) => q.includes(norm(p.sku)) || norm(p.name.en).split(" ").some((w) => w.length > 3 && q.includes(w)) || norm(p.name.pt).split(" ").some((w) => w.length > 3 && q.includes(w)));
  if (named || has(q, ["per unit", "por unidade", "per ton", "por tonelada", "produto", "product", "kwh/", "custo por", "cost per", "sku", "intensidade", "intensity"])) {
    const list = named ? [named] : products;
    const parts = [
      pt ? "Energia por produto (últimos 30 dias, incluindo rateio de utilidades):" : "Energy per product (last 30 days, utilities allocated):",
    ];
    for (const p of list) {
      parts.push(
        `- **${L(p.name)}**: ${fmt.num(p.kwhPerUnit, 1)} kWh/${L(p.unit)} · ${fmt.money(p.costPerUnit, 2)}/${L(p.unit)} · ${fmt.num(p.co2PerUnit, 1)} kgCO₂e/${L(p.unit)}${p.driftPct >= 6 ? (pt ? ` · ⚠ ${fmt.pct(p.driftPct)} na última semana` : ` · ⚠ ${fmt.pct(p.driftPct)} last week`) : ""}`,
      );
    }
    const worst = [...products].sort((a, b) => b.driftPct - a.driftPct)[0];
    if (worst && worst.driftPct >= 6)
      parts.push(
        pt
          ? `Ponto de atenção: **${L(worst.name)}** está ${worst.driftPct}% acima da própria referência. Voltar à referência economiza cerca de ${fmt.money((worst.kwhPerUnit - worst.baselineKwhPerUnit) * worst.units * info.region.tariffPerKwh)} por mês.`
          : `Watch out: **${L(worst.name)}** is ${worst.driftPct}% above its own baseline. Getting back to baseline saves about ${fmt.money((worst.kwhPerUnit - worst.baselineKwhPerUnit) * worst.units * info.region.tariffPerKwh)} per month.`,
      );
    return { text: parts.join("\n"), links: [{ label: pt ? "Ver energia por produção" : "Open energy × production", href: "/production" }], source: "local" };
  }

  // ── idle
  if (has(q, ["idle", "ocios", "parad", "standby", "weekend", "fim de semana", "noite", "night"])) {
    const lines = lineStats(empresaId, 30).sort((a, b) => b.idleKwh - a.idleKwh);
    const parts = [pt ? "Energia consumida fora de produção (30 dias):" : "Energy used outside production (30 days):"];
    for (const l of lines.slice(0, 4)) parts.push(`- **${L(l.name)}**: ${fmt.energy(l.idleKwh)} (${fmt.num(l.idlePct, 1)}%)`);
    return { text: parts.join("\n"), links: [{ label: pt ? "Ver linhas" : "Open lines", href: "/production" }], source: "local" };
  }

  // ── summary (default for greetings / "how are we doing")
  const k = kpis(empresaId);
  const top = detectAnomalies(empresaId)[0];
  const parts = [
    pt
      ? `Resumo de ${info.plant.name} (30 dias): **${fmt.energy(k.kwh)}**, ${fmt.money(k.cost)}, ${fmt.num(k.co2Tonnes, 1)} tCO₂e. Pico de ${fmt.num(k.peakKw)} kW (${fmt.num((k.peakKw / k.contractedKw) * 100, 0)}% do contratado).`
      : `${info.plant.name}, last 30 days: **${fmt.energy(k.kwh)}**, ${fmt.money(k.cost)}, ${fmt.num(k.co2Tonnes, 1)} tCO₂e. Peak ${fmt.num(k.peakKw)} kW (${fmt.num((k.peakKw / k.contractedKw) * 100, 0)}% of contracted).`,
  ];
  if (top) parts.push(pt ? `Prioridade nº 1: ${anomalyTitle(top, lang, L(lineName(empresaId, top.lineId)), prodName(top.sku))}.` : `Priority #1: ${anomalyTitle(top, lang, L(lineName(empresaId, top.lineId)), prodName(top.sku))}.`);
  parts.push(pt ? "Você pode me perguntar sobre variação de consumo, desperdício, custo por produto, previsão de pico ou emissões." : "Ask me about consumption changes, waste, cost per product, peak forecast or emissions.");
  return { text: parts.join("\n"), source: "local" };
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
        body: JSON.stringify({ question, lang, context: copilotContext(empresaId) }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.answer === "string") return { text: data.answer, source: "remote" };
      }
    } catch {
      /* fall back to the local engine */
    }
  }
  return localAnswer(question, empresaId, lang, fmt);
}
