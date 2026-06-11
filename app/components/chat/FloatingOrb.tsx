"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

interface FloatingOrbProps {
  onVoiceToggle?: () => void;
  isListening?: boolean;
  isConnecting?: boolean;
}

export default function FloatingOrb({
  onVoiceToggle,
  isListening = false,
  isConnecting = false,
}: FloatingOrbProps) {
  const { accentColor, glowColor, emotion } = useEmotion();
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="fixed bottom-24 right-8 z-50"
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 200, delay: 0.5 }}
    >
      {/* Outer pulse ring */}
      <AnimatePresence>
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${accentColor}40` }}
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `1px solid ${accentColor}25` }}
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Main orb button */}
      <motion.button
        onClick={onVoiceToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isConnecting}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 disabled:cursor-wait"
        style={{
          background: isListening
            ? `radial-gradient(circle at 35% 35%, ${accentColor}60, ${accentColor}30)`
            : `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.08), rgba(255,255,255,0.03))`,
          border: isListening
            ? `1.5px solid ${accentColor}60`
            : "1.5px solid rgba(255,255,255,0.12)",
          boxShadow: isListening
            ? `0 0 40px -5px ${glowColor}, inset 0 0 20px -5px ${glowColor}`
            : hovered
            ? "0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)"
            : "0 4px 16px -4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px) saturate(150%)",
        }}
        animate={
          isListening
            ? {
                boxShadow: [
                  `0 0 40px -5px ${glowColor}, inset 0 0 20px -5px ${glowColor}`,
                  `0 0 60px -5px ${glowColor}, inset 0 0 30px -5px ${glowColor}`,
                  `0 0 40px -5px ${glowColor}, inset 0 0 20px -5px ${glowColor}`,
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        aria-label={isConnecting ? "Connecting..." : isListening ? "Stop listening" : "Start voice"}
      >
        {/* Inner glow */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 60%)`,
          }}
        />

        {/* Icon */}
        <motion.div
          animate={
            isConnecting
              ? { rotate: 360 }
              : isListening
              ? { scale: [1, 1.15, 1] }
              : {}
          }
          transition={
            isConnecting
              ? { duration: 1, repeat: Infinity, ease: "linear" }
              : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {isConnecting ? (
            <Loader2 size={20} style={{ color: accentColor }} />
          ) : isListening ? (
            <Mic size={20} style={{ color: accentColor }} />
          ) : (
            <MicOff size={18} className="text-white/50" />
          )}
        </motion.div>

        {/* Waveform bars when listening */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              className="absolute -bottom-1 flex items-end gap-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="w-[2px] rounded-full"
                  style={{ background: accentColor }}
                  animate={{ height: [3, 8 + Math.random() * 4, 3] }}
                  transition={{
                    duration: 0.6 + Math.random() * 0.3,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}
