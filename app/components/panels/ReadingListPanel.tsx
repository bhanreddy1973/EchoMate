"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Plus, X, Check, ExternalLink, ChevronDown, ChevronUp, Bookmark } from "lucide-react";
import GlassPanel from "./GlassPanel";
import { useEmotion } from "@/context/EmotionContext";
import { ReadingItem, ReadingCategory } from "@/types";

const CATEGORY_META: Record<ReadingCategory, { label: string; color: string }> = {
  tech:     { label: "Tech",     color: "#60a5fa" },
  design:   { label: "Design",   color: "#a78bfa" },
  health:   { label: "Health",   color: "#34d399" },
  finance:  { label: "Finance",  color: "#fbbf24" },
  science:  { label: "Science",  color: "#f472b6" },
  other:    { label: "Other",    color: "#94a3b8" },
};

const ALL_CATEGORIES: ReadingCategory[] = ["tech", "design", "health", "finance", "science", "other"];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const SEED_ITEMS: ReadingItem[] = [
  {
    id: "r1",
    title: "The future of ambient computing interfaces",
    url: "https://uxdesign.cc",
    category: "design",
    addedAt: new Date(Date.now() - 2 * 3600_000),
    read: false,
  },
  {
    id: "r2",
    title: "LLM agents and memory architecture overview",
    url: "https://arxiv.org",
    category: "tech",
    addedAt: new Date(Date.now() - 5 * 3600_000),
    read: false,
  },
  {
    id: "r3",
    title: "Sleep and productivity: the science behind rest",
    url: "https://hubermanlab.com",
    category: "health",
    addedAt: new Date(Date.now() - 24 * 3600_000),
    read: true,
  },
];

export default function ReadingListPanel() {
  const { accentColor } = useEmotion();
  const [items, setItems] = useState<ReadingItem[]>(SEED_ITEMS);
  const [activeCategory, setActiveCategory] = useState<ReadingCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState<ReadingCategory>("tech");
  const urlRef = useRef<HTMLInputElement>(null);

  const visible = activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  const unreadCount = items.filter((i) => !i.read).length;

  const addItem = () => {
    const title = newTitle.trim();
    const url = newUrl.trim();
    if (!title || !url) return;
    const item: ReadingItem = {
      id: `r${Date.now()}`,
      title,
      url: url.startsWith("http") ? url : `https://${url}`,
      category: newCategory,
      addedAt: new Date(),
      read: false,
    };
    setItems((prev) => [item, ...prev]);
    setNewTitle("");
    setNewUrl("");
    setAddOpen(false);
  };

  const toggleRead = (id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, read: !i.read } : i));
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <GlassPanel delay={0.25} className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark size={13} className="text-text-muted" />
          <div>
            <h2 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">Reading List</h2>
            <p className="text-[10px] text-text-muted mt-0.5">{unreadCount} unread · {items.length} saved</p>
          </div>
        </div>
        <motion.button
          onClick={() => { setAddOpen((v) => !v); setTimeout(() => urlRef.current?.focus(), 50); }}
          whileTap={{ scale: 0.9 }}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor }}
          aria-label="Add article"
        >
          {addOpen ? <ChevronUp size={12} /> : <Plus size={12} />}
        </motion.button>
      </div>

      {/* Add form */}
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
              <input
                ref={urlRef}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste URL…"
                className="w-full bg-transparent text-[11.5px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
              />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title / topic name"
                className="w-full bg-transparent text-[11.5px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
              />
              <div className="flex items-center gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ReadingCategory)}
                  className="flex-1 bg-transparent text-[11px] text-text-secondary outline-none px-2 py-1.5 rounded-lg appearance-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "#1a1a2e" }}>
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
                <motion.button
                  onClick={addItem}
                  whileTap={{ scale: 0.92 }}
                  disabled={!newTitle.trim() || !newUrl.trim()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-opacity disabled:opacity-40"
                  style={{ background: accentColor }}
                >
                  Save
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category filter */}
      <div className="flex gap-1 overflow-x-auto shrink-0 pb-0.5 scrollbar-hide">
        {(["all", ...ALL_CATEGORIES] as const).map((cat) => {
          const isAll = cat === "all";
          const meta = isAll ? null : CATEGORY_META[cat];
          const active = activeCategory === cat;
          const count = isAll ? items.length : items.filter((i) => i.category === cat).length;
          if (!isAll && count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all shrink-0"
              style={active ? {
                background: isAll ? `${accentColor}20` : `${meta!.color}20`,
                color: isAll ? accentColor : meta!.color,
                border: `1px solid ${isAll ? accentColor : meta!.color}30`,
              } : {
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.35)",
                border: "1px solid transparent",
              }}
            >
              {isAll ? "All" : meta!.label}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        <AnimatePresence initial={false}>
          {visible.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 gap-2"
            >
              <BookOpen size={22} className="text-text-ghost opacity-40" />
              <p className="text-[11px] text-text-ghost">No articles yet</p>
              <button
                onClick={() => setAddOpen(true)}
                className="text-[11px] mt-1 transition-colors"
                style={{ color: accentColor }}
              >
                + Add your first article
              </button>
            </motion.div>
          )}
          {visible.map((item, idx) => {
            const meta = CATEGORY_META[item.category];
            const domain = extractDomain(item.url);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: item.read ? 0.5 : 1, y: 0, transition: { delay: idx * 0.04 } }}
                exit={{ opacity: 0, x: -20 }}
                layout
                className="group flex items-start gap-2.5 p-2.5 rounded-xl transition-colors hover:bg-white/[0.03]"
              >
                {/* Favicon */}
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
                  style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}25` }}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                    alt=""
                    width={14}
                    height={14}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1 group/link"
                  >
                    <p className={`text-[11.5px] leading-snug line-clamp-2 transition-colors ${item.read ? "line-through text-text-ghost" : "text-text-secondary group-hover/link:text-text-primary"}`}>
                      {item.title}
                    </p>
                    <ExternalLink size={8} className="shrink-0 mt-1 opacity-0 group-hover/link:opacity-50 transition-opacity" style={{ color: "rgba(255,255,255,0.6)" }} />
                  </a>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px]" style={{ color: meta.color, opacity: 0.8 }}>{meta.label}</span>
                    <span className="text-[9px] text-text-ghost">{domain}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleRead(item.id)}
                    className="w-5 h-5 flex items-center justify-center rounded-md transition-colors"
                    style={{ background: item.read ? `${accentColor}20` : "rgba(255,255,255,0.06)" }}
                    aria-label={item.read ? "Mark unread" : "Mark as read"}
                  >
                    <Check size={9} style={{ color: item.read ? accentColor : "rgba(255,255,255,0.3)" }} />
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-red-500/10 transition-colors"
                    aria-label="Remove"
                  >
                    <X size={9} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}
