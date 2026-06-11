"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Plus,
  Mic,
  MicOff,
  Clock,
  Trash2,
  Edit3,
  X,
  ChevronDown,
  Calendar,
  Flag,
} from "lucide-react";
import GlassPanel from "./GlassPanel";
import ProgressArc from "@/components/ui/ProgressArc";
import { Task, TaskPriority } from "@/types";

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: "HIGH", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.3)" },
  medium: { label: "MED",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  low:    { label: "LOW",  color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
};

const DUE_OPTIONS = [
  { label: "In 1 hour",  value: 1 },
  { label: "In 4 hours", value: 4 },
  { label: "Tomorrow",   value: 24 },
  { label: "In 3 days",  value: 72 },
  { label: "In 1 week",  value: 168 },
  { label: "No deadline", value: 0 },
];

const TASKS_STORAGE_KEY = "echomate-tasks";

function loadTasksFromStorage(): Task[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.map((t: any) => ({
      ...t,
      dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
      completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
    }));
  } catch {
    return null;
  }
}

function saveTasksToStorage(tasks: Task[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

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
  if (diff < 0) return "overdue";
  const h = diff / 3600_000;
  if (h < 1) return "< 1h";
  if (h < 24) return `in ${Math.round(h)}h`;
  return `in ${Math.round(h / 24)}d`;
}

// Type declarations for Web Speech API (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export default function TasksPanel({ onTaskComplete }: { onTaskComplete?: (text: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>(() => makeSeedTasks());
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // Add task form state
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDueHours, setNewDueHours] = useState<number>(0);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);

  // Edit task form state
  const [editText, setEditText] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const dueRef = useRef<HTMLDivElement>(null);

  // Check for speech recognition support
  useEffect(() => {
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(supported);
  }, []);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = loadTasksFromStorage();
    if (stored) setTasks(stored);
    setHydrated(true);
  }, []);

  // Persist tasks to localStorage (only after hydration to avoid overwriting with seed data)
  useEffect(() => {
    if (hydrated) {
      saveTasksToStorage(tasks);
    }
  }, [tasks, hydrated]);

  const pending = tasks.filter((t) => !t.completed);
  const completedCount = tasks.filter((t) => t.completed).length;
  const pct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setShowPriorityPicker(false);
      }
      if (dueRef.current && !dueRef.current.contains(e.target as Node)) {
        setShowDuePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const complete = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: true, completedAt: new Date() } : t))
    );
    if (task && onTaskComplete) {
      onTaskComplete(task.text);
    }
  };

  const uncomplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: false, completedAt: undefined } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const startEdit = (task: Task) => {
    setEditing(task.id);
    setEditText(task.text);
    setEditPriority(task.priority);
  };

  const saveEdit = (id: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: trimmed, priority: editPriority } : t))
    );
    setEditing(null);
  };

  const addTask = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    stopListening();
    const dueDate = newDueHours > 0 ? new Date(Date.now() + newDueHours * 3600_000) : undefined;
    setTasks((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        text: trimmed,
        priority: newPriority,
        dueDate,
        completed: false,
        addedByVoice: isListening || voiceInterimText.length > 0,
      },
    ]);
    resetForm();
  };

  const resetForm = () => {
    setNewText("");
    setNewPriority("medium");
    setNewDueHours(0);
    setAdding(false);
    setShowPriorityPicker(false);
    setShowDuePicker(false);
    stopListening();
  };

  // Voice input functions
  const startListening = useCallback(() => {
    if (!voiceSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setNewText((prev) => {
          const separator = prev.trim() ? " " : "";
          return prev.trim() + separator + finalTranscript.trim();
        });
        setVoiceInterimText("");
      } else {
        setVoiceInterimText(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setVoiceInterimText("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setVoiceInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Open the add form if not already open
    if (!adding) {
      setAdding(true);
    }
  }, [voiceSupported, adding]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setVoiceInterimText("");
  }, []);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Sort: high first, then medium, then low
  const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  const sortedPending = [...pending].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return (
    <GlassPanel delay={0.1} className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">Today&apos;s Tasks</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            {pending.length} remaining · {completedCount} done
          </p>
        </div>
        <ProgressArc value={pct} label={`${pct}%`} size={44} />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
        <AnimatePresence>
          {sortedPending.map((task) => {
            const p = PRIORITY_CONFIG[task.priority];
            const due = formatDue(task.dueDate);
            const isOverdue = due === "overdue";
            const isEditing = editing === task.id;

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30, transition: { duration: 0.3 } }}
                className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
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
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(task.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-full bg-white/5 text-[12px] text-text-primary rounded-lg px-2 py-1.5 outline-none border border-white/10 focus:border-white/20"
                      />
                      <div className="flex items-center gap-2">
                        {(["high", "medium", "low"] as TaskPriority[]).map((pri) => {
                          const pc = PRIORITY_CONFIG[pri];
                          return (
                            <button
                              key={pri}
                              onClick={() => setEditPriority(pri)}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded-md uppercase transition-all"
                              style={{
                                color: pc.color,
                                backgroundColor: editPriority === pri ? pc.bg : "transparent",
                                border: editPriority === pri ? `1px solid ${pc.border}` : "1px solid transparent",
                              }}
                            >
                              {pc.label}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => saveEdit(task.id)}
                          className="ml-auto text-[10px] font-medium text-accent-emerald hover:text-accent-emerald/80 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-text-primary leading-snug">{task.text}</p>
                      {due && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={10} className={isOverdue ? "text-red-400 shrink-0" : "text-text-muted shrink-0"} />
                          <span className={`text-[10px] ${isOverdue ? "text-red-400 font-medium" : "text-text-muted"}`}>
                            {due}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-[0.04em]"
                      style={{ color: p.color, backgroundColor: p.bg }}
                    >
                      {p.label}
                    </span>
                    {/* Action buttons - visible on hover */}
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => startEdit(task)}
                        className="p-1 rounded-md hover:bg-white/10 text-text-muted hover:text-text-secondary transition-colors"
                        aria-label="Edit task"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1 rounded-md hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        aria-label="Delete task"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Completed tasks (collapsed) */}
        {completedCount > 0 && (
          <CompletedSection
            tasks={tasks.filter((t) => t.completed)}
            onUncomplete={uncomplete}
            onDelete={deleteTask}
          />
        )}

        {pending.length === 0 && completedCount === 0 && (
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

      {/* Add task area */}
      <div className="shrink-0 border-t border-white/5 pt-3">
        <AnimatePresence mode="wait">
          {adding ? (
            <motion.div
              key="add-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex flex-col gap-2.5"
            >
              {/* Task input */}
              <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.06]">
                <input
                  ref={inputRef}
                  autoFocus
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTask();
                    if (e.key === "Escape") resetForm();
                  }}
                  placeholder={isListening ? "Listening…" : "What needs to be done?"}
                  className="flex-1 bg-transparent text-[12.5px] text-text-primary placeholder:text-text-ghost outline-none"
                />
                {/* Voice mic button inside input */}
                {voiceSupported && (
                  <button
                    onClick={toggleVoice}
                    className={`p-1 rounded-lg transition-all ${
                      isListening
                        ? "bg-red-500/15 text-red-400 border border-red-500/30"
                        : "text-text-muted hover:text-text-secondary hover:bg-white/5"
                    }`}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  >
                    <motion.div
                      animate={isListening ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                      transition={isListening ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
                    >
                      {isListening ? <MicOff size={12} /> : <Mic size={12} />}
                    </motion.div>
                  </button>
                )}
                <button
                  onClick={resetForm}
                  className="text-text-muted hover:text-text-secondary transition-colors"
                  aria-label="Cancel"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Voice interim transcript indicator */}
              <AnimatePresence>
                {isListening && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-2"
                  >
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-[10px] text-red-400 font-medium">Recording</span>
                    </div>
                    {voiceInterimText && (
                      <span className="text-[10px] text-text-ghost italic truncate flex-1">
                        {voiceInterimText}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Options row: Priority + Due + Add button */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Priority picker */}
                <div ref={priorityRef} className="relative">
                  <button
                    onClick={() => { setShowPriorityPicker(!showPriorityPicker); setShowDuePicker(false); }}
                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors"
                    style={{
                      color: PRIORITY_CONFIG[newPriority].color,
                      borderColor: PRIORITY_CONFIG[newPriority].border,
                      backgroundColor: PRIORITY_CONFIG[newPriority].bg,
                    }}
                  >
                    <Flag size={10} />
                    {PRIORITY_CONFIG[newPriority].label}
                    <ChevronDown size={10} />
                  </button>
                  <AnimatePresence>
                    {showPriorityPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-1.5 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-xl z-50 min-w-[120px]"
                      >
                        {(["high", "medium", "low"] as TaskPriority[]).map((pri) => {
                          const pc = PRIORITY_CONFIG[pri];
                          const isSelected = newPriority === pri;
                          return (
                            <button
                              key={pri}
                              onClick={() => { setNewPriority(pri); setShowPriorityPicker(false); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-white/[0.06]"
                            >
                              <Flag size={11} style={{ color: pc.color }} />
                              <span className="text-[11px] text-text-primary flex-1">{pri.charAt(0).toUpperCase() + pri.slice(1)}</span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pc.color }} />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Due date picker */}
                <div ref={dueRef} className="relative">
                  <button
                    onClick={() => { setShowDuePicker(!showDuePicker); setShowPriorityPicker(false); }}
                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-text-muted hover:text-text-secondary hover:border-white/20 transition-colors"
                  >
                    <Calendar size={10} />
                    {newDueHours > 0
                      ? DUE_OPTIONS.find((o) => o.value === newDueHours)?.label || "Custom"
                      : "Due date"}
                    <ChevronDown size={10} />
                  </button>
                  <AnimatePresence>
                    {showDuePicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-1.5 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-xl z-50 min-w-[130px]"
                      >
                        {DUE_OPTIONS.map((opt) => {
                          const isSelected = newDueHours === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => { setNewDueHours(opt.value); setShowDuePicker(false); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-white/[0.06]"
                            >
                              <Clock size={10} className="text-text-muted" />
                              <span className="text-[11px] text-text-primary flex-1">{opt.label}</span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Add button */}
                <button
                  onClick={addTask}
                  disabled={!newText.trim()}
                  className="ml-auto text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: newText.trim() ? "rgba(6,182,212,0.15)" : "rgba(255,255,255,0.03)",
                    color: newText.trim() ? "#06b6d4" : "var(--text-muted)",
                    border: newText.trim() ? "1px solid rgba(6,182,212,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  Add Task
                </button>
              </div>
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
              <button
                onClick={() => {
                  if (!voiceSupported) {
                    setAdding(true);
                    return;
                  }
                  setAdding(true);
                  // Small delay so the form renders first
                  setTimeout(() => startListening(), 100);
                }}
                className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                  isListening
                    ? "text-red-400"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {isListening ? (
                  <>
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                      <MicOff size={11} strokeWidth={2} />
                    </motion.div>
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Mic size={11} strokeWidth={2} />
                    <span>Voice</span>
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}

/* Completed tasks collapsible section */
function CompletedSection({
  tasks,
  onUncomplete,
  onDelete,
}: {
  tasks: Task[];
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 pt-2 border-t border-white/[0.04]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors w-full"
      >
        <ChevronDown
          size={11}
          className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
        />
        <span>{tasks.length} completed</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 mt-1.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <button
                    onClick={() => onUncomplete(task.id)}
                    className="shrink-0 text-accent-emerald hover:text-text-muted transition-colors"
                    aria-label="Mark as incomplete"
                  >
                    <CheckCircle2 size={14} strokeWidth={1.8} />
                  </button>
                  <p className="flex-1 text-[11.5px] text-text-muted line-through opacity-60">{task.text}</p>
                  <button
                    onClick={() => onDelete(task.id)}
                    className="hidden group-hover:block p-1 rounded-md hover:bg-red-500/10 text-text-ghost hover:text-red-400 transition-colors"
                    aria-label="Delete task"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
