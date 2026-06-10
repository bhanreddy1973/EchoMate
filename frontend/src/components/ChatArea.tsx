import { useRef, useEffect } from "react";
import { PanelLeftOpen, Zap, CheckSquare, Clock, Calendar, Trash2, MoreHorizontal, Phone, PhoneOff } from "lucide-react";
import { useState } from "react";
import { Message, Thread } from "../types";
import ChatMessage from "./ChatMessage";
import VoiceOrb from "./VoiceOrb";
import Composer from "./Composer";
import ConnectionBadge from "./ConnectionBadge";
import { useVoiceConnection } from "../hooks/useVoiceConnection";

interface ChatAreaProps {
  thread?: Thread;
  messages: Message[];
  isAIStreaming: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSend: (content: string) => void;
  onClearThread: () => void;
}

export default function ChatArea({
  thread,
  messages,
  isAIStreaming,
  sidebarOpen,
  onToggleSidebar,
  onSend,
  onClearThread,
}: ChatAreaProps) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { connectionState, agentStatus, connect, disconnect, error } = useVoiceConnection();

  /* Smooth scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Close menu when clicking outside */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 bg-surface-primary overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 glass border-b-glass z-20 shrink-0">
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} />
            </button>
          )}
          <div className="leading-tight">
            <h1 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">
              {thread?.title ?? "EchoMate"}
            </h1>
            <p className="text-[11px] text-text-muted">
              {messages.length > 0
                ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
                : "Voice companion"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Start / End Session button */}
          {connectionState === "disconnected" || connectionState === "failed" ? (
            <button
              onClick={connect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-accent-green/15 text-accent-green border border-accent-green/30 hover:bg-accent-green/25 transition-all"
            >
              <Phone size={13} strokeWidth={2} />
              Start Session
            </button>
          ) : connectionState === "connected" ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-accent-red/15 text-accent-red border border-accent-red/30 hover:bg-accent-red/25 transition-all"
            >
              <PhoneOff size={13} strokeWidth={2} />
              End Session
            </button>
          ) : (
            <span className="text-[12px] text-text-muted px-2">Connecting...</span>
          )}

          <ConnectionBadge state={connectionState} onReconnect={connect} />

          {/* Actions menu */}
          {messages.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
                aria-label="More options"
              >
                <MoreHorizontal size={16} strokeWidth={1.8} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 w-48 bg-surface-tertiary border border-border-primary rounded-xl shadow-depth-md overflow-hidden z-30 animate-[fade-up_0.15s_ease]">
                  <button
                    onClick={() => { onClearThread(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-accent-red hover:bg-accent-red/8 transition-colors"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    Clear conversation
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          /* Full-height empty / welcome state */
          <div className="h-full">
            <EmptyState agentStatus={agentStatus} onSuggestion={onSend} />
          </div>
        ) : (
          /*
           * Messages anchor to the bottom:
           * The outer wrapper is min-h-full flex flex-col justify-end.
           * When few messages exist they stick to the bottom.
           * As messages grow past the viewport they scroll naturally.
           */
          <div className="min-h-full flex flex-col justify-end">
            <div className="max-w-2xl w-full mx-auto px-4 pt-6 pb-2 space-y-1">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {/* Invisible anchor so scrollIntoView always works */}
              <div ref={bottomRef} className="h-1" aria-hidden />
            </div>
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-accent-red/8 border border-accent-red/20 text-accent-red text-[13px] animate-[fade-up_0.3s_ease]">
          {error}
        </div>
      )}

      {/* ── Composer ─────────────────────────────────────────────── */}
      <div className="shrink-0">
        <Composer
          agentStatus={agentStatus}
          connectionState={connectionState}
          isAIStreaming={isAIStreaming}
          onSend={onSend}
        />
      </div>
    </main>
  );
}

/* ─── Empty / welcome state ─────────────────────────────────────────────── */
const SUGGESTIONS = [
  { label: "Morning briefing",  icon: Zap          },
  { label: "Add a task",        icon: CheckSquare  },
  { label: "Set a reminder",    icon: Clock        },
  { label: "How's my week?",    icon: Calendar     },
] as const;

function EmptyState({
  agentStatus,
  onSuggestion,
}: {
  agentStatus: string;
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full gap-10 px-6 overflow-hidden">

      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: "absolute", width: 560, height: 380, borderRadius: "50%",
          top: "22%", left: "50%",
          background: "radial-gradient(ellipse at center, rgba(167,139,250,0.14) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: "translate(-58%, -50%)",
          animation: "ambient-drift 14s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", width: 480, height: 340, borderRadius: "50%",
          top: "35%", left: "50%",
          background: "radial-gradient(ellipse at center, rgba(99,102,241,0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: "translate(-42%, -50%)",
          animation: "ambient-drift-b 18s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", width: 320, height: 200, borderRadius: "50%",
          bottom: "18%", left: "50%",
          background: "radial-gradient(ellipse at center, rgba(52,211,153,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: "translateX(-50%)",
        }} />
      </div>

      {/* Orb */}
      <div className="relative z-10 animate-[fade-in_0.5s_ease]" style={{ paddingBottom: 36 }}>
        <VoiceOrb status={agentStatus as any} size="lg" />
      </div>

      {/* Heading */}
      <div className="relative z-10 text-center max-w-sm animate-[fade-up_0.55s_ease_0.1s_both]">
        <h2 className="text-[2rem] font-bold tracking-[-0.03em] leading-tight gradient-text">
          Hey, I'm EchoMate
        </h2>
        <p className="mt-3 text-[14px] text-text-secondary leading-relaxed">
          Your voice-powered daily companion. Start speaking or type below — briefings,
          tasks, reminders, habits, and more.
        </p>
      </div>

      {/* Clickable suggestion chips */}
      <div className="relative z-10 flex flex-wrap justify-center gap-2 animate-[fade-up_0.55s_ease_0.22s_both]">
        {SUGGESTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => onSuggestion(label)}
            className="
              flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium
              border border-border-primary bg-surface-secondary/60
              text-text-secondary hover:text-text-primary
              hover:border-accent-blue/35 hover:bg-surface-hover/80
              active:scale-[0.97] transition-all duration-150
            "
          >
            <Icon size={12} className="text-accent-purple shrink-0" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
