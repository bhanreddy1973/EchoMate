"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Star, TrendingUp, ChevronRight } from "lucide-react";
import GlassPanel from "./GlassPanel";
import { CompletedItem } from "@/types";

const RECAP_STORAGE_KEY = "echomate-recap";

function makeCompleted(): CompletedItem[] {
  const now = Date.now();
  return [
    { id: "1", text: "Morning workout — 30 min run",       completedAt: new Date(now - 5  * 3600_000), category: "habit" },
    { id: "2", text: "Finished design system docs",         completedAt: new Date(now - 7  * 3600_000), category: "task"  },
    { id: "3", text: "Team standup + retrospective notes",  completedAt: new Date(now - 9  * 3600_000), category: "task"  },
    { id: "4", text: "Meditated for 10 minutes",            completedAt: new Date(now - 25 * 3600_000), category: "habit" },
    { id: "5", text: "Read Atomic Habits — chapter 9",      completedAt: new Date(now - 26 * 3600_000), category: "goal"  },
  ];
}

const CAT_COLOR: Record<CompletedItem["category"], string> = {
  task:  "rgba(99,102,241,0.8)",
  habit: "rgba(16,185,129,0.8)",
  goal:  "rgba(234,179,8,0.8)",
  note:  "rgba(148,163,184,0.7)",
};

function timeAgo(date: Date): string {
  const h = (Date.now() - date.getTime()) / 3600_000;
  if (h < 1)  return "Just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const STREAK = 7;
const WEEKLY_GOAL = 80;

export default function RecapPanel({ newCompletions = [] }: { newCompletions?: CompletedItem[] }) {
  const [expanded, setExpanded] = useState(false);
  /* Lazy init — Date.now() only runs client-side */
  const [baseItems] = useState<CompletedItem[]>(() => makeCompleted());

  // Load persisted weekly done count after mount
  const [persistedCount, setPersistedCount] = useState<number>(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECAP_STORAGE_KEY);
      if (stored) {
        setPersistedCount(JSON.parse(stored).completedCount || 0);
      }
    } catch {}
  }, []);

  // Persist when new completions arrive
  useEffect(() => {
    if (newCompletions.length > 0) {
      const total = persistedCount + newCompletions.length;
      setPersistedCount(total);
      try {
        localStorage.setItem(RECAP_STORAGE_KEY, JSON.stringify({ completedCount: total }));
      } catch {}
    }
  }, [newCompletions.length]);

  // Merge new completions (from tasks) with existing items
  const allItems = [...newCompletions, ...baseItems];
  const weeklyDone = 62 + persistedCount;
  const items = expanded ? allItems : allItems.slice(0, 3);

  return (
    <GlassPanel delay={0.2} className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">Today's Wins</h2>
          <p className="text-[11px] text-text-muted mt-0.5">{allItems.length} completed</p>
        </div>

        {/* Streak badge */}
        <motion.div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{
            background: "rgba(234,179,8,0.12)",
            border: "1px solid rgba(234,179,8,0.25)",
            animation: "badge-glow 3s ease-in-out infinite",
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1, transition: { delay: 0.4, type: "spring", bounce: 0.5 } }}
        >
          <Flame size={14} style={{ color: "#f59e0b" }} />
          <span className="text-[13px] font-bold" style={{ color: "#f59e0b" }}>{STREAK}</span>
          <span className="text-[10px] text-text-muted">day streak</span>
        </motion.div>
      </div>

      {/* Weekly progress */}
      <div className="glass-inner p-3 rounded-xl flex items-center gap-3">
        <TrendingUp size={14} className="text-text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-text-secondary">Weekly goal</span>
            <span className="text-[11px] font-medium" style={{ color: "var(--current-accent)" }}>
              {weeklyDone}/{WEEKLY_GOAL}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--current-accent)" }}
              initial={{ width: 0 }}
              animate={{ width: `${(weeklyDone / WEEKLY_GOAL) * 100}%` }}
              transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
        <Star size={14} style={{ color: "#eab308", opacity: 0.8 }} className="shrink-0" />
      </div>

      {/* Completed list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
            className="flex items-start gap-2.5 py-2 px-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group"
          >
            <div
              className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: CAT_COLOR[item.category], marginTop: 5 }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-text-secondary leading-snug line-through decoration-white/20">
                {item.text}
              </p>
              <p className="text-[10px] text-text-ghost mt-0.5">{timeAgo(item.completedAt)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Expand / Tell me more */}
      <div className="shrink-0 border-t border-white/5 pt-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <Trophy size={11} />
          {expanded ? "Show less" : "Tell me more"}
          <ChevronRight
            size={11}
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          />
        </button>
        <span className="text-[10px] text-text-ghost">{STREAK} day best streak</span>
      </div>
    </GlassPanel>
  );
}
