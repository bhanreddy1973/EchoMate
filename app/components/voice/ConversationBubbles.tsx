"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConversationBubble, EmotionState } from "@/types";
import { useEmotion } from "@/context/EmotionContext";
import clsx from "clsx";

const DEMO_BUBBLE_TEMPLATES: Array<{ id: string; text: string; role: "user" | "assistant"; emotion: EmotionState }> = [
  { id: "1", text: "Good morning! Ready to tackle the day?",       role: "assistant", emotion: "happy"    },
  { id: "2", text: "Show me my tasks for today.",                   role: "user",      emotion: "calm"     },
  { id: "3", text: "You have 5 tasks. High priority: Q3 review.", role: "assistant", emotion: "speaking" },
  { id: "4", text: "Remind me about the standup in 30 minutes.",   role: "user",      emotion: "idle"     },
  { id: "5", text: "Got it! Reminder set for 9:30 AM.",            role: "assistant", emotion: "happy"    },
];

const EMOTION_TEXT_COLOR: Record<string, string> = {
  happy:    "rgba(234,179,8,0.9)",
  excited:  "rgba(139,92,246,0.9)",
  concerned: "rgba(96,165,250,0.9)",
  calm:     "rgba(20,184,166,0.9)",
  default:  "rgba(255,255,255,0.85)",
};

/* Random positions around the orb center */
function getBubblePos(index: number, role: "user" | "assistant") {
  const positions = [
    { x: -320, y: -60 },
    { x:  280, y: -80 },
    { x: -300, y:  50 },
    { x:  260, y:  60 },
    { x: -180, y: -120 },
  ];
  return positions[index % positions.length];
}

export default function ConversationBubbles() {
  const [visibleBubbles, setVisibleBubbles] = useState<ConversationBubble[]>([]);
  const { accentColor } = useEmotion();
  const [demoIdx, setDemoIdx] = useState(0);

  /* Demo: show bubbles one at a time */
  useEffect(() => {
    if (demoIdx >= DEMO_BUBBLE_TEMPLATES.length) return;
    const timer = setTimeout(() => {
      const tpl = DEMO_BUBBLE_TEMPLATES[demoIdx];
      const bubble: ConversationBubble = { ...tpl, id: `${tpl.id}-${Date.now()}`, timestamp: new Date() };
      setVisibleBubbles((prev) => [...prev, bubble]);
      setDemoIdx((i) => i + 1);

      /* Auto-dismiss after 7s */
      setTimeout(() => {
        setVisibleBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
      }, 7000);
    }, 1800 + demoIdx * 2200);

    return () => clearTimeout(timer);
  }, [demoIdx]);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
      <AnimatePresence>
        {visibleBubbles.map((bubble, idx) => {
          const pos = getBubblePos(idx, bubble.role);
          const textColor = EMOTION_TEXT_COLOR[bubble.emotion ?? ""] ?? EMOTION_TEXT_COLOR.default;
          const isUser = bubble.role === "user";

          return (
            <motion.div
              key={bubble.id}
              className="absolute max-w-[220px] pointer-events-none"
              style={{ x: pos.x, y: pos.y }}
              initial={{ opacity: 0, scale: 0.75, y: pos.y + 16 }}
              animate={{ opacity: 1, scale: 1, y: pos.y }}
              exit={{ opacity: 0, scale: 0.88, y: pos.y - 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div
                className="relative px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed"
                style={{
                  background: isUser
                    ? "rgba(255,255,255,0.08)"
                    : `${accentColor}18`,
                  backdropFilter: "blur(20px) saturate(150%)",
                  WebkitBackdropFilter: "blur(20px) saturate(150%)",
                  border: isUser
                    ? "1px solid rgba(255,255,255,0.12)"
                    : `1px solid ${accentColor}35`,
                  color: textColor,
                  boxShadow: isUser
                    ? "0 4px 20px rgba(0,0,0,0.35)"
                    : `0 4px 20px rgba(0,0,0,0.35), 0 0 20px -8px ${accentColor}`,
                }}
              >
                {bubble.text}

                {/* Connector dot */}
                <div
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: isUser ? "rgba(255,255,255,0.3)" : accentColor,
                    bottom: -6,
                    [isUser ? "right" : "left"]: 14,
                  }}
                />
              </div>

              {/* Role label */}
              <p
                className={clsx(
                  "text-[9px] uppercase tracking-[0.06em] mt-1.5 font-medium",
                  isUser ? "text-right pr-1" : "pl-1",
                )}
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {isUser ? "You" : "EchoMate"}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
