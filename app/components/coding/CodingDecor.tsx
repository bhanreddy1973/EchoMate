"use client";

import { motion } from "framer-motion";

export function CodingDecor({ accentColor }: { accentColor: string }) {
  const nodes = [
    { x: "8%", y: "18%", d: 0 },
    { x: "86%", y: "16%", d: 0.6 },
    { x: "18%", y: "82%", d: 1.1 },
    { x: "74%", y: "78%", d: 1.7 },
    { x: "50%", y: "50%", d: 2.2 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.11]"
        style={{
          backgroundImage: `linear-gradient(${accentColor}26 1px, transparent 1px), linear-gradient(90deg, ${accentColor}26 1px, transparent 1px)`,
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(circle at 50% 45%, black, transparent 72%)",
        }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accentColor}18, transparent 68%)` }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      {nodes.map((node, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{ left: node.x, top: node.y, background: accentColor, boxShadow: `0 0 20px ${accentColor}` }}
          animate={{ opacity: [0.18, 0.75, 0.18], scale: [0.8, 1.35, 0.8] }}
          transition={{ duration: 3.4, delay: node.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function ThinkingWave({ color, label = "Thinking" }: { color: string; label?: string }) {
  const bars = [7, 13, 9, 16, 10, 14, 8];
  return (
    <div className="flex items-center gap-2 text-[11px] text-text-muted">
      <div className="flex h-5 items-center gap-[3px] rounded-full border border-white/10 bg-white/[0.035] px-2">
        {bars.map((height, i) => (
          <motion.span
            key={i}
            className="w-[2px] rounded-full"
            style={{ background: color }}
            animate={{ height: [4, height, 4], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.85, delay: i * 0.08, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <span>{label}</span>
    </div>
  );
}
