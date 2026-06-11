"use client";

interface ProgressArcProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export default function ProgressArc({
  value,
  max = 100,
  size = 52,
  strokeWidth = 3.5,
  color = "var(--current-accent)",
  label,
}: ProgressArcProps) {
  const pct = Math.min(1, value / max);
  const r   = (size - strokeWidth) / 2;
  const cx  = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {label && (
        <span
          className="absolute text-[11px] font-semibold tabular-nums"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
