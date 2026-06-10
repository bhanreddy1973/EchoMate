"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Settings, Mic, MicOff, ChevronDown, LayoutGrid, MessageSquare, Loader2 } from "lucide-react";
import AmbientBackground from "./background/AmbientBackground";
import LiquidGlassOrb from "./orb/LiquidGlassOrb";
import TasksPanel from "./panels/TasksPanel";
import RecapPanel from "./panels/RecapPanel";
import InsightsPanel from "./panels/InsightsPanel";
import BriefPanel from "./panels/BriefPanel";
import ConversationBubbles from "./voice/ConversationBubbles";
import StatusBar from "./ui/StatusBar";
import { useEmotion } from "@/context/EmotionContext";

export default function SpatialDashboard() {
  const [micActive, setMicActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [view, setView] = useState<"spatial" | "chat">("spatial");
  const [chatSeedPrompt, setChatSeedPrompt] = useState("");
  const { accentColor, glowColor, setEmotion, setMetrics } = useEmotion();

  const handleVoicePrompt = (prompt: string) => {
    setChatSeedPrompt(prompt);
    setView("chat");
  };

  const toggleMic = async () => {
    if (micActive) {
      // Disconnect
      setMicActive(false);
      setEmotion("idle");
      setMetrics({ connectionState: "disconnected" });
      return;
    }

    // Start connecting
    setConnecting(true);
    setEmotion("thinking");
    setMetrics({ connectionState: "connecting" });

    try {
      // Fetch token from backend
      const res = await fetch("/api/token");
      if (!res.ok) throw new Error("Failed to get token");
      const data = await res.json();

      if (!data.token || !data.url) throw new Error("Invalid token response");

      // Token received — session is live
      setMicActive(true);
      setEmotion("listening");
      setMetrics({ connectionState: "connected" });
    } catch (err) {
      console.error("Connection failed:", err);
      setEmotion("concerned");
      setMetrics({ connectionState: "failed" });
      setTimeout(() => {
        setEmotion("idle");
        setMetrics({ connectionState: "disconnected" });
      }, 3000);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Ambient background — z-0 */}
      <AmbientBackground />

      {/* ── Top Nav Bar ───────────────────────────────────────────────────── */}
      <motion.header
        className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 py-4"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}80 100%)`,
              boxShadow: `0 0 20px ${glowColor}`,
            }}
          >
            <Sparkles size={14} className="text-white" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">EchoMate</p>
            <p className="text-[10px] text-text-muted">Voice Companion</p>
          </div>
        </div>

        {/* View toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {(["spatial", "chat"] as const).map((v) => {
            const Icon = v === "spatial" ? LayoutGrid : MessageSquare;
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
                style={active ? {
                  background: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}30`,
                } : {
                  color: "rgba(255,255,255,0.4)",
                }}
                aria-label={v}
              >
                <Icon size={11} strokeWidth={2} />
                <span className="capitalize">{v}</span>
              </button>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <motion.button
            onClick={toggleMic}
            disabled={connecting}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all duration-300 disabled:opacity-70 disabled:cursor-wait"
            style={micActive ? {
              background: `${accentColor}20`,
              border: `1px solid ${accentColor}40`,
              color: accentColor,
              boxShadow: `0 0 20px ${glowColor}`,
            } : connecting ? {
              background: `${accentColor}10`,
              border: `1px solid ${accentColor}30`,
              color: accentColor,
            } : {
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.65)",
            }}
            aria-label={connecting ? "Connecting" : micActive ? "Stop listening" : "Start listening"}
          >
            <motion.div
              animate={micActive ? { scale: [1, 1.2, 1] } : connecting ? { rotate: 360 } : { scale: 1 }}
              transition={connecting ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {connecting ? <Loader2 size={13} strokeWidth={2.2} /> : micActive ? <Mic size={13} strokeWidth={2.2} /> : <MicOff size={13} strokeWidth={2.2} />}
            </motion.div>
            {connecting ? "Connecting…" : micActive ? "Listening" : "Start Session"}
          </motion.button>

          <button
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            aria-label="Settings"
          >
            <Settings size={13} className="text-text-muted" strokeWidth={1.8} />
          </button>
        </div>
      </motion.header>

      {/* ── Main Spatial Layout ───────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {view === "spatial" ? (
          <motion.div
            key="spatial"
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/*
             * 3-column, 3-row grid:
             *   col: [panel-width]  [orb-gap]  [panel-width]
             *   row: [header]  [panels+orb]  [statusbar]
             */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: "360px 1fr 360px",
                gridTemplateRows: "72px 1fr 60px",
                padding: "0 24px 0 24px",
                gap: "16px",
              }}
            >
              {/* Row 1: spacer (header) */}
              <div /> <div /> <div />

              {/* Row 2: Left panels */}
              <div className="grid grid-rows-2 gap-4 min-h-0 overflow-hidden">
                <TasksPanel />
                <InsightsPanel />
              </div>

              {/* Row 2: Center — orb + conversation bubbles */}
              <div className="relative flex items-center justify-center min-h-0">
                <ConversationBubbles />
                <LiquidGlassOrb />
              </div>

              {/* Row 2: Right panels */}
              <div className="grid grid-rows-2 gap-4 min-h-0 overflow-hidden">
                <RecapPanel />
                <BriefPanel onVoicePrompt={handleVoicePrompt} />
              </div>

              {/* Row 3: spacer (status bar) */}
              <div /> <div /> <div />
            </div>
          </motion.div>
        ) : (
          <ChatOverlay key="chat" seedPrompt={chatSeedPrompt} onClose={() => { setView("spatial"); setChatSeedPrompt(""); }} />
        )}
      </AnimatePresence>

      {/* ── Status Bar ────────────────────────────────────────────────────── */}
      <StatusBar />
    </div>
  );
}

/* ─── Chat overlay (minimal, focused conversation mode) ──────────────────── */
function ChatOverlay({ onClose, seedPrompt = "" }: { onClose: () => void; seedPrompt?: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hey! I'm EchoMate. What's on your mind?" },
  ]);
  const [input, setInput] = useState(seedPrompt);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentSeedRef = useRef(false);
  const { accentColor, glowColor, setEmotion } = useEmotion();

  /* Auto-send seed prompt once on mount */
  useEffect(() => {
    if (seedPrompt && !sentSeedRef.current) {
      sentSeedRef.current = true;
      setInput("");
      const doSend = async () => {
        const userMsg = { role: "user" as const, text: seedPrompt };
        const next = [{ role: "assistant" as const, text: "Hey! I'm EchoMate. What's on your mind?" }, userMsg];
        setMessages(next);
        setLoading(true);
        setEmotion("thinking");
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.text })) }),
          });
          const data = await res.json();
          setMessages((p) => [...p, { role: "assistant", text: data.response ?? "Sorry, I couldn't get a response." }]);
          setEmotion("speaking");
          setTimeout(() => setEmotion("listening"), 2000);
        } catch {
          setMessages((p) => [...p, { role: "assistant", text: "⚠️ Backend unreachable." }]);
          setEmotion("concerned");
        } finally {
          setLoading(false);
        }
      };
      doSend();
    }
  }, []);

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, text: t }];
    setMessages(next);
    setLoading(true);
    setEmotion("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await res.json();
      const reply = data.response ?? "Sorry, I couldn't get a response.";
      setMessages((p) => [...p, { role: "assistant", text: reply }]);
      setEmotion("speaking");
      setTimeout(() => setEmotion("listening"), 2000);
    } catch {
      setMessages((p) => [...p, { role: "assistant", text: "⚠️ Backend unreachable. Is the token server running?" }]);
      setEmotion("concerned");
    } finally {
      setLoading(false);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-24 pt-20 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      {/* Messages */}
      <div className="w-full max-w-2xl flex-1 overflow-y-auto space-y-3 pb-4 min-h-0">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed"
              style={m.role === "user" ? {
                background: accentColor,
                color: "#fff",
              } : {
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {m.text}
            </div>
          </motion.div>
        ))}

        {/* Thinking indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div
              className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: accentColor,
                    animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="w-full max-w-2xl">
        <div
          className="flex items-end gap-3 px-3 py-3 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(30px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: `0 0 40px -10px ${glowColor}`,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder={loading ? "EchoMate is thinking…" : "Ask EchoMate anything…"}
            disabled={loading}
            rows={1}
            className="flex-1 bg-transparent text-[13.5px] text-text-primary placeholder:text-text-ghost outline-none resize-none leading-relaxed py-1 disabled:opacity-60"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: accentColor, boxShadow: loading ? "none" : `0 0 16px ${glowColor}` }}
            aria-label="Send"
          >
            <ChevronDown size={16} strokeWidth={2.5} style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
