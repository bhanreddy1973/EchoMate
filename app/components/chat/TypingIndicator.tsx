"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

export default function TypingIndicator() {
  const { accentColor, glowColor } = useEmotion();

  return (
    <motion.div
      className="flex justify-start gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Avatar */}
      <motion.div
        className="w-7 h-7 rounded-full shrink-0 mt-1 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}15)`,
          border: `1px solid ${accentColor}30`,
          boxShadow: `0 0 12px ${glowColor}`,
        }}
        animate={{
          boxShadow: [
            `0 0 12px ${glowColor}`,
            `0 0 24px ${glowColor}`,
            `0 0 12px ${glowColor}`,
          ],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles size={11} style={{ color: accentColor }} />
      </motion.div>

      {/* Thinking bubble */}
      <div
        className="px-5 py-4 rounded-2xl rounded-tl-md flex items-center gap-3"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px) saturate(150%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: `0 4px 12px -2px rgba(0,0,0,0.3), 0 0 20px -8px ${glowColor}`,
        }}
      >
        {/* Animated dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: accentColor }}
              animate={{
                scale: [0.6, 1.1, 0.6],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        <span className="text-[11px] text-white/35 font-medium">
          Thinking...
        </span>
      </div>
    </motion.div>
  );
}
