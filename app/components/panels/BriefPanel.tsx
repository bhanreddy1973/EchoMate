"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Cloud, CalendarDays, Compass, BookOpen, Dumbbell, Search, Home, Music, ArrowRight, Zap } from "lucide-react";
import GlassPanel from "./GlassPanel";
import { useEmotion } from "@/context/EmotionContext";
import { EmotionState } from "@/types";

function getGreeting(): { text: string; sub: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", sub: "Here's your day ahead" };
  if (h < 17) return { text: "Good afternoon", sub: "Midday check-in" };
  return { text: "Good evening", sub: "Winding down nicely" };
}

const QUICK_ACTIONS = [
  { id: "weather",  label: "Weather",  icon: Cloud,       color: "#60a5fa",  prompt: "What's the weather today?" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, color: "#a78bfa",  prompt: "What's on my calendar today?" },
  { id: "journal",  label: "Journal",  icon: BookOpen,    color: "#34d399",  prompt: "Open my journal" },
  { id: "fitness",  label: "Workout",  icon: Dumbbell,    color: "#f87171",  prompt: "Suggest a workout for today" },
  { id: "search",   label: "Search",   icon: Search,      color: "#fbbf24",  prompt: "Search for…" },
  { id: "music",    label: "Music",    icon: Music,       color: "#e879f9",  prompt: "Play something uplifting" },
];

const SUGGESTIONS: Record<string, string[]> = {
  morning: [
    "Start with your hardest task — your energy peaks now.",
    "Try a 5-minute meditation to set your focus for the day.",
    "Block your first 90 minutes for deep work before meetings hit.",
  ],
  afternoon: [
    "Take a 5-minute walk to reset your focus.",
    "Grab some water — hydration boosts afternoon performance.",
    "Review your morning wins to stay motivated for the rest.",
  ],
  evening: [
    "Reflect on 3 wins from today before you close out.",
    "Prepare tomorrow's top 3 tasks so you start fresh.",
    "Wind down with something non-screen for better sleep.",
  ],
};

function getSuggestion(): string {
  const h = new Date().getHours();
  const period = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const options = SUGGESTIONS[period];
  // Pick a different suggestion based on the day to avoid repetition
  const dayIndex = new Date().getDate() % options.length;
  return options[dayIndex];
}

interface BriefPanelProps {
  onVoicePrompt?: (text: string) => void;
}

export default function BriefPanel({ onVoicePrompt }: BriefPanelProps) {
  const { accentColor, setEmotion } = useEmotion();
  const [greeting, setGreeting] = useState<{ text: string; sub: string }>({ text: "", sub: "" });
  const [suggestion, setSuggestion] = useState<string>("");
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    setGreeting(getGreeting());
    setSuggestion(getSuggestion());
    const update = () =>
      setTimeString(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const interval = setInterval(update, 60_000);

    // Try to get an AI-generated suggestion
    fetchAiSuggestion();

    return () => clearInterval(interval);
  }, []);

  const fetchAiSuggestion = async () => {
    try {
      // Get task context from localStorage
      let taskContext = "";
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("echomate-tasks");
        if (stored) {
          const tasks = JSON.parse(stored);
          const pending = tasks.filter((t: any) => !t.completed);
          taskContext = `User has ${pending.length} pending tasks: ${pending.map((t: any) => t.text).slice(0, 3).join(", ")}`;
        }
      }

      const h = new Date().getHours();
      const timeOfDay = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Give me one short motivational tip (max 15 words) for this ${timeOfDay}. ${taskContext ? `Context: ${taskContext}` : ""}. Reply with ONLY the tip, no greeting or extra text.`
          }]
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response && data.response.length < 120) {
          setSuggestion(data.response.replace(/^["']|["']$/g, "").trim());
        }
      }
    } catch {
      // Keep the static suggestion if AI is unavailable
    }
  };

  const handleAction = (prompt: string) => {
    onVoicePrompt?.(prompt);
  };

  return (
    <GlassPanel delay={0.25} className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">{greeting.text}</h2>
          <span className="text-[11px] text-text-muted tabular-nums">
            {timeString}
          </span>
        </div>
        <p className="text-[11px] text-text-muted mt-0.5">{greeting.sub}</p>
      </div>

      {/* Weather + Next event */}
      <div className="flex gap-2">
        <div className="flex-1 glass-inner p-2.5 rounded-xl flex items-center gap-2">
          <Cloud size={14} style={{ color: "#60a5fa" }} />
          <div>
            <p className="text-[12px] font-medium text-text-primary">22°C</p>
            <p className="text-[10px] text-text-muted">Partly cloudy</p>
          </div>
        </div>
        <div className="flex-1 glass-inner p-2.5 rounded-xl flex items-center gap-2">
          <CalendarDays size={14} style={{ color: accentColor }} />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-text-primary truncate">Design Review</p>
            <p className="text-[10px] text-text-muted">in 2h · 45 min</p>
          </div>
        </div>
      </div>

      {/* Suggestion card */}
      <div
        className="p-3 rounded-xl flex items-start gap-2.5"
        style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}20` }}
      >
        <Zap size={13} style={{ color: accentColor, marginTop: 1 }} className="shrink-0" />
        <p className="text-[12px] text-text-secondary leading-relaxed">{suggestion}</p>
      </div>

      {/* Quick actions grid */}
      <div className="flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-2">Quick Actions</p>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                onClick={() => handleAction(action.prompt)}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: 0.3 + i * 0.05 } }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-colors"
                style={{ background: `${action.color}10`, border: `1px solid ${action.color}20` }}
                aria-label={action.label}
              >
                <Icon size={15} style={{ color: action.color }} strokeWidth={1.8} />
                <span className="text-[10px] text-text-secondary font-medium">{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Integration status */}
      <div className="shrink-0 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-ghost">Integrations</span>
            <div className="flex gap-1">
              {["#4285F4","#EA4335","#10b981","#8b5cf6"].map((c, i) => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c, opacity: 0.85 }} />
              ))}
            </div>
          </div>
          <button className="flex items-center gap-1 text-[10px] text-text-ghost hover:text-text-muted transition-colors">
            Manage <ArrowRight size={9} />
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}
