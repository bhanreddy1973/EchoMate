"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Plus, Mic, Clock } from "lucide-react";
import GlassPanel from "./GlassPanel";
import ProgressArc from "@/components/ui/ProgressArc";
import { Task, TaskPriority } from "@/types";
import clsx from "clsx";

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  medium: { label: "Med",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  low:    { label: "Low",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

function makeSeedTasks(): Task[] {
  const now = Date.now();
  return [
    { id: "1", text: "Prepare Q3 performance review",        priority: "high",   dueDate: new Date(now + 2 * 3600_000), completed: false },
    { id: "2", text: "Review pull requests from the team",   priority: "high",   dueDate: new Date(now + 4 * 3600_000), completed: false },
    { id: "3", text: "Schedule dentist appointment",         priority: "medium", dueDate: new Date(now + 86400_000),    completed: false },
    { id: "4", text: "Read 20 pages of Atomic Habits",       priority: "low",    dueDate: new Date(now + 72 * 3600_000),completed: false },
    { id: "5", text: "Groceries: oat milk, avocado, coffee", priority: "medium", dueDate: undefined,                    completed: false },
  ];
}

function formatDue(date?: Date): string {
  if (!date) return "";
  const diff = date.getTime() - Date.now();
  const h = diff / 3600_000;
  if (h < 1)   return "< 1h";
  if (h < 24)  return `in ${Math.round(h)}h`;
  return `in ${Math.round(h / 24)}d`;
}

export default function TasksPanel() {
  /* Lazy init so Date.now() runs client-side only — no SSR/hydration mismatch */
  const [tasks, setTasks] = useState<Task[]>(() => makeSeedTasks());
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  const pending    = tasks.filter((t) => !t.completed);
  const completed  = tasks.filter((t) => t.completed).length;
  const pct        = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const complete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => t.id === id ? { ...t, completed: true, completedAt: new Date() } : t),
    );
  };

  const addTask = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      ...prev,
      { id: `t-${Date.now()}`, text: trimmed, priority: "medium", completed: false, addedByVoice: false },
    ]);
    setNewText("");
    setAdding(false);
  };

  return (
    <GlassPanel delay={0.1} className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">Today's Tasks</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            {pending.length} remaining
          </p>
        </div>
        <ProgressArc value={pct} label={`${pct}%`} size={44} />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1">
        <AnimatePresence>
          {pending.map((task) => {
            const p = PRIORITY_CONFIG[task.priority];
            const due = formatDue(task.dueDate);
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30, transition: { duration: 0.3 } }}
                className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-default"
              >
                <button
                  onClick={() => complete(task.id)}
                  className="mt-0.5 shrink-0 text-text-muted hover:text-accent-emerald transition-colors"
                  aria-label="Complete task"
                >
                  <motion.div whileTap={{ scale: 0.85 }}>
                    <Circle size={16} strokeWidth={1.8} />
                  </motion.div>
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-text-primary leading-snug">{task.text}</p>
                  {due && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-text-muted shrink-0" />
                      <span className="text-[10px] text-text-muted">{due}</span>
                    </div>
                  )}
                </div>

                <span
                  className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-[0.04em]"
                  style={{ color: p.color, backgroundColor: p.bg }}
                >
                  {p.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pending.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <CheckCircle2 size={28} className="text-accent-emerald opacity-60" />
            <p className="text-[12px] text-text-muted">All caught up! 🎉</p>
          </motion.div>
        )}
      </div>

      {/* Add task */}
      <div className="shrink-0 border-t border-white/5 pt-3">
        <AnimatePresence mode="wait">
          {adding ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTask(); if (e.key === "Escape") setAdding(false); }}
                placeholder="Task description…"
                className="flex-1 bg-transparent text-[12.5px] text-text-primary placeholder:text-text-ghost outline-none"
              />
              <button
                onClick={addTask}
                className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={{ backgroundColor: "var(--current-glow-sm)", color: "var(--current-accent)" }}
              >
                Add
              </button>
            </motion.div>
          ) : (
            <motion.div key="buttons" className="flex items-center gap-2">
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                <Plus size={12} strokeWidth={2.5} />
                Add task
              </button>
              <span className="text-text-ghost text-[10px]">·</span>
              <button className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors">
                <Mic size={11} strokeWidth={2} />
                Voice
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}
