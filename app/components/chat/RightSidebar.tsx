"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Lightbulb,
  Sun,
  X,
  ChevronRight,
  Sparkles,
  Circle,
} from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useEmotion } from "@/context/EmotionContext";

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  priority: "high" | "medium" | "low";
  time?: string;
}

interface InsightItem {
  id: string;
  text: string;
  type: "pattern" | "suggestion" | "milestone";
}

const MOCK_TASKS: TaskItem[] = [
  { id: "1", text: "Review pull request #42", done: false, priority: "high", time: "10:00 AM" },
  { id: "2", text: "Team standup meeting", done: true, priority: "medium", time: "9:30 AM" },
  { id: "3", text: "Write documentation for API", done: false, priority: "medium", time: "2:00 PM" },
  { id: "4", text: "Deploy staging environment", done: false, priority: "low", time: "4:00 PM" },
];

const MOCK_INSIGHTS: InsightItem[] = [
  { id: "1", text: "You've been most productive between 9-11 AM this week", type: "pattern" },
  { id: "2", text: "Consider a short break — you've been focused for 2+ hours", type: "suggestion" },
  { id: "3", text: "Completed 8/10 daily tasks — great streak!", type: "milestone" },
];

export default function RightSidebar() {
  const { rightSidebarOpen, toggleRightSidebar } = useChatStore();
  const { accentColor, glowColor } = useEmotion();
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const priorityColor = {
    high: "#f43f5e",
    medium: "#f59e0b",
    low: "#10b981",
  };

  const insightIcon = {
    pattern: TrendingUp,
    suggestion: Lightbulb,
    milestone: Sparkles,
  };

  return (
    <AnimatePresence>
      {rightSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="h-full flex flex-col overflow-hidden border-l border-white/[0.06] shrink-0"
          style={{
            background: "rgba(7,7,16,0.92)",
            backdropFilter: "blur(40px) saturate(180%)",
          }}
        >
          <div className="flex flex-col h-full w-[320px] min-w-[320px] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
              <h2 className="text-[13px] font-semibold text-white/80">Dashboard</h2>
              <button
                onClick={toggleRightSidebar}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                aria-label="Close right sidebar"
              >
                <X size={14} className="text-white/40" />
              </button>
            </div>

            {/* Daily Brief Card */}
            <div className="px-3 pb-3">
              <motion.div
                className="p-4 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
                  border: `1px solid ${accentColor}20`,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sun size={14} style={{ color: accentColor }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
                    Daily Brief
                  </span>
                </div>
                <p className="text-[12.5px] text-white/70 leading-relaxed">
                  Good morning! You have <span className="text-white/90 font-medium">3 tasks</span> remaining today.
                  Your focus session starts in 45 minutes.
                </p>
              </motion.div>
            </div>

            {/* Tasks Section */}
            <div className="px-3 pb-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400/70" />
                  <span className="text-[12px] font-semibold text-white/70">Today&apos;s Tasks</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40">
                  {tasks.filter((t) => !t.done).length} left
                </span>
              </div>
              <div className="space-y-1">
                {tasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="group flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/[0.03] cursor-pointer"
                    style={{
                      border: "1px solid transparent",
                    }}
                    onClick={() => toggleTask(task.id)}
                  >
                    <motion.div
                      className="mt-0.5 shrink-0"
                      whileTap={{ scale: 0.8 }}
                    >
                      {task.done ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <CheckCircle2 size={14} className="text-emerald-400" />
                        </motion.div>
                      ) : (
                        <Circle
                          size={14}
                          className="text-white/20 group-hover:text-white/40 transition-colors"
                        />
                      )}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[12px] leading-snug transition-all"
                        style={{
                          color: task.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)",
                          textDecoration: task.done ? "line-through" : "none",
                        }}
                      >
                        {task.text}
                      </p>
                      {task.time && (
                        <p className="text-[10px] text-white/25 mt-0.5 flex items-center gap-1">
                          <Clock size={9} />
                          {task.time}
                        </p>
                      )}
                    </div>
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: priorityColor[task.priority] }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Insights Section */}
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 px-1 mb-2">
                <TrendingUp size={13} className="text-violet-400/70" />
                <span className="text-[12px] font-semibold text-white/70">Insights</span>
              </div>
              <div className="space-y-2">
                {MOCK_INSIGHTS.map((insight, i) => {
                  const Icon = insightIcon[insight.type];
                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <Icon
                        size={13}
                        className="mt-0.5 shrink-0"
                        style={{
                          color:
                            insight.type === "milestone"
                              ? "#eab308"
                              : insight.type === "suggestion"
                              ? "#06b6d4"
                              : "#8b5cf6",
                        }}
                      />
                      <p className="text-[11.5px] text-white/60 leading-relaxed">
                        {insight.text}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Completed Recap */}
            <div className="px-3 pb-4">
              <div className="flex items-center gap-2 px-1 mb-2">
                <Sparkles size={13} className="text-amber-400/70" />
                <span className="text-[12px] font-semibold text-white/70">Completed Today</span>
              </div>
              <div
                className="px-3 py-3 rounded-xl"
                style={{
                  background: "rgba(16,185,129,0.04)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-emerald-400">
                    {tasks.filter((t) => t.done).length}
                  </div>
                  <div>
                    <p className="text-[11px] text-white/50">tasks completed</p>
                    <p className="text-[10px] text-emerald-400/60 mt-0.5">
                      +{tasks.filter((t) => t.done).length > 0 ? "Great progress!" : "Get started!"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
