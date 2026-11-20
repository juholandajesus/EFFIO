import { useId } from "react";

/**
 * EFFIO's mark: a sculpted bolt (dark metal, amber rim, a sliver of its
 * extruded side showing) that lands and throws a spark at its tip.
 * The 3D version lives in bolt-logo-3d.tsx; this is the flat-rendered one
 * for menus, buttons and the favicon.
 */
export const BOLT_POINTS: [number, number][] = [
  [22.17, 3],
  [11, 20.3],
  [17.57, 20.3],
  [13.85, 33],
  [26.55, 13.51],
  [19.76, 13.51],
];
const TIP = BOLT_POINTS[3];
const d = (dx = 0, dy = 0) => "M" + BOLT_POINTS.map(([x, y]) => `${x + dx} ${y + dy}`).join(" L") + " Z";

export function BrandMark({ size = 28, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={`${animated ? "bm-live" : ""} ${className}`}>
      <defs>
        <linearGradient id={`f${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#3a4048" />
          <stop offset="0.5" stopColor="#15191e" />
          <stop offset="1" stopColor="#262b31" />
        </linearGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="0.55" stopColor="#f5a524" />
          <stop offset="1" stopColor="#ffe3a6" />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`g${id}`}>
          <stop offset="0" stopColor="#f5a524" stopOpacity="0.75" />
          <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <path d={d()} />
        </clipPath>
      </defs>
      {/* extruded side */}
      <path d={d(1.1, 0.9)} fill="#5a3504" />
      {/* front face, brushed dark metal */}
      <path d={d()} fill={`url(#f${id})`} />
      {/* a light sweep across the metal */}
      <g clipPath={`url(#c${id})`}>
        <rect className="bm-sheen" x="-14" y="0" width="10" height="40" fill={`url(#s${id})`} transform="skewX(-20)" />
      </g>
      <path d={d()} fill="none" stroke={`url(#r${id})`} strokeWidth="1.15" strokeLinejoin="round" />
      {/* the spark where it lands */}
      <circle cx={TIP[0]} cy={TIP[1]} r="5" fill={`url(#g${id})`} className="bm-glow" />
      <g stroke="#f5a524" strokeLinecap="round" className="bm-rays">
        <path d={`M${TIP[0]} ${TIP[1]} l0 4.6`} strokeWidth="1.3" />
        <path d={`M${TIP[0]} ${TIP[1]} l-4.4 2.6`} strokeWidth="1.1" />
        <path d={`M${TIP[0]} ${TIP[1]} l4.6 3`} strokeWidth="1.1" />
        <path d={`M${TIP[0]} ${TIP[1]} l-5 -0.8`} strokeWidth="0.9" />
        <path d={`M${TIP[0]} ${TIP[1]} l5.2 -0.2`} strokeWidth="0.8" />
      </g>
      <circle cx={TIP[0]} cy={TIP[1]} r="1.55" fill="#fff" />
    </svg>
  );
}

/** Logo + wordmark, used in the public header and the login. */
export function BrandLockup({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark size={size} animated />
      <span className="text-lg font-bold tracking-[0.3em]" style={{ fontStretch: "125%" }}>
        EFFIO
      </span>
    </span>
  );
}
