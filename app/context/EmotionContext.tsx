"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { EmotionState, ConnectionState, EmotionMetrics } from "@/types";

interface EmotionContextValue {
  emotion: EmotionState;
  metrics: EmotionMetrics;
  setEmotion: (e: EmotionState) => void;
  setMetrics: (m: Partial<EmotionMetrics>) => void;
  accentColor: string;
  glowColor: string;
}

const ACCENT_MAP: Record<EmotionState, string> = {
  idle:      "#6366f1",
  listening: "#06b6d4",
  thinking:  "#f59e0b",
  speaking:  "#10b981",
  happy:     "#eab308",
  concerned: "#60a5fa",
  excited:   "#8b5cf6",
  calm:      "#14b8a6",
};

const GLOW_MAP: Record<EmotionState, string> = {
  idle:      "rgba(99,102,241,0.45)",
  listening: "rgba(6,182,212,0.45)",
  thinking:  "rgba(245,158,11,0.45)",
  speaking:  "rgba(16,185,129,0.45)",
  happy:     "rgba(234,179,8,0.45)",
  concerned: "rgba(96,165,250,0.4)",
  excited:   "rgba(139,92,246,0.5)",
  calm:      "rgba(20,184,166,0.4)",
};

const EmotionContext = createContext<EmotionContextValue | null>(null);

export function EmotionProvider({ children }: { children: ReactNode }) {
  const [emotion, setEmotionState] = useState<EmotionState>("idle");
  const [metrics, setMetricsState] = useState<EmotionMetrics>({
    current: "idle",
    confidence: 0,
    latencyMs: 0,
    modelName: "EchoMate v1",
    connectionState: "disconnected",
  });

  const setEmotion = useCallback((e: EmotionState) => {
    setEmotionState(e);
    setMetricsState((prev) => ({ ...prev, current: e }));
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-emotion", e);
      document.documentElement.style.setProperty("--current-accent", ACCENT_MAP[e]);
      document.documentElement.style.setProperty("--current-glow", GLOW_MAP[e]);
      document.documentElement.style.setProperty("--current-glow-sm", GLOW_MAP[e].replace("0.45", "0.2").replace("0.5", "0.22").replace("0.4", "0.18"));
    }
  }, []);

  const setMetrics = useCallback((m: Partial<EmotionMetrics>) => {
    setMetricsState((prev) => ({ ...prev, ...m }));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-emotion", emotion);
  }, [emotion]);

  return (
    <EmotionContext.Provider
      value={{
        emotion,
        metrics,
        setEmotion,
        setMetrics,
        accentColor: ACCENT_MAP[emotion],
        glowColor: GLOW_MAP[emotion],
      }}
    >
      {children}
    </EmotionContext.Provider>
  );
}

export function useEmotion() {
  const ctx = useContext(EmotionContext);
  if (!ctx) throw new Error("useEmotion must be used within EmotionProvider");
  return ctx;
}
