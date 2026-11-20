import { useEffect, useId, useMemo, useRef, useState } from "react";
import { detectAnomalies, siteHourly, getPlant, type Anomaly } from "@/industry/engine";
import { usePlant } from "@/industry/use-plant";

const W = 1200;
const H = 300;
const PAD_TOP = 24;
const PAD_BOTTOM = 18;
const DAYS_SHOWN = 10;

interface Stop {
  idx: number; // hour index on the curve
  anomaly: Anomaly;
}

/**
 * The hero instrument: two weeks of the demo plant's real hourly load,
 * drawn like an oscilloscope. Faísca runs along the curve and stops where
 * the money is leaking. Runs once; with reduced motion it renders the final state.
 */
export function LoadTrace({ empresaId = 1, compact = false, callouts }: { empresaId?: number; compact?: boolean; callouts: (a: Anomaly) => React.ReactNode }) {
  const { fmt } = usePlant(empresaId);
  const series = useMemo(() => siteHourly(empresaId, DAYS_SHOWN), [empresaId]);
  const contracted = getPlant(empresaId)?.plant.contractedKw ?? 1;
  const max = Math.max(contracted * 1.05, ...series.map((p) => p.kw));

  const pts = series.map((p, i) => [(i / (series.length - 1)) * W, PAD_TOP + (1 - p.kw / max) * (H - PAD_TOP - PAD_BOTTOM)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const contractedY = PAD_TOP + (1 - contracted / max) * (H - PAD_TOP - PAD_BOTTOM);

  // one stop per kind of problem, in the order they appear on the curve
  const stops: Stop[] = useMemo(() => {
    const first = new Date(series[0].ts).getTime();
    const seen = new Set<string>();
    return detectAnomalies(empresaId)
      .filter((a) => a.kind !== "sec_drift")
      .map((a) => {
        const startIdx = Math.round((new Date(a.start).getTime() - first) / 3600_000);
        // land on the highest point of the event so the stop sits on the visible spike
        let idx = Math.max(0, Math.min(series.length - 1, startIdx));
        if (a.kind === "baseload" && a.ongoing) {
          // an ongoing leak shows best at night: the last 03:00 on the curve
          for (let i = series.length - 1; i >= 0; i--) if (new Date(series[i].ts).getHours() === 3) { idx = i; break; }
          return { idx, anomaly: a };
        }
        const end = Math.min(series.length - 1, startIdx + Math.min(a.hours, 30));
        for (let i = idx; i <= end; i++) if (series[i].kw > series[idx].kw) idx = i;
        return { idx, anomaly: a };
      })
      .filter((s) => s.idx > 0 && !seen.has(s.anomaly.kind) && seen.add(s.anomaly.kind))
      .sort((a, b) => a.idx - b.idx)
      .slice(0, compact ? 1 : 3);
  }, [empresaId, series, compact]);

  const pathRef = useRef<SVGPathElement>(null);
  const clipId = useId().replace(/:/g, "");
  const [progress, setProgress] = useState(0); // 0..1 along the curve
  const [shown, setShown] = useState<number[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setProgress(1);
      setShown(stops.map((_, i) => i));
      return;
    }
    let raf = 0;
    let cancelled = false;
    const total = series.length - 1;
    const speed = compact ? 0.00028 : 0.00016; // fraction of curve per ms
    const pause = compact ? 1200 : 1700;
    let pos = 0;
    let last = performance.now();
    let pausedUntil = 0;
    let next = 0;
    const tick = (now: number) => {
      if (cancelled) return;
      const dt = now - last;
      last = now;
      if (now >= pausedUntil) {
        pos = Math.min(1, pos + dt * speed);
        if (next < stops.length && pos >= stops[next].idx / total) {
          pos = stops[next].idx / total;
          const k = next;
          setShown((s) => [...s, k]);
          next += 1;
          pausedUntil = now + pause;
        }
        setProgress(pos);
      }
      if (pos < 1) raf = requestAnimationFrame(tick);
    };
    const start = setTimeout(() => (raf = requestAnimationFrame((t) => ((last = t), tick(t)))), 500);
    return () => {
      cancelled = true;
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [series, stops, compact]);

  const headIdx = Math.round(progress * (series.length - 1));
  const head = pts[headIdx];

  return (
    <>
    <div className={`vt-scope w-full ${compact ? "aspect-[4/2.2]" : "h-[240px] md:h-auto md:aspect-[4/1]"}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={fmt.l({ en: "Hourly load of the demo plant over the last 10 days", pt: "Carga horária da planta demo nos últimos 10 dias" })}>
        <defs>
          <clipPath id={clipId}>
            <rect x="-10" y="-10" width={progress * W + 10} height={H + 20} />
          </clipPath>
        </defs>
        <line x1="0" x2={W} y1={contractedY} y2={contractedY} stroke="#f5a524" strokeOpacity="0.45" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke="#f5a524"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="vt-trace"
          clipPath={`url(#${clipId})`}
        />
        {stops.map((s, i) =>
          shown.includes(i) ? (
            <circle key={i} cx={pts[s.idx][0]} cy={pts[s.idx][1]} r="5" fill="none" stroke="#8fd8ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          ) : null,
        )}
      </svg>
      {/* the spark is HTML so it stays round when the SVG stretches */}
      {head && progress > 0 && (
        <span
          className="vt-spark pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ left: `${(head[0] / W) * 100}%`, top: `${(head[1] / H) * 100}%` }}
        />
      )}
      <span className="vt-small absolute right-3 vt-num" style={{ top: `calc(${(contractedY / H) * 100}% - 1.4rem)` }}>
        {fmt.l({ en: "contracted demand", pt: "demanda contratada" })} {fmt.num(contracted)} kW
      </span>
      {stops.map((s, i) => {
        const content = callouts(s.anomaly);
        if (!content) return null;
        const x = (pts[s.idx][0] / W) * 100;
        const right = x > 50; // callout sits on the side with more room
        const placeBelow = s.anomaly.kind !== "demand_peak"; // peaks get the top, everything else sits low
        return (
          <div
            key={i}
            className="vt-callout hidden md:block"
            data-on={shown.includes(i)}
            style={{
              left: right ? undefined : `calc(${x}% + 14px)`,
              right: right ? `calc(${100 - x}% + 14px)` : undefined,
              top: placeBelow ? undefined : "0.75rem",
              bottom: placeBelow ? "0.75rem" : undefined,
            }}
          >
            {content}
          </div>
        );
      })}
    </div>
    {!compact && (
      <ul className="space-y-2 px-6 pt-4 md:hidden">
        {stops.map((s, i) => {
          const content = callouts(s.anomaly);
          return content && shown.includes(i) ? (
            <li key={i} className="vt-callout max-w-none" style={{ position: "static", opacity: 1, transform: "none" }}>
              {content}
            </li>
          ) : null;
        })}
      </ul>
    )}
    </>
  );
}