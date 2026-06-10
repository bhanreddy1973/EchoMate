"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Pin, Quote, Plus, X } from "lucide-react";
import GlassPanel from "./GlassPanel";
import { MemoryCard } from "@/types";
import { useEmotion } from "@/context/EmotionContext";

function makeMemories(): MemoryCard[] {
  const now = Date.now();
  return [
    { id: "1", content: "You said you want to read more fiction this year — haven't done that in a while.", date: new Date(now - 7  * 86400_000), tags: ["goals","reading"],    pinned: true,  emotion: "calm"      },
    { id: "2", content: "Your team standup stress has been recurring on Monday mornings.",                   date: new Date(now - 14 * 86400_000), tags: ["work","stress"],      pinned: false, emotion: "concerned" },
    { id: "3", content: "You mentioned loving early morning sessions — most productive before 9am.",         date: new Date(now - 3  * 86400_000), tags: ["productivity"],       pinned: true,  emotion: "happy"     },
  ];
}

const EMOTION_FREQ = [
  { emotion: "Happy",    pct: 38, color: "#eab308" },
  { emotion: "Calm",     pct: 28, color: "#14b8a6" },
  { emotion: "Excited",  pct: 20, color: "#8b5cf6" },
  { emotion: "Concerned",pct: 14, color: "#60a5fa" },
];

export default function InsightsPanel() {
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [allMemories, setAllMemories] = useState<MemoryCard[]>(() => makeMemories());
  const [addOpen, setAddOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const { accentColor } = useEmotion();

  const memories = pinnedOnly ? allMemories.filter((m) => m.pinned) : allMemories;

  const togglePin = (id: string) => {
    setAllMemories((prev) => prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m));
  };

  const removeMemory = (id: string) => {
    setAllMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const addMemory = () => {
    const content = newNote.trim();
    if (!content) return;
    const tags = newTag.trim() ? newTag.trim().split(/[\s,]+/).filter(Boolean) : [];
    const card: MemoryCard = {
      id: `m${Date.now()}`,
      content,
      date: new Date(),
      tags,
      pinned: false,
    };
    setAllMemories((prev) => [card, ...prev]);
    setNewNote("");
    setNewTag("");
    setAddOpen(false);
  };

  return (
    <GlassPanel delay={0.15} className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">Insights & Memory</h2>
          <p className="text-[11px] text-text-muted mt-0.5">What I remember about you</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Brain size={13} className="text-text-muted" />
          <motion.button
            onClick={() => setAddOpen((v) => !v)}
            whileTap={{ scale: 0.9 }}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor }}
            aria-label="Add memory"
          >
            <Plus size={10} />
          </motion.button>
        </div>
      </div>

      {/* Add memory form */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div
              className="p-2.5 rounded-xl flex flex-col gap-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="What should I remember about you?"
                rows={2}
                className="w-full bg-transparent text-[11.5px] text-text-primary placeholder:text-text-ghost outline-none resize-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
              />
              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="tags (space-separated)"
                  className="flex-1 bg-transparent text-[11px] text-text-secondary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onKeyDown={(e) => e.key === "Enter" && addMemory()}
                />
                <motion.button
                  onClick={addMemory}
                  whileTap={{ scale: 0.92 }}
                  disabled={!newNote.trim()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white disabled:opacity-40"
                  style={{ background: accentColor }}
                >
                  Save
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emotion frequency bars */}
      <div className="space-y-1.5 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">Emotional tone</span>
        {EMOTION_FREQ.map(({ emotion, pct, color }) => (
          <div key={emotion} className="flex items-center gap-2.5">
            <span className="text-[10px] text-text-muted w-14 capitalize">{emotion}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] text-text-ghost w-6 text-right">{pct}%</span>
          </div>
        ))}
      </div>

      {/* Memory cards */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            Memories · {allMemories.length}
          </span>
          <button
            onClick={() => setPinnedOnly((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <Pin size={9} />
            {pinnedOnly ? "All" : "Pinned"}
          </button>
        </div>

        <AnimatePresence>
          {memories.map((m, idx) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.07 } }}
              exit={{ opacity: 0, y: -8 }}
              layout
              className="group p-2.5 rounded-xl glass-inner"
            >
              <div className="flex items-start gap-2">
                <Quote size={11} className="text-text-ghost shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-text-secondary leading-relaxed flex-1">{m.content}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePin(m.id)}
                    className="mt-0.5 transition-colors"
                    aria-label={m.pinned ? "Unpin" : "Pin"}
                  >
                    <Pin
                      size={10}
                      style={{ color: m.pinned ? accentColor : "rgba(255,255,255,0.2)" }}
                      fill={m.pinned ? accentColor : "none"}
                    />
                  </button>
                  <button
                    onClick={() => removeMemory(m.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    aria-label="Remove memory"
                  >
                    <X size={9} style={{ color: "rgba(255,255,255,0.25)" }} />
                  </button>
                </div>
              </div>
              {m.tags.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 pl-4 flex-wrap">
                  {m.tags.map((tag) => (
                    <span key={tag} className="text-[9px] text-text-ghost px-1.5 py-0.5 rounded bg-white/5">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}
