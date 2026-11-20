/** Faísca's mark: a welding spark, a bright core with uneven rays. */
export function FaiscaMark({ size = 28, flicker = false, className = "" }: { size?: number; flicker?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={`${flicker ? "vt-flicker" : ""} ${className}`}
    >
      <circle cx="16" cy="16" r="15" fill="#0f1b26" stroke="#22384b" />
      <g stroke="#8fd8ff" strokeLinecap="round">
        <path d="M16 16 L16 4.5" strokeWidth="2.2" />
        <path d="M16 16 L26.5 11" strokeWidth="1.6" />
        <path d="M16 16 L23 25.5" strokeWidth="2" />
        <path d="M16 16 L7.5 22" strokeWidth="1.3" />
        <path d="M16 16 L6 10" strokeWidth="1.1" />
      </g>
      <circle cx="16" cy="16" r="3.4" fill="#fff" />
      <circle cx="16" cy="16" r="5.5" fill="#8fd8ff" opacity="0.35" />
      <circle cx="27.5" cy="6" r="1.1" fill="#f5a524" />
    </svg>
  );
}
