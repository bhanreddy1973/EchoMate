import { useState, useRef, useEffect } from "react";
import { Plus, MessageSquare, Settings, X, Sparkles, Pencil, Trash2 } from "lucide-react";
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

/* ─── Inline-editable thread item ───────────────────────────────────────── */
interface ThreadItemProps {
  thread: Thread;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function ThreadItem({ thread, isActive, onSelect, onDelete, onRename }: ThreadItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(thread.title);
  const inputRef              = useRef<HTMLInputElement>(null);

  /* Keep draft in sync if title changes externally */
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(thread.id);
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
            if (e.key === "Enter")  confirmEdit();
            if (e.key === "Escape") { setEditing(false); setDraft(thread.title); }
          }}
          className="
            w-full bg-surface-hover text-text-primary text-[13px]
            px-2.5 py-1.5 rounded-lg outline-none
            border border-accent-blue/40 focus:border-accent-blue/60
            transition-colors
          "
        />
      </div>
    );
  }

  return (
    <div className="relative group/item">
      <button
        onClick={() => onSelect(thread.id)}
        className={clsx(
          "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 pr-[60px]",
          isActive
            ? "bg-surface-hover text-text-primary"
            : "text-text-secondary hover:bg-surface-hover/70 hover:text-text-primary",
        )}
      >
        <div
          className={clsx(
            "mt-px w-5 h-5 flex items-center justify-center rounded-md shrink-0 transition-colors",
            isActive ? "bg-accent-blue/12 text-accent-blue" : "text-text-muted",
          )}
        >
          <MessageSquare size={11} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className="truncate text-[13px] font-medium leading-snug">{thread.title}</p>
            <span className="text-[10px] text-text-muted shrink-0 tabular-nums">
              {timeAgo(thread.timestamp)}
            </span>
          </div>
          {thread.lastMessage && (
            <p className="truncate text-[11px] text-text-muted mt-0.5 leading-snug">
              {thread.lastMessage}
            </p>
          )}
        </div>
      </button>

      {/* Hover actions: rename + delete */}
      <div
        className="
          absolute right-2 top-1/2 -translate-y-1/2
          hidden group-hover/item:flex items-center gap-0.5
          bg-surface-active rounded-lg p-1
        "
      >
        <button
          onClick={startEdit}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
          aria-label="Rename"
        >
          <Pencil size={11} strokeWidth={2} />
        </button>
        <button
          onClick={handleDelete}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
          aria-label="Delete"
        >
          <Trash2 size={11} strokeWidth={2} />
        </button>
      </div>
    </div>
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
  return (
    <aside
      className={clsx(
        "flex flex-col h-full bg-surface-secondary shrink-0 transition-all duration-300 ease-in-out",
        isOpen ? "w-[260px] border-r border-border-primary" : "w-0 overflow-hidden",
      )}
    >
      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-[14px] border-b border-border-secondary">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-[10px] logo-gradient flex items-center justify-center shrink-0 shadow-depth-md">
            <Sparkles size={14} className="text-white relative z-10" strokeWidth={2.2} />
            <div className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-white/20 to-transparent" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">EchoMate</p>
            <p className="text-[10px] text-text-muted font-medium mt-px">Voice companion</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
          aria-label="Close sidebar"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ── New conversation ──────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onNewThread}
          className="
            w-full group flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
            border border-border-primary
            text-text-secondary hover:text-text-primary
            hover:bg-surface-hover hover:border-accent-blue/30
            transition-all duration-150
          "
        >
          <div className="w-5 h-5 flex items-center justify-center rounded-md bg-surface-hover group-hover:bg-accent-blue/12 transition-colors">
            <Plus size={13} className="group-hover:text-accent-blue transition-colors" strokeWidth={2.5} />
          </div>
          New conversation
        </button>
      </div>

      {/* ── Thread list ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {threads.length > 0 && (
          <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Recent
          </p>
        )}
        <div className="space-y-px">
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onSelect={onSelectThread}
              onDelete={onDeleteThread}
              onRename={onRenameThread}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-border-secondary">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all">
          <Settings size={14} strokeWidth={1.8} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
