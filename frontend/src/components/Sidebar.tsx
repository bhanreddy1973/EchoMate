import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Settings, X, Sparkles, Pencil, Trash2, Search, Brain, BookOpen, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { Thread } from "../types";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string;
  isOpen: boolean;
  onToggle: () => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)   return "now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ─── Thread Item ───────────────────────────────────────────────────────── */
interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  index: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function ThreadItem({ thread, isActive, index, onSelect, onDelete, onRename }: ThreadItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(thread.title); }, [thread.title]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirmEdit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== thread.title) onRename(thread.id, trimmed);
    else setDraft(thread.title);
  };

  if (editing) {
    return (
      <div className="px-3 py-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmEdit();
            if (e.key === "Escape") { setEditing(false); setDraft(thread.title); }
          }}
          className="w-full bg-surface-hover text-text-primary text-[12px] px-2.5 py-1.5 rounded-lg outline-none border border-accent-blue/40 focus:border-accent-blue/60 transition-colors"
        />
      </div>
    );
  }

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, type: "spring", damping: 25, stiffness: 300 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => onSelect(thread.id)}
        className={clsx(
          "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 pr-[52px]",
          isActive
            ? "bg-accent-blue/[0.08] text-text-primary border border-accent-blue/20"
            : "text-text-secondary hover:bg-surface-hover/70 hover:text-text-primary border border-transparent",
        )}
      >
        <div className={clsx(
          "mt-0.5 w-5 h-5 flex items-center justify-center rounded-md shrink-0 transition-colors",
          isActive ? "bg-accent-blue/15 text-accent-blue" : "text-text-muted",
        )}>
          <MessageSquare size={11} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className="truncate text-[12.5px] font-medium leading-snug">{thread.title}</p>
            <span className="text-[9px] text-text-muted shrink-0 tabular-nums">{timeAgo(thread.timestamp)}</span>
          </div>
          {thread.lastMessage && (
            <p className="truncate text-[10.5px] text-text-muted mt-0.5 leading-snug">{thread.lastMessage}</p>
          )}
        </div>
      </button>

      {/* Hover action buttons */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-surface-active rounded-lg p-0.5"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
          >
            <button
              onClick={startEdit}
              className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              aria-label="Rename"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(thread.id); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
              aria-label="Delete"
            >
              <Trash2 size={10} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
export default function Sidebar({
  threads,
  activeThreadId,
  isOpen,
  onToggle,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = searchQuery
    ? threads.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : threads;

  // Group threads by date
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: { label: string; threads: Thread[] }[] = [];
  const todayThreads = filteredThreads.filter((t) => t.timestamp >= today);
  const yesterdayThreads = filteredThreads.filter((t) => t.timestamp >= yesterday && t.timestamp < today);
  const olderThreads = filteredThreads.filter((t) => t.timestamp < yesterday);

  if (todayThreads.length) groups.push({ label: "Today", threads: todayThreads });
  if (yesterdayThreads.length) groups.push({ label: "Yesterday", threads: yesterdayThreads });
  if (olderThreads.length) groups.push({ label: "Older", threads: olderThreads });

  const quickNav = [
    { id: "tasks", label: "Today's Tasks", icon: CheckCircle2, color: "#34d399" },
    { id: "memory", label: "Memory Vault", icon: Brain, color: "#a78bfa" },
    { id: "journal", label: "Journal", icon: BookOpen, color: "#fbbf24" },
    { id: "settings", label: "Settings", icon: Settings, color: "rgba(255,255,255,0.35)" },
  ];

  return (
    <aside
      className={clsx(
        "flex flex-col h-full shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
        isOpen ? "w-[270px] border-r border-white/[0.05]" : "w-0",
      )}
      style={{
        background: "rgba(7,7,14,0.95)",
        backdropFilter: "blur(40px)",
      }}
    >
      <div className="flex flex-col h-full w-[270px] min-w-[270px]">
        {/* ── Brand ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.05] shrink-0">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="relative w-7 h-7 rounded-[9px] logo-gradient flex items-center justify-center shrink-0"
              style={{ boxShadow: "0 0 16px rgba(99,102,241,0.3)" }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles size={12} className="text-white relative z-10" strokeWidth={2.2} />
            </motion.div>
            <div className="leading-tight">
              <p className="text-[12.5px] font-semibold text-text-primary tracking-[-0.01em]">EchoMate</p>
              <p className="text-[9.5px] text-text-muted font-medium mt-px">Voice Companion</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
            aria-label="Close sidebar"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        {/* ── New conversation ────────────────────────────────────── */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <motion.button
            onClick={onNewThread}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full group flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium border border-white/[0.08] text-text-secondary hover:text-text-primary hover:border-accent-blue/30 hover:bg-surface-hover transition-all duration-200"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-md bg-surface-hover group-hover:bg-accent-blue/12 transition-colors">
              <Plus size={12} className="group-hover:text-accent-blue transition-colors" strokeWidth={2.5} />
            </div>
            New conversation
          </motion.button>
        </div>

        {/* ── Search ──────────────────────────────────────────────── */}
        <div className="px-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <Search size={12} className="text-text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-muted/60 outline-none"
            />
          </div>
        </div>

        {/* ── Thread list ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0 space-y-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.threads.map((thread, i) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    index={i}
                    onSelect={onSelectThread}
                    onDelete={onDeleteThread}
                    onRename={onRenameThread}
                  />
                ))}
              </div>
            </div>
          ))}

          {filteredThreads.length === 0 && (
            <div className="flex flex-col items-center py-10 px-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.03] mb-2.5">
                <MessageSquare size={14} className="text-text-muted/50" />
              </div>
              <p className="text-[11px] text-text-muted text-center">
                {searchQuery ? "No matches found" : "No conversations yet"}
              </p>
            </div>
          )}
        </div>

        {/* ── Quick Navigation ────────────────────────────────────── */}
        <div className="border-t border-white/[0.05] px-2.5 py-2.5 space-y-0.5 shrink-0">
          {quickNav.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11.5px] text-text-muted hover:text-text-primary hover:bg-surface-hover/60 transition-all duration-150"
            >
              <item.icon size={12} style={{ color: item.color }} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
