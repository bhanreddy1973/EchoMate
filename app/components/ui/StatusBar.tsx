"use client";

import { motion } from "framer-motion";
import { Wifi, WifiOff, Zap, Activity, Loader2 } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

export default function StatusBar() {
  const { emotion, metrics, accentColor } = useEmotion();

  return (
    <motion.div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      <div
        className="flex items-center gap-4 px-4 py-2 rounded-full text-[10.5px]"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        {/* Model */}
        <span className="text-text-ghost font-medium tracking-[0.03em]">{metrics.modelName}</span>

        <div className="w-px h-3 bg-white/10" />

        {/* Connection */}
        <div className="flex items-center gap-1.5">
          {metrics.connectionState === "connected" ? (
            <Wifi size={11} style={{ color: "#10b981" }} />
          ) : metrics.connectionState === "connecting" ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Loader2 size={11} style={{ color: "#f59e0b" }} />
            </motion.div>
          ) : (
            <WifiOff size={11} className="text-text-ghost" />
          )}
          <span className="text-text-ghost capitalize">
            {metrics.connectionState === "connecting" ? "Connecting to LiveKit…" : metrics.connectionState}
          </span>
        </div>

        <div className="w-px h-3 bg-white/10" />

        {/* Emotion */}
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: accentColor }}
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-text-muted capitalize">{emotion}</span>
          {metrics.confidence > 0 && (
            <span className="text-text-ghost">{Math.round(metrics.confidence * 100)}%</span>
          )}
        </div>

        {metrics.latencyMs > 0 && (
          <>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1">
              <Activity size={10} className="text-text-ghost" />
              <span className="text-text-ghost tabular-nums">{metrics.latencyMs}ms</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
