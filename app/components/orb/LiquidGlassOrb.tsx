"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEmotion } from "@/context/EmotionContext";
import { EmotionState } from "@/types";

const STATE_LABEL: Record<EmotionState, string> = {
  idle:      "Ready",
  listening: "Listening…",
  thinking:  "Thinking…",
  speaking:  "Speaking",
  happy:     "Joyful",
  concerned: "Concerned",
  excited:   "Excited",
  calm:      "Calm",
};

/* Wave geometry */
function buildWavePath(
  time: number,
  amplitude: number,
  freq: number,
  cx = 140,
  cy = 140,
  r = 108,
  pts = 140,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const noise = amplitude * Math.sin(freq * a + time) + amplitude * 0.4 * Math.sin(freq * 2 * a + time * 1.3);
    const px = (cx + (r + noise) * Math.cos(a)).toFixed(2);
    const py = (cy + (r + noise) * Math.sin(a)).toFixed(2);
    parts.push(`${i === 0 ? "M" : "L"}${px} ${py}`);
  }
  return parts.join(" ") + " Z";
}

const AMPLITUDE_MAP: Record<EmotionState, number> = {
  idle: 1.5, listening: 5, thinking: 3.5, speaking: 8,
  happy: 6, concerned: 2.5, excited: 9, calm: 2,
};
const FREQ_MAP: Record<EmotionState, number> = {
  idle: 3, listening: 5, thinking: 6, speaking: 7,
  happy: 5, concerned: 4, excited: 8, calm: 3,
};
const SPEED_MAP: Record<EmotionState, number> = {
  idle: 0.006, listening: 0.025, thinking: 0.018, speaking: 0.032,
  happy: 0.022, concerned: 0.012, excited: 0.038, calm: 0.009,
};

export default function LiquidGlassOrb() {
  const { emotion, accentColor, glowColor } = useEmotion();
  const wavePathRef = useRef<SVGPathElement>(null);
  const wave2PathRef = useRef<SVGPathElement>(null);
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);

  /* Animate waveform */
  useEffect(() => {
    const amp   = AMPLITUDE_MAP[emotion];
    const freq  = FREQ_MAP[emotion];
    const speed = SPEED_MAP[emotion];

    const tick = () => {
      timeRef.current += speed;
      const t = timeRef.current;
      if (wavePathRef.current) {
        wavePathRef.current.setAttribute("d", buildWavePath(t, amp, freq));
      }
      if (wave2PathRef.current) {
        wave2PathRef.current.setAttribute("d", buildWavePath(t * 0.7 + Math.PI, amp * 0.6, freq, 140, 140, 112));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [emotion]);

  const active = emotion !== "idle";

  return (
    <div className="relative flex flex-col items-center gap-4 select-none">

      {/* Outer glow ring (active only) */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 340, height: 340,
              top: "50%", left: "50%",
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
              filter: "blur(30px)",
              x: "-50%", y: "-50%",
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Pulse rings */}
      {active && (
        <>
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 300, height: 300,
              top: "50%", left: "50%",
              border: `1px solid ${accentColor}50`,
              transform: "translate(-50%, -50%)",
              animation: "pulse-ring 2.4s ease-out infinite",
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 300, height: 300,
              top: "50%", left: "50%",
              border: `1px solid ${accentColor}30`,
              transform: "translate(-50%, -50%)",
              animation: "pulse-ring-outer 2.4s ease-out 0.8s infinite",
            }}
          />
        </>
      )}

      {/* Main orb — no click handler, purely reactive to emotion state */}
      <motion.div
        aria-label={`EchoMate — ${STATE_LABEL[emotion]}`}
        className="relative w-[280px] h-[280px] rounded-full"
        animate={active ? { scale: [1, 1.015, 1] } : { scale: [1, 1.03, 1] }}
        transition={active
          ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ transformOrigin: "center" }}
      >
        {/* Base sphere gradient */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            background: `
              radial-gradient(ellipse at 38% 32%, ${accentColor}50 0%, transparent 58%),
              radial-gradient(ellipse at 68% 72%, ${accentColor}25 0%, transparent 52%),
              radial-gradient(circle at center, ${accentColor}12 0%, #04040a 75%)
            `,
          }}
        />

        {/* SVG waveform ring */}
        <svg
          viewBox="0 0 280 280"
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <radialGradient id="wave-grad" cx="50%" cy="50%">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.1" />
            </radialGradient>
            <filter id="glow-filter">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Secondary wave */}
          <path
            ref={wave2PathRef}
            fill="none"
            stroke={accentColor}
            strokeWidth="0.8"
            strokeOpacity="0.25"
            filter="url(#glow-filter)"
          />
          {/* Primary wave */}
          <path
            ref={wavePathRef}
            fill="none"
            stroke={accentColor}
            strokeWidth="1.5"
            strokeOpacity="0.7"
            filter="url(#glow-filter)"
          />
        </svg>

        {/* Glass surface overlay */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        />

        {/* Specular highlight — top left */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: "55%", height: "45%",
            top: "8%", left: "10%",
            background: "radial-gradient(ellipse at 40% 35%, rgba(255,255,255,0.22) 0%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />

        {/* Bottom reflection */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: "40%", height: "25%",
            bottom: "12%", right: "14%",
            background: `radial-gradient(ellipse at center, ${accentColor}20 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {/* Thinking dots */}
          <AnimatePresence mode="wait">
            {emotion === "thinking" ? (
              <motion.div
                key="thinking"
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: accentColor,
                      animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </motion.div>
            ) : emotion === "listening" ? (
              <motion.div
                key="wave-bars"
                className="flex items-end gap-[3px] h-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{
                      height: "100%",
                      backgroundColor: accentColor,
                      transformOrigin: "bottom",
                      animation: `wave-bar 1.1s ease-in-out ${i * 0.11}s infinite`,
                      opacity: 0.85,
                    }}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="label"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 10px ${accentColor}`,
                    animation: active ? "badge-glow 2s ease-in-out infinite" : undefined,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Outer glass rim */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `1px solid ${accentColor}35`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 30px -8px ${glowColor}`,
            transition: "all 0.8s ease",
          }}
        />
      </motion.div>

      {/* Status label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={emotion}
          className="text-[13px] font-medium tracking-[0.04em] uppercase"
          style={{ color: `${accentColor}cc` }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {STATE_LABEL[emotion]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
