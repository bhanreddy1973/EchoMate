import clsx from "clsx";
import { AgentStatus } from "../types";

interface VoiceOrbProps {
  status: AgentStatus;
  size?: "sm" | "md" | "lg";
}

/* ─── Size tokens ──────────────────────────────────────────────────── */
const SIZES = {
  sm: {
    orb:     "w-10 h-10",
    ring1:   "w-16 h-16",   /* fast inner ring */
    ring2:   "w-20 h-20",   /* slow outer ring */
    bars:    { wrap: "gap-[2px]", bar: "w-[2px] h-2.5" },
    dots:    "w-1 h-1",
    icon:    "w-4 h-4",
  },
  md: {
    orb:     "w-16 h-16",
    ring1:   "w-26 h-26",
    ring2:   "w-32 h-32",
    bars:    { wrap: "gap-[3px]", bar: "w-[2.5px] h-5" },
    dots:    "w-1.5 h-1.5",
    icon:    "w-5 h-5",
  },
  lg: {
    orb:     "w-32 h-32",
    ring1:   "w-52 h-52",
    ring2:   "w-64 h-64",
    bars:    { wrap: "gap-1", bar: "w-[3px] h-9" },
    dots:    "w-2.5 h-2.5",
    icon:    "w-9 h-9",
  },
} as const;

/* ─── Status colours ───────────────────────────────────────────────── */
const STATUS = {
  idle: {
    orb:   "bg-gradient-to-br from-surface-tertiary to-surface-hover border border-border-primary",
    ring:  "bg-text-muted/20",
    glow:  "",
    label: "text-text-muted",
  },
  listening: {
    orb:   "bg-gradient-to-br from-accent-green/60 to-accent-green glow-green",
    ring:  "bg-accent-green/30",
    glow:  "glow-green",
    label: "text-accent-green",
  },
  thinking: {
    orb:   "bg-gradient-to-br from-accent-amber/60 to-accent-amber glow-amber",
    ring:  "bg-accent-amber/25",
    glow:  "glow-amber",
    label: "text-accent-amber",
  },
  speaking: {
    orb:   "bg-gradient-to-br from-accent-blue/80 to-accent-purple glow-blue",
    ring:  "bg-accent-purple/30",
    glow:  "glow-blue",
    label: "text-accent-blue",
  },
} satisfies Record<AgentStatus, { orb: string; ring: string; glow: string; label: string }>;

export default function VoiceOrb({ status, size = "md" }: VoiceOrbProps) {
  const isActive = status !== "idle";
  const s       = SIZES[size];
  const c       = STATUS[status];

  return (
    <div className="relative flex items-center justify-center select-none">

      {/* ── Outer slow ring ─────────────────────────────────────── */}
      {isActive && (
        <div
          className={clsx("absolute rounded-full", s.ring2, c.ring)}
          style={{ animation: "pulse-ring-outer 3.2s ease-out infinite", animationDelay: "0.7s" }}
        />
      )}

      {/* ── Inner fast ring ─────────────────────────────────────── */}
      {isActive && (
        <div
          className={clsx("absolute rounded-full", s.ring1, c.ring)}
          style={{ animation: "pulse-ring 2s ease-out infinite" }}
        />
      )}

      {/* ── Main orb ────────────────────────────────────────────── */}
      <div
        className={clsx(
          "rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-700",
          s.orb,
          c.orb,
          isActive && "animate-[float_3.5s_ease-in-out_infinite]",
        )}
      >
        {/* Inner specular shine */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/14 via-transparent to-transparent pointer-events-none" />

        {/* ── Content ─────────────────────────────────────────── */}
        {(status === "listening" || status === "speaking") && (
          <div className={clsx("relative z-10 flex items-center", s.bars.wrap)}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={clsx("rounded-full bg-white/90 origin-bottom", s.bars.bar)}
                style={{
                  animation: `wave 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.13}s`,
                }}
              />
            ))}
          </div>
        )}

        {status === "thinking" && (
          <div className="relative z-10 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={clsx("rounded-full bg-white/90", s.dots)}
                style={{
                  animation: `float 1.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.22}s`,
                }}
              />
            ))}
          </div>
        )}

        {status === "idle" && (
          <svg
            className={clsx("relative z-10 text-text-muted", s.icon)}
            fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.4}
          >
            <path
              strokeLinecap="round" strokeLinejoin="round"
              d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </div>

      {/* ── Status label (lg only) ───────────────────────────────── */}
      {size === "lg" && (
        <span
          className={clsx(
            "absolute -bottom-9 text-xs font-medium capitalize tracking-wide transition-colors duration-300",
            c.label,
          )}
        >
          {status === "idle" ? "Ready" : `${status}…`}
        </span>
      )}
    </div>
  );
}
