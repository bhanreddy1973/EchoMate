"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConversationBubble, EmotionState } from "@/types";
import { useEmotion } from "@/context/EmotionContext";

interface InsightBubble {
  id: string;
  text: string;
  emotion: EmotionState;
}

/**
 * Generates contextual insight messages based on:
 * - Current tasks (from localStorage)
 * - Completed items
 * - Time of day
 * - Memories
 */
function generateInsights(): InsightBubble[] {
  const h = new Date().getHours();
  const insights: InsightBubble[] = [];

  // Read tasks from localStorage
  let pendingTasks: any[] = [];
  let completedTasks: any[] = [];
  try {
    const stored = localStorage.getItem("echomate-tasks");
    if (stored) {
      const tasks = JSON.parse(stored);
      pendingTasks = tasks.filter((t: any) => !t.completed);
      completedTasks = tasks.filter((t: any) => t.completed);
    }
  } catch {}

  // Read memories
  let memories: any[] = [];
  try {
    const stored = localStorage.getItem("echomate-memories");
    if (stored) memories = JSON.parse(stored);
  } catch {}

  // Time-based greeting
  if (h < 12) {
    insights.push({ id: "greet", text: `Good morning! You have ${pendingTasks.length} tasks ahead.`, emotion: "happy" });
  } else if (h < 17) {
    insights.push({ id: "greet", text: `Afternoon focus mode. ${pendingTasks.length} tasks remaining.`, emotion: "calm" });
  } else {
    insights.push({ id: "greet", text: `Evening recap time. ${completedTasks.length} tasks completed today.`, emotion: "calm" });
  }

  // High priority alert
  const highPri = pendingTasks.filter((t: any) => t.priority === "high");
  if (highPri.length > 0) {
    insights.push({
      id: "priority",
      text: `⚡ Priority: "${highPri[0].text.slice(0, 35)}"`,
      emotion: "concerned",
    });
  }

  // Completed task celebration
  if (completedTasks.length > 0) {
    const latest = completedTasks[completedTasks.length - 1];
    insights.push({
      id: "done",
      text: `✓ Done: "${latest.text.slice(0, 30)}" — nice work!`,
      emotion: "happy",
    });
  }

  // Overdue check
  const overdue = pendingTasks.filter((t: any) => t.dueDate && new Date(t.dueDate).getTime() < Date.now());
  if (overdue.length > 0) {
    insights.push({
      id: "overdue",
      text: `⏰ ${overdue.length} overdue task${overdue.length > 1 ? "s" : ""} need attention.`,
      emotion: "concerned",
    });
  }

  // Memory-based insight
  if (memories.length > 0) {
    const pinned = memories.filter((m: any) => m.pinned);
    if (pinned.length > 0) {
      const pick = pinned[Math.floor(Math.random() * pinned.length)];
      insights.push({
        id: "memory",
        text: `💡 Remember: "${pick.content?.slice(0, 40)}"`,
        emotion: "calm",
      });
    }
  }

  // Progress insight
  const totalTasks = pendingTasks.length + completedTasks.length;
  if (totalTasks > 0) {
    const pct = Math.round((completedTasks.length / totalTasks) * 100);
    insights.push({
      id: "progress",
      text: `📊 ${pct}% complete today. ${pct >= 80 ? "Almost there!" : pct >= 50 ? "Great progress!" : "Keep going!"}`,
      emotion: pct >= 80 ? "excited" : pct >= 50 ? "happy" : "calm",
    });
  }

  // Time-based productivity tip
  if (h >= 9 && h < 11) {
    insights.push({ id: "tip", text: "🧠 Peak focus window — tackle deep work now.", emotion: "excited" });
  } else if (h >= 14 && h < 15) {
    insights.push({ id: "tip", text: "☕ Post-lunch dip — a short walk helps.", emotion: "calm" });
  } else if (h >= 17 && h < 19) {
    insights.push({ id: "tip", text: "🌅 Wrap up open loops before tomorrow.", emotion: "calm" });
  }

  return insights;
}

/* Positions around the orb — spread evenly */
const BUBBLE_POSITIONS = [
  { x: -310, y: -70 },
  { x: 270, y: -90 },
  { x: -290, y: 60 },
  { x: 250, y: 70 },
  { x: -200, y: -130 },
  { x: 200, y: 120 },
  { x: -330, y: 10 },
];

export default function ConversationBubbles() {
  const [visibleBubbles, setVisibleBubbles] = useState<ConversationBubble[]>([]);
  const { accentColor } = useEmotion();
  const [insights, setInsights] = useState<InsightBubble[]>([]);
  const indexRef = useRef(0);
  const [aiBubbles, setAiBubbles] = useState<InsightBubble[]>([]);

  // Generate local insights on mount
  useEffect(() => {
    const local = generateInsights();
    setInsights(local);

    // Also try to fetch AI-generated recap insights
    fetchAiInsights(local);
  }, []);

  // Fetch AI-generated contextual insights
  const fetchAiInsights = async (fallback: InsightBubble[]) => {
    try {
      let taskContext = "";
      const stored = localStorage.getItem("echomate-tasks");
      if (stored) {
        const tasks = JSON.parse(stored);
        const pending = tasks.filter((t: any) => !t.completed).map((t: any) => t.text);
        const done = tasks.filter((t: any) => t.completed).map((t: any) => t.text);
        taskContext = `Pending: ${pending.join(", ")}. Completed: ${done.join(", ")}.`;
      }

      const h = new Date().getHours();
      const timeOfDay = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noSave: true,
          messages: [{
            role: "user",
            content: `You are EchoMate, a voice companion. It's ${timeOfDay}. Generate exactly 3 short insight messages (max 12 words each) as a JSON array of strings. They should be contextual observations about the user's work — like smart notifications. ${taskContext ? `User's tasks: ${taskContext}` : ""} Reply with ONLY the JSON array, nothing else. Example: ["Focus on design review next","Great progress on docs today","2 tasks left before evening"]`
          }]
        }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          const parsed = JSON.parse(data.response);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const emotions: EmotionState[] = ["happy", "calm", "excited"];
            const aiBubs: InsightBubble[] = parsed.slice(0, 4).map((text: string, i: number) => ({
              id: `ai-${i}`,
              text: text.slice(0, 60),
              emotion: emotions[i % emotions.length],
            }));
            setAiBubbles(aiBubs);
            return;
          }
        } catch {}
      }
    } catch {}
    // Fallback: use local insights
    setAiBubbles([]);
  };

  // Cycle through insights, showing one at a time
  useEffect(() => {
    const allBubbles = aiBubbles.length > 0 ? [...aiBubbles, ...insights] : insights;
    if (allBubbles.length === 0) return;

    const showNext = () => {
      const idx = indexRef.current % allBubbles.length;
      const insight = allBubbles[idx];
      const bubble: ConversationBubble = {
        id: `${insight.id}-${Date.now()}`,
        text: insight.text,
        role: "assistant",
        emotion: insight.emotion,
        timestamp: new Date(),
      };

      setVisibleBubbles((prev) => {
        // Keep max 2 visible at a time
        const next = prev.length >= 2 ? [prev[prev.length - 1], bubble] : [...prev, bubble];
        return next;
      });

      indexRef.current += 1;

      // Auto-dismiss after 6s
      setTimeout(() => {
        setVisibleBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
      }, 6000);
    };

    // Show first one quickly
    const firstTimer = setTimeout(showNext, 1500);

    // Then cycle every 4s
    const interval = setInterval(showNext, 4500);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [insights, aiBubbles]);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
      <AnimatePresence>
        {visibleBubbles.map((bubble, idx) => {
          const pos = BUBBLE_POSITIONS[idx % BUBBLE_POSITIONS.length];

          return (
            <motion.div
              key={bubble.id}
              className="absolute max-w-[240px] pointer-events-none"
              style={{ x: pos.x, y: pos.y }}
              initial={{ opacity: 0, scale: 0.75, y: pos.y + 16 }}
              animate={{ opacity: 1, scale: 1, y: pos.y }}
              exit={{ opacity: 0, scale: 0.88, y: pos.y - 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div
                className="relative px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed"
                style={{
                  background: `${accentColor}14`,
                  backdropFilter: "blur(20px) saturate(150%)",
                  WebkitBackdropFilter: "blur(20px) saturate(150%)",
                  border: `1px solid ${accentColor}30`,
                  color: "rgba(255,255,255,0.85)",
                  boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 16px -8px ${accentColor}`,
                }}
              >
                {bubble.text}

                {/* Connector dot */}
                <div
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: accentColor,
                    bottom: -6,
                    left: 14,
                  }}
                />
              </div>

              <p
                className="text-[9px] uppercase tracking-[0.06em] mt-1.5 font-medium pl-1"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                EchoMate
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
