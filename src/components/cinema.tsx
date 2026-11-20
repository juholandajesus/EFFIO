import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** A Netflix-style row: title, horizontal track, arrows on hover. */
export function Row({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const page = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="cn-row relative" data-testid={testId}>
      <h2 className="cn-h2 px-[4%] pb-3">{title}</h2>
      <div className="relative">
        <button className="cn-arrow left-0" onClick={() => page(-1)} aria-label="‹">
          <ChevronLeft className="h-7 w-7" />
        </button>
        <div ref={track} className="cn-row-track">
          {children}
        </div>
        <button className="cn-arrow right-0" onClick={() => page(1)} aria-label="›">
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>
    </section>
  );
}

/** A tile that grows on hover and reveals details underneath. */
export function Tile({ face, details, onOpen, label }: { face: ReactNode; details: ReactNode; onOpen?: () => void; label: string }) {
  return (
    <div className="cn-tile" data-testid="cn-tile">
      <button className="cn-tile-face text-left" onClick={onOpen} aria-label={label}>
        {face}
      </button>
      <div className="cn-tile-details">{details}</div>
    </div>
  );
}

/**
 * Thumbnail of the plant's load around an event: the curve as a glowing line,
 * the problem hours lit in amber. Pure SVG so dozens of tiles stay cheap.
 */
export function CurveThumb({ values, highlight, tone = "amber", max: fixedMax }: { values: number[]; highlight?: [number, number]; tone?: "amber" | "arc"; max?: number }) {
  const W = 320;
  const H = 180;
  const max = fixedMax ?? (Math.max(...values) * 1.08 || 1);
  const x = (i: number) => (i / Math.max(values.length - 1, 1)) * W;
  const y = (v: number) => H - 18 - (v / max) * (H - 50);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const color = tone === "amber" ? "#f5a524" : "#8fd8ff";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`fade-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#12171d" />
      {highlight && <rect x={x(highlight[0])} width={Math.max(x(highlight[1]) - x(highlight[0]), 3)} y="0" height={H} fill={color} opacity="0.12" />}
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#fade-${tone})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}
