"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Pin, Quote, Plus, X, RefreshCw } from "lucide-react";
import GlassPanel from "./GlassPanel";
import { MemoryCard } from "@/types";
import { useEmotion } from "@/context/EmotionContext";

const STORAGE_KEY = "echomate-memories";

function makeMemories(): MemoryCard[] {
  const now = Date.now();
  return [
    { id: "1", content: "You said you want to read more fiction this year — haven't done that in a while.", date: new Date(now - 7  * 86400_000), tags: ["goals","reading"],    pinned: true,  emotion: "calm"      },
    { id: "2", content: "Your team standup stress has been recurring on Monday mornings.",                   date: new Date(now - 14 * 86400_000), tags: ["work","stress"],      pinned: false, emotion: "concerned" },
    { id: "3", content: "You mentioned loving early morning sessions — most productive before 9am.",         date: new Date(now - 3  * 86400_000), tags: ["productivity"],       pinned: true,  emotion: "happy"     },
  ];
}

function loadMemoriesFromStorage(): MemoryCard[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.map((m: any) => ({ ...m, date: new Date(m.date) }));
  } catch {
    return null;
  }
}

function saveMemoriesToStorage(memories: MemoryCard[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch {}
}

export default function InsightsPanel() {
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [allMemories, setAllMemories] = useState<MemoryCard[]>(() => makeMemories());
  const [addOpen, setAddOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [chromaAvailable, setChromaAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const { accentColor } = useEmotion();

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = loadMemoriesFromStorage();
    if (stored) setAllMemories(stored);
  }, []);

  // Persist to localStorage whenever memories change
  useEffect(() => {
    saveMemoriesToStorage(allMemories);
  }, [allMemories]);

  // Fetch from ChromaDB on mount
  useEffect(() => {
    fetchChromaMemories();
  }, []);

  const fetchChromaMemories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setChromaAvailable(data.available);

      if (data.available && data.memories.length > 0) {
        const chromaCards: MemoryCard[] = data.memories.map((m: any) => ({
          id: m.id,
          content: m.content,
          date: m.timestamp ? new Date(m.timestamp) : new Date(),
          tags: m.tags || ["memory"],
          pinned: m.pinned || false,
        }));

        // Merge: ChromaDB memories + local-only memories (avoid duplicates by content)
        setAllMemories((prev) => {
          const chromaContents = new Set(chromaCards.map((c) => c.content));
          const localOnly = prev.filter((p) => !chromaContents.has(p.content));
          const merged = [...chromaCards, ...localOnly];
          return merged;
        });
      }
    } catch {
      // ChromaDB not available, use local data
      setChromaAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  const memories = pinnedOnly ? allMemories.filter((m) => m.pinned) : allMemories;

  const togglePin = (id: string) => {
    setAllMemories((prev) => prev.map((m) => m.id === id ? { ...m, pinned: !m.pinned } : m));
  };

  const removeMemory = (id: string) => {
    const memory = allMemories.find((m) => m.id === id);
    setAllMemories((prev) => prev.filter((m) => m.id !== id));

    // Also remove from ChromaDB if available
    if (chromaAvailable && memory) {
      fetch("/api/memories/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: memory.content }),
      }).catch(() => {});
    }
  };

  const addMemory = async () => {
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

    // Also store in ChromaDB if available
    if (chromaAvailable) {
      fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, tags, category: "fact" }),
      }).catch(() => {});
    }
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
          {chromaAvailable && (
            <motion.button
              onClick={fetchChromaMemories}
              whileTap={{ scale: 0.9 }}
              animate={loading ? { rotate: 360 } : {}}
              transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              aria-label="Refresh from memory"
            >
              <RefreshCw size={10} />
            </motion.button>
          )}
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
