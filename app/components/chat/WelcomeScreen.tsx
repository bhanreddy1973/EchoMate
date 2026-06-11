"use client";

import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Mic, Zap, BookOpen, Brain, ListChecks } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: ListChecks,
    label: "Plan my day",
    prompt: "Help me plan my day. I have several tasks to prioritize.",
    color: "#10b981",
  },
  {
    icon: Brain,
    label: "Brainstorm ideas",
    prompt: "I need to brainstorm creative solutions for a project I'm working on.",
    color: "#8b5cf6",
  },
  {
    icon: BookOpen,
    label: "Summarize something",
    prompt: "Help me summarize and understand a complex topic.",
    color: "#f59e0b",
  },
  {
    icon: Zap,
    label: "Quick task",
    prompt: "I have a quick task that needs to be done efficiently.",
    color: "#06b6d4",
  },
];

export default function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  const { accentColor, glowColor } = useEmotion();

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      {/* Animated orb */}
      <motion.div
        className="relative mb-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
      >
        <motion.div
          className="w-20 h-20 rounded-full flex items-center justify-center relative"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${accentColor}40, ${accentColor}10, transparent)`,
            border: `1px solid ${accentColor}25`,
            boxShadow: `0 0 60px -10px ${glowColor}, inset 0 0 30px -10px ${glowColor}`,
          }}
          animate={{
            boxShadow: [
              `0 0 60px -10px ${glowColor}, inset 0 0 30px -10px ${glowColor}`,
              `0 0 80px -10px ${glowColor}, inset 0 0 40px -10px ${glowColor}`,
              `0 0 60px -10px ${glowColor}, inset 0 0 30px -10px ${glowColor}`,
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles size={28} style={{ color: accentColor }} />
        </motion.div>

        {/* Pulse rings */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid ${accentColor}20` }}
          animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid ${accentColor}15` }}
          animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
        />
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-2xl font-semibold text-white/90 mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Good to see you
      </motion.h1>
      <motion.p
        className="text-[14px] text-white/40 mb-10 text-center max-w-md"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        I&apos;m EchoMate, your intelligent voice companion. How can I help you today?
      </motion.p>

      {/* Suggestion cards */}
      <motion.div
        className="grid grid-cols-2 gap-3 w-full max-w-lg"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {SUGGESTIONS.map((suggestion, i) => (
          <motion.button
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="group flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
              style={{
                background: `${suggestion.color}15`,
                border: `1px solid ${suggestion.color}25`,
              }}
            >
              <suggestion.icon size={14} style={{ color: suggestion.color }} />
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-white/75 group-hover:text-white/90 transition-colors">
                {suggestion.label}
              </p>
              <p className="text-[11px] text-white/30 mt-0.5 leading-snug line-clamp-2">
                {suggestion.prompt.slice(0, 50)}...
              </p>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
