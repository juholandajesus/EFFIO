import { useEffect, useRef, useState } from "react";

/**
 * The landing hero: a bolt strikes the plant's real load curve, the curve
 * lights up outward from the impact and each waste window ignites as the
 * light reaches it. One strong opening, then a quiet life: a faint afterglow,
 * breathing hot spots and a current that runs along the curve now and then.
 * Prefers-reduced-motion gets the final frame, still.
 */

export interface Hotspot {
  start: number; // index into values
  end: number;
  label: React.ReactNode;
  onOpen?: () => void;
}

const AMBER = "245,165,36";
const HOT = "255,241,207";

const T_LEADER = 0.2; // the leader starts coming down
const T_LAND = 0.42; // it touches the curve
const IGNITE_S = 1.5; // time for the light to cross the whole width

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

type Pt = [number, number];

function bolt(r: () => number, a: Pt, b: Pt, rough: number, depth: number): Pt[] {
  let pts: Pt[] = [a, b];
  let off = rough;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const nx = -(y2 - y1);
      const ny = x2 - x1;
      const len = Math.hypot(nx, ny) || 1;
      const k = (r() - 0.5) * off;
      next.push(pts[i], [(x1 + x2) / 2 + (nx / len) * k, (y1 + y2) / 2 + (ny / len) * k]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    off *= 0.55;
  }
  return pts;
}

interface Geometry {
  W: number;
  H: number;
  curve: Pt[];
  landX: number;
  landY: number;
  main: Pt[];
  forks: Pt[][];
  spots: { cx: number; cy: number; x0: number; x1: number; top: number; at: number }[];
}

function layout(W: number, H: number, values: number[], spots: Hotspot[], narrow: boolean): Geometry {
  // the curve lives in a band at the foot of the hero, under the copy
  const top = H - (narrow ? 215 : 290);
  const bottom = H - (narrow ? 45 : 50);
  const max = Math.max(...values) * 1.04;
  const n = values.length;
  const curve: Pt[] = values.map((v, i) => [(i / (n - 1)) * W, bottom - (v / max) * (bottom - top)]);
  const at = (x: number) => curve[Math.max(0, Math.min(n - 1, Math.round((x / W) * (n - 1))))][1];
  const landX = W * (narrow ? 0.66 : 0.71);
  const landY = at(landX);
  const r = rng(20261119);
  const startX = landX + W * (narrow ? 0.22 : 0.12);
  const main = bolt(r, [startX, -20], [landX, landY], narrow ? 90 : 150, 8);
  const forks: Pt[][] = [];
  for (let k = 0; k < 5; k++) {
    const i = 3 + Math.floor(r() * (main.length * 0.75));
    const [x, y] = main[i];
    const [nx, ny] = main[i + 1];
    const ang = Math.atan2(ny - y, nx - x) + (r() - 0.5) * 1.7;
    const L = (narrow ? 60 : 110) * (0.5 + r() * 0.7);
    forks.push(bolt(r, [x, y], [x + Math.cos(ang) * L, y + Math.sin(ang) * L], L * 0.4, 6));
  }
  const speed = W / IGNITE_S;
  const geo = spots.map((s) => {
    const i0 = Math.max(0, Math.min(n - 1, s.start));
    const i1 = Math.max(i0, Math.min(n - 1, s.end));
    const x0 = curve[i0][0];
    const x1 = curve[i1][0];
    const cx = (x0 + x1) / 2;
    let peak = Infinity;
    for (let i = i0; i <= i1; i++) peak = Math.min(peak, curve[i][1]);
    return { cx, cy: at(cx), x0, x1, top: peak, at: T_LAND + Math.abs(cx - landX) / speed };
  });
  return { W, H, curve, landX, landY, main, forks, spots: geo };
}

function stroke(g: CanvasRenderingContext2D, pts: Pt[], upto = pts.length) {
  g.beginPath();
  for (let i = 0; i < upto; i++) (i ? g.lineTo : g.moveTo).call(g, pts[i][0], pts[i][1]);
  g.stroke();
}

/** soft glow without shadowBlur: wide faint strokes under a bright core */
function glowLine(g: CanvasRenderingContext2D, pts: Pt[], width: number, alpha: number, upto?: number, hot = HOT) {
  if (alpha <= 0.002) return;
  for (const [w, a] of [[width * 9, 0.04], [width * 4.5, 0.1], [width * 2, 0.32]] as const) {
    g.strokeStyle = `rgba(${AMBER},${a * alpha})`;
    g.lineWidth = w;
    stroke(g, pts, upto);
  }
  g.strokeStyle = `rgba(${hot},${Math.min(1, alpha)})`;
  g.lineWidth = width * 0.75;
  stroke(g, pts, upto);
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, rgb = AMBER) {
  if (a <= 0.002) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hot: boolean;
}

export function StrikeCurve({ values, hotspots, narrow }: { values: number[]; hotspots: Hotspot[]; narrow: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<{ x: number; y: number; delay: number }[]>([]);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = host.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    let geo: Geometry | null = null;
    let dpr = 1;

    const resize = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      geo = layout(W, H, values, hotspots, narrow);
      setLabels(
        geo.spots.map((s) => ({
          x: Math.max(narrow ? 120 : 170, Math.min(W - (narrow ? 120 : 170), s.cx)),
          y: s.top,
          delay: reduce ? 0 : s.at + 0.25,
        })),
      );
      if (reduce) draw(6);
    };

    const sparks: Spark[] = [];
    const burst = (x: number, y: number, n: number, power: number) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * Math.random();
        const v = power * (0.25 + Math.random());
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.9, hot: Math.random() < 0.3 });
      }
    };
    const fired = new Set<number>();

    // how bright the bolt is at time t: leader, strike, two return strokes, afterglow
    const boltI = (t: number) => {
      if (t < T_LEADER) return 0;
      if (t < T_LAND) return 0.75;
      const d = t - T_LAND;
      let i = 0.12 + 0.88 * Math.exp(-d * 3.2);
      if (d > 0.17 && d < 0.23) i += 0.7;
      if (d > 0.38 && d < 0.43) i += 0.45;
      if (t > 4) {
        // the quiet life: a faint shimmer and a soft re-flicker every ~15 s
        i = 0.11 + 0.025 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
        const c = (t - 4) % 15;
        if (c > 11 && c < 11.09) i += 0.3;
        if (c > 11.16 && c < 11.21) i += 0.18;
      }
      return Math.min(i, 1.4);
    };

    function draw(t: number, dt = 0) {
      if (!geo || !g) return;
      const { W, H, curve, landX, landY, main, forks, spots } = geo;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.lineJoin = "round";
      g.lineCap = "round";

      const reach = t < T_LAND ? 0 : ((t - T_LAND) / IGNITE_S) * W;
      const x0 = landX - reach;
      const x1 = landX + reach;

      // the curve before it is lit: just a trace
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = "rgba(237,241,244,0.09)";
      g.lineWidth = 1;
      stroke(g, curve);

      g.globalCompositeOperation = "lighter";
      if (reach > 0) {
        g.save();
        g.beginPath();
        g.rect(x0, 0, x1 - x0, H);
        g.clip();
        // light pooled under the curve
        const top = Math.min(...curve.map((p) => p[1]));
        const fill = g.createLinearGradient(0, top, 0, H);
        fill.addColorStop(0, `rgba(${AMBER},0.13)`);
        fill.addColorStop(1, `rgba(${AMBER},0)`);
        g.fillStyle = fill;
        g.beginPath();
        curve.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.lineTo(W, H);
        g.lineTo(0, H);
        g.closePath();
        g.fill();
        glowLine(g, curve, 1.5, 0.85, undefined, "255,214,140");
        g.restore();
        // the two fronts of light running outward
        if (reach < W * 1.05) {
          const at = (x: number) => curve[Math.max(0, Math.min(curve.length - 1, Math.round((x / W) * (curve.length - 1))))][1];
          for (const fx of [x0, x1]) if (fx > -20 && fx < W + 20) {
            blob(g, fx, at(fx), 46, 0.5);
            blob(g, fx, at(fx), 8, 0.9, HOT);
          }
        }
      }

      // the waste windows: hotter line, a glow that breathes, a ring when they ignite
      spots.forEach((s, k) => {
        if (t < s.at) return;
        const since = t - s.at;
        if (!fired.has(k) && !reduce) {
          fired.add(k);
          burst(s.cx, s.cy, 50, 160);
        }
        g.save();
        g.beginPath();
        g.rect(s.x0, 0, s.x1 - s.x0, H);
        g.clip();
        glowLine(g, curve, 2.4, Math.min(1, since * 3));
        g.restore();
        const breathe = 0.32 + 0.12 * Math.sin(t * 1.8 + k * 2);
        blob(g, s.cx, s.cy, narrow ? 50 : 80, breathe * Math.min(1, since * 2));
        blob(g, s.cx, s.cy, 5, 0.95, HOT);
        if (since < 1.1) {
          g.strokeStyle = `rgba(${AMBER},${0.6 * (1 - since / 1.1)})`;
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(s.cx, s.cy, 8 + since * 70, 0, Math.PI * 2);
          g.stroke();
        }
      });

      // the bolt
      const I = boltI(t);
      if (I > 0) {
        const upto = t < T_LAND ? Math.max(2, Math.floor(((t - T_LEADER) / (T_LAND - T_LEADER)) * main.length)) : main.length;
        const scale = narrow ? 0.7 : 1;
        glowLine(g, main, 2.6 * scale, I, upto);
        if (I > 0.3 && t >= T_LAND) forks.forEach((f) => glowLine(g, f, 1.3 * scale, (I - 0.3) * 0.9));
        if (t >= T_LAND) {
          blob(g, landX, landY, narrow ? 90 : 150, 0.35 * Math.min(1, I));
          blob(g, landX, landY, 10, Math.min(1, I + 0.2), HOT);
        }
      }

      // the flash that lights the whole room
      if (t >= T_LAND && !reduce) {
        const d = t - T_LAND;
        let f = 0.2 * Math.exp(-d * 6);
        if (d > 0.17 && d < 0.23) f += 0.07;
        if (d > 0.38 && d < 0.43) f += 0.04;
        if (f > 0.003) {
          g.globalCompositeOperation = "source-over";
          blob(g, landX, landY * 0.6, Math.max(W, H) * 1.1, f, "255,222,170");
          g.globalCompositeOperation = "lighter";
        }
      }
      if (t >= T_LAND && !fired.has(-1) && !reduce) {
        fired.add(-1);
        burst(landX, landY, 150, 420);
      }

      // a current runs along the curve every 7 s
      if (t > 3.2 && !reduce) {
        const c = (t - 3.2) % 7;
        if (c < 2.6) {
          const p = c / 2.6;
          const idx = p * (curve.length - 1);
          const i = Math.floor(idx);
          const [px, py] = curve[i];
          const tail = curve.slice(Math.max(0, i - 10), i + 1);
          glowLine(g, tail, 1.6, 0.6);
          blob(g, px, py, 22, 0.55);
          blob(g, px, py, 3.5, 1, HOT);
        }
      }

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life > s.max) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 520 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = 1 - s.life / s.max;
        g.fillStyle = `rgba(${s.hot ? HOT : AMBER},${a})`;
        g.fillRect(s.x - 1, s.y - 1, 2, 2);
      }
      g.globalCompositeOperation = "source-over";
    }

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    if (reduce) return () => ro.disconnect();

    // a clock that only runs while the hero is on screen, so nobody misses the strike
    let running = true;
    const io = new IntersectionObserver(([e]) => (running = e.isIntersecting));
    io.observe(el);
    let t = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!running || document.hidden) return;
      t += dt;
      draw(t, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, narrow, hotspots.length]);

  return (
    <div ref={host} className="absolute inset-0 overflow-hidden" aria-hidden={false}>
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      {labels.map((l, i) => (
        <button
          key={i}
          type="button"
          className="cn-hot"
          style={{ left: l.x, top: l.y, animationDelay: `${l.delay}s` }}
          onClick={hotspots[i]?.onOpen}
          data-testid={`hotspot-${i}`}
        >
          <span className="cn-hot-card">{hotspots[i]?.label}</span>
          <span className="cn-hot-line" />
        </button>
      ))}
    </div>
  );
}
