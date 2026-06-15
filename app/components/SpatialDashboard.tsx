"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Settings, Mic, MicOff, ChevronDown, LayoutGrid, MessageSquare, Loader2, Paperclip, Zap, Plug, X, FileText, Image as ImageIcon, ChevronRight, Plus, History, Code2, Radio, Briefcase, BookOpen } from "lucide-react";
import CodingWorkspace from "./coding/CodingWorkspace";
import CareerWorkspace from "./career/CareerWorkspace";
import Link from "next/link";
import NvidiaVoiceChat from "./voice/NvidiaVoiceChat";
import { ChatSkill, DEFAULT_SKILLS } from "./chat/SkillsPanel";
import ConnectorsPanel, { ChatConnector, DEFAULT_CONNECTORS } from "./chat/ConnectorsPanel";
import ModelBrowser from "./chat/ModelBrowser";
import ReactMarkdown from "react-markdown";
import { Room, RoomEvent, Track } from "livekit-client";
import AmbientBackground from "./background/AmbientBackground";
import LiquidGlassOrb from "./orb/LiquidGlassOrb";
import TasksPanel from "./panels/TasksPanel";
import RecapPanel from "./panels/RecapPanel";
import InsightsPanel from "./panels/InsightsPanel";
import ReadingListPanel from "./panels/ReadingListPanel";
import HistoryPanel from "./panels/HistoryPanel";
import ConversationBubbles from "./voice/ConversationBubbles";
import StatusBar from "./ui/StatusBar";
import { useEmotion } from "@/context/EmotionContext";
import { CompletedItem } from "@/types";

export default function SpatialDashboard() {
  const [micActive, setMicActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [view, setView] = useState<"spatial" | "chat" | "coding" | "career">("spatial");
  const [voiceMode, setVoiceMode] = useState<"livekit" | "nvidia">("nvidia");
  const [chatSeedPrompt, setChatSeedPrompt] = useState("");
  const [completedTasks, setCompletedTasks] = useState<CompletedItem[]>([]);
  const { accentColor, glowColor, setEmotion, setMetrics } = useEmotion();
  const roomRef = useRef<Room | null>(null);

  const handleTaskComplete = (text: string) => {
    setCompletedTasks((prev) => [
      { id: `done-${Date.now()}`, text, completedAt: new Date(), category: "task" },
      ...prev,
    ]);
  };

  // Cleanup room on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  const toggleMic = async () => {
    if (micActive) {
      // Disconnect from LiveKit room
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
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

      // Create and connect to LiveKit room
      const connectStart = Date.now();
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Listen for agent audio tracks
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioEl = track.attach();
          audioEl.id = `lk-audio-${participant.identity}`;
          document.body.appendChild(audioEl);
          setEmotion("speaking");
          setMetrics({ connectionState: "connected", latencyMs: Date.now() - connectStart });
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        const elements = track.detach();
        elements.forEach((el) => el.remove());
        setEmotion("listening");
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const agentSpeaking = speakers.some((s) => s.identity !== "echomate-user");
        const userSpeaking = speakers.some((s) => s.identity === "echomate-user");
        if (agentSpeaking) {
          setEmotion("speaking");
        } else if (userSpeaking) {
          setEmotion("listening");
        } else {
          setEmotion("thinking");
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setMicActive(false);
        setEmotion("idle");
        setMetrics({ connectionState: "disconnected" });
        roomRef.current = null;
      });

      // Connect to the room
      await room.connect(data.url, data.token);

      // Publish local microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      roomRef.current = room;
      setMicActive(true);
      setEmotion("listening");
      setMetrics({ connectionState: "connected" });
    } catch (err) {
      console.error("Connection failed:", err);
      setEmotion("concerned");
      setMetrics({ connectionState: "failed" });
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
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
          {(["spatial", "chat", "coding", "career"] as const).map((v) => {
            const Icon = v === "spatial" ? LayoutGrid : v === "chat" ? MessageSquare : v === "coding" ? Code2 : Briefcase;
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

          <Link href="/docs"
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors hover:bg-white/[0.09]"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            aria-label="Docs"
            title="Documentation"
          >
            <BookOpen size={13} className="text-text-muted" strokeWidth={1.8} />
          </Link>
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
                <TasksPanel onTaskComplete={handleTaskComplete} />
                <InsightsPanel />
              </div>

              {/* Row 2: Center — orb + conversation bubbles / NVIDIA Voice */}
              <div className="relative flex flex-col items-center justify-center min-h-0">
                {/* Voice mode toggle */}
                <div className="absolute top-2 flex items-center gap-1 p-0.5 rounded-lg z-20" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <button
                    onClick={() => setVoiceMode("nvidia")}
                    className="px-2 py-1 rounded-md text-[9px] font-medium transition-all"
                    style={voiceMode === "nvidia" ? { background: "rgba(118,185,0,0.15)", color: "#76b900", border: "1px solid rgba(118,185,0,0.3)" } : { color: "rgba(255,255,255,0.35)" }}
                  >
                    <span className="flex items-center gap-1"><Radio size={8} />NVIDIA Voice</span>
                  </button>
                  <button
                    onClick={() => setVoiceMode("livekit")}
                    className="px-2 py-1 rounded-md text-[9px] font-medium transition-all"
                    style={voiceMode === "livekit" ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` } : { color: "rgba(255,255,255,0.35)" }}
                  >
                    <span className="flex items-center gap-1"><Mic size={8} />LiveKit</span>
                  </button>
                </div>

                {voiceMode === "nvidia" ? (
                  <NvidiaVoiceChat />
                ) : (
                  <>
                    <ConversationBubbles />
                    <LiquidGlassOrb />
                  </>
                )}
              </div>

              {/* Row 2: Right panels */}
              <div className="grid grid-rows-2 gap-4 min-h-0 overflow-hidden">
                <RecapPanel newCompletions={completedTasks} />
                <ReadingListPanel />
              </div>

              {/* Row 3: spacer (status bar) */}
              <div /> <div /> <div />
            </div>
          </motion.div>
        ) : view === "coding" ? (
          <CodingWorkspace key="coding" />
        ) : view === "career" ? (
          <CareerWorkspace key="career" />
        ) : (
          <ChatOverlay key="chat" seedPrompt={chatSeedPrompt} onClose={() => { setView("spatial"); setChatSeedPrompt(""); }} />
        )}
      </AnimatePresence>

      {/* ── Status Bar ────────────────────────────────────────────────────── */}
      {view !== "coding" && view !== "career" && <StatusBar />}
    </div>
  );
}

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface AttachedFile { name: string; size: number; type: string; }

const PALETTE = ["#60a5fa","#a78bfa","#34d399","#f87171","#fbbf24","#e879f9","#fb923c","#38bdf8"];

/* ─── Chat overlay ──────────────────────────────────────────────────────── */
function ChatOverlay({ seedPrompt = "" }: { onClose: () => void; seedPrompt?: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hey! I'm EchoMate. What's on your mind?" },
  ]);
  const [input, setInput]             = useState(seedPrompt);
  const [loading, setLoading]         = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [rightPanel, setRightPanel]   = useState<"skills" | "connectors" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [modelTier, setModelTier] = useState<"auto" | "fast" | "reasoning" | "creative" | "technical" | "voice" | "image">("auto");
  const [selectedChatModel, setSelectedChatModel] = useState<string>("meta/llama-3.1-70b-instruct");
  const sessionIdRef = useRef<string | null>(null);

  const startNewConversation = () => {
    setMessages([{ role: "assistant", text: "Hey! I'm EchoMate. What's on your mind?" }]);
    sessionIdRef.current = null;
    setInput("");
    setLoading(false);
  };

  /* Skills state */
  const [skills, setSkills]           = useState<ChatSkill[]>(DEFAULT_SKILLS);
  const [newSkillLabel, setNewSkillLabel]   = useState("");
  const [newSkillPrefix, setNewSkillPrefix] = useState("");
  const [newSkillDesc, setNewSkillDesc]     = useState("");
  const [newSkillColor, setNewSkillColor]   = useState(PALETTE[0]);
  const [addSkillOpen, setAddSkillOpen]     = useState(false);
  const [newSkillMdContent, setNewSkillMdContent] = useState<string | undefined>();
  const [newSkillMdFileName, setNewSkillMdFileName] = useState<string | undefined>();
  const skillFileRef = useRef<HTMLInputElement>(null);

  /* Connectors state */
  const [connectors, setConnectors]         = useState<ChatConnector[]>(DEFAULT_CONNECTORS);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentSeedRef  = useRef(false);
  const { accentColor, glowColor, setEmotion } = useEmotion();

  const activeConnCount = connectors.filter((c) => c.enabled && c.connectedUser).length;

  /* Auto-send seed prompt */
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
          const res  = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.text })), sessionId: sessionIdRef.current }) });
          const data = await res.json();
          if (data.sessionId) sessionIdRef.current = data.sessionId;
          setMessages((p) => [...p, { role: "assistant", text: data.response ?? "Sorry, I couldn't get a response." }]);
          setEmotion("speaking");
          setTimeout(() => setEmotion("listening"), 2000);
        } catch {
          setMessages((p) => [...p, { role: "assistant", text: "⚠️ Backend unreachable." }]);
          setEmotion("concerned");
        } finally { setLoading(false); }
      };
      doSend();
    }
  // intentional: only run once per mount even if seedPrompt changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    setInput("");
    const fileNote = attachedFiles.length > 0 ? ` [Files: ${attachedFiles.map((f) => f.name).join(", ")}]` : "";
    setAttachedFiles([]);
    const skillContext = activeSkillContext;
    setActiveSkillContext(null);
    const next = [...messages, { role: "user" as const, text: t + fileNote }];
    setMessages(next);
    setLoading(true);
    setEmotion("thinking");
    try {
      const payload: { messages: { role: string; content: string }[]; skillContext?: string; sessionId?: string | null; forceTier?: string; forceModel?: string } = {
        messages: next.map((m) => ({ role: m.role, content: m.text })),
        sessionId: sessionIdRef.current,
      };
      if (skillContext) {
        payload.skillContext = skillContext;
      }
      if (modelTier !== "auto") {
        payload.forceTier = modelTier;
      }
      if (selectedChatModel) {
        payload.forceModel = selectedChatModel;
      }
      const res  = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.sessionId) sessionIdRef.current = data.sessionId;
      setMessages((p) => [...p, { role: "assistant", text: data.response ?? "Sorry, I couldn't get a response." }]);
      setEmotion("speaking");
      setTimeout(() => setEmotion("listening"), 2000);
    } catch {
      setMessages((p) => [...p, { role: "assistant", text: "⚠️ Backend unreachable. Is the token server running?" }]);
      setEmotion("concerned");
    } finally { setLoading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachedFiles((prev) => [...prev, ...files.map((f) => ({ name: f.name, size: f.size, type: f.type }))]);
    e.target.value = "";
  };

  const [activeSkillContext, setActiveSkillContext] = useState<string | null>(null);

  const applySkill = (skill: ChatSkill) => {
    setInput((prev) => prev.startsWith(skill.prefix) ? prev : skill.prefix + prev);
    if (skill.mdContent) {
      setActiveSkillContext(skill.mdContent);
    }
  };

  const addSkill = () => {
    const label = newSkillLabel.trim();
    const prefix = newSkillPrefix.trim();
    if (!label || !prefix) return;
    setSkills((prev) => [...prev, {
      id: `sk-${Date.now()}`,
      label,
      color: newSkillColor,
      prefix: prefix.endsWith(" ") ? prefix : prefix + " ",
      description: newSkillDesc.trim() || label,
      mdContent: newSkillMdContent,
      mdFileName: newSkillMdFileName,
    }]);
    setNewSkillLabel(""); setNewSkillPrefix(""); setNewSkillDesc("");
    setNewSkillMdContent(undefined); setNewSkillMdFileName(undefined);
    setAddSkillOpen(false);
  };

  const removeSkill = (id: string) => setSkills((prev) => prev.filter((s) => s.id !== id));

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const panelBg  = "rgba(15,15,25,0.85)";
  const glassBorder = "1px solid rgba(255,255,255,0.09)";

  return (
    <motion.div
      className="absolute inset-0 z-10 flex pt-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── Chat column ── */}
      <div className="flex-1 flex flex-col items-center justify-end pb-16 px-4 min-w-0">
        {/* Messages */}
        <div className="w-full max-w-2xl flex-1 overflow-y-auto space-y-3 pb-4 min-h-0">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed"
                style={m.role === "user"
                  ? { background: accentColor, color: "#fff" }
                  : { background: "rgba(255,255,255,0.07)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.9)" }}>
                {m.role === "assistant"
                  ? <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_a]:text-cyan-400 [&_a]:underline [&_strong]:text-white"><ReactMarkdown>{m.text}</ReactMarkdown></div>
                  : m.text}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
                {[0,1,2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: accentColor, animation: `thinking-dot 1.4s ease-in-out ${i*0.2}s infinite` }} />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="w-full max-w-2xl space-y-2">
          {/* Attached file chips */}
          <AnimatePresence>
            {attachedFiles.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex gap-2 flex-wrap">
                {attachedFiles.map((f) => (
                  <div key={f.name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-text-secondary"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                    {f.type.startsWith("image/") ? <ImageIcon size={11} /> : <FileText size={11} />}
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button onClick={() => setAttachedFiles((p) => p.filter((x) => x.name !== f.name))} className="opacity-50 hover:opacity-100"><X size={9} /></button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input box */}
          <div className="rounded-2xl"
            style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(30px) saturate(180%)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: `0 0 40px -10px ${glowColor}` }}>

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 pt-2.5 pb-1 border-b border-white/5 flex-wrap rounded-t-2xl">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors hover:bg-white/[0.07]"
                style={{ color: "rgba(255,255,255,0.45)" }}>
                <Paperclip size={12} strokeWidth={1.8} /><span>Attach</span>
              </button>

              <div className="w-px h-3 bg-white/10 mx-0.5" />

              <button
                onClick={() => setRightPanel((p) => p === "skills" ? null : "skills")}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all hover:bg-white/[0.07]"
                style={{ color: rightPanel === "skills" ? accentColor : "rgba(255,255,255,0.45)", background: rightPanel === "skills" ? `${accentColor}12` : "transparent" }}>
                <Zap size={12} strokeWidth={1.8} />
                <span>Skills</span>
                <span className="text-[9px] opacity-60 ml-0.5">{skills.length}</span>
                <ChevronRight size={9} style={{ transform: rightPanel === "skills" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              <div className="w-px h-3 bg-white/10 mx-0.5" />

              <button
                onClick={() => setRightPanel((p) => p === "connectors" ? null : "connectors")}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all hover:bg-white/[0.07]"
                style={{ color: rightPanel === "connectors" ? accentColor : "rgba(255,255,255,0.45)", background: rightPanel === "connectors" ? `${accentColor}12` : "transparent" }}>
                <Plug size={12} strokeWidth={1.8} />
                <span>Connectors</span>
                <span className="text-[9px] opacity-60 ml-0.5">{activeConnCount} on</span>
                <ChevronRight size={9} style={{ transform: rightPanel === "connectors" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              <div className="w-px h-3 bg-white/10 mx-0.5" />

              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all hover:bg-white/[0.07]"
                style={{ color: showHistory ? accentColor : "rgba(255,255,255,0.45)", background: showHistory ? `${accentColor}12` : "transparent" }}>
                <History size={12} strokeWidth={1.8} />
                <span>History</span>
              </button>

              <div className="w-px h-3 bg-white/10 mx-0.5" />

              <button
                onClick={startNewConversation}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all hover:bg-white/[0.07]"
                style={{ color: "rgba(255,255,255,0.45)" }}>
                <Plus size={12} strokeWidth={2} />
                <span>New Chat</span>
              </button>

              {attachedFiles.length > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ background: `${accentColor}20`, color: accentColor }}>
                  {attachedFiles.length} file{attachedFiles.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Model browser — Claude/GPT style selector */}
            <ModelBrowser selectedTier={modelTier} onChange={setModelTier} onModelChange={setSelectedChatModel} />

            {/* Textarea + send */}
            <div className="flex items-end gap-3 px-3 py-3">
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
                placeholder={loading ? "EchoMate is thinking…" : "Ask EchoMate anything…"}
                disabled={loading} rows={1}
                className="flex-1 bg-transparent text-[13.5px] text-text-primary placeholder:text-text-ghost outline-none resize-none leading-relaxed py-1 disabled:opacity-60"
                style={{ maxHeight: 120 }} />
              <button onClick={send} disabled={loading || !input.trim()}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: accentColor, boxShadow: loading ? "none" : `0 0 16px ${glowColor}` }} aria-label="Send">
                <ChevronDown size={16} strokeWidth={2.5} style={{ transform: "rotate(-90deg)" }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <AnimatePresence>
        {rightPanel && (
          <motion.div
            key={rightPanel}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="shrink-0 overflow-hidden"
            style={{ borderLeft: glassBorder }}
          >
            <div className="w-[300px] h-full flex flex-col pt-2 pb-6 px-4 overflow-y-auto"
              style={{ background: panelBg, backdropFilter: "blur(40px)" }}>

              {/* ── SKILLS PANEL ── */}
              {rightPanel === "skills" && (
                <>
                  {/* Panel header */}
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Zap size={14} style={{ color: accentColor }} />
                      <h3 className="text-[13px] font-semibold text-text-primary">Skills</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: `${accentColor}20`, color: accentColor }}>{skills.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setAddSkillOpen((v) => !v)}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
                        style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor }}>
                        <Plus size={11} />
                      </button>
                      <button onClick={() => setRightPanel(null)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors">
                        <X size={11} className="text-text-muted" />
                      </button>
                    </div>
                  </div>

                  {/* Add skill form */}
                  <AnimatePresence>
                    {addSkillOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden shrink-0 mb-3">
                        <div className="p-3 rounded-xl flex flex-col gap-2.5"
                          style={{ background: "rgba(255,255,255,0.04)", border: glassBorder }}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">New Skill</p>
                          <input value={newSkillLabel} onChange={(e) => setNewSkillLabel(e.target.value)}
                            placeholder="Skill name (e.g. Brainstorm)"
                            className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />
                          <input value={newSkillPrefix} onChange={(e) => setNewSkillPrefix(e.target.value)}
                            placeholder="Prompt prefix (e.g. Brainstorm ideas for)"
                            className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />
                          <input value={newSkillDesc} onChange={(e) => setNewSkillDesc(e.target.value)}
                            placeholder="Short description (optional)"
                            className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />

                          {/* Skill file attachment */}
                          <input ref={skillFileRef} type="file" accept=".md,.txt,text/markdown,text/plain"
                            className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setNewSkillMdContent(ev.target?.result as string);
                                setNewSkillMdFileName(file.name);
                                if (!newSkillLabel) setNewSkillLabel(file.name.replace(/\.(md|txt)$/i, ""));
                              };
                              reader.readAsText(file);
                              e.target.value = "";
                            }} />
                          <button onClick={() => skillFileRef.current?.click()}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11.5px] transition-colors hover:bg-white/[0.05]"
                            style={{ background: "rgba(255,255,255,0.04)", border: newSkillMdFileName ? `1px solid ${accentColor}40` : "1px solid rgba(255,255,255,0.07)", color: newSkillMdFileName ? accentColor : "rgba(255,255,255,0.4)" }}>
                            <FileText size={12} strokeWidth={1.8} />
                            {newSkillMdFileName ? (
                              <span className="truncate max-w-[140px]">{newSkillMdFileName}</span>
                            ) : (
                              <span>Attach skill file (.md / .txt)</span>
                            )}
                            {newSkillMdFileName && (
                              <span className="ml-auto opacity-60 hover:opacity-100 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setNewSkillMdContent(undefined); setNewSkillMdFileName(undefined); }}>
                                <X size={9} />
                              </span>
                            )}
                          </button>
                          {newSkillMdFileName && (
                            <p className="text-[10px] text-text-muted px-1">
                              File content will be sent as context when this skill is used.
                            </p>
                          )}

                          <div>
                            <p className="text-[10px] text-text-muted mb-1.5">Colour</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {PALETTE.map((c) => (
                                <button key={c} onClick={() => setNewSkillColor(c)}
                                  className="w-5 h-5 rounded-full transition-all"
                                  style={{ backgroundColor: c, outline: newSkillColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
                              ))}
                            </div>
                          </div>
                          <button onClick={addSkill} disabled={!newSkillLabel.trim() || !newSkillPrefix.trim()}
                            className="w-full py-1.5 rounded-lg text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
                            style={{ background: accentColor }}>
                            Add Skill
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Skills list */}
                  <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
                    {skills.map((skill) => (
                      <motion.div key={skill.id} layout
                        className="group flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${skill.color}18`, border: `1px solid ${skill.color}28` }}>
                          <Zap size={12} style={{ color: skill.color }} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[12px] font-medium text-text-primary">{skill.label}</p>
                            {skill.mdFileName && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                style={{ background: `${skill.color}18`, color: skill.color }}>
                                <FileText size={8} /> .md
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-text-muted mt-0.5 truncate">{skill.description}</p>
                          <button onClick={() => applySkill(skill)}
                            className="mt-1.5 text-[10px] px-2 py-0.5 rounded-md transition-colors"
                            style={{ background: `${skill.color}18`, color: skill.color, border: `1px solid ${skill.color}28` }}>
                            Use
                          </button>
                        </div>
                        <button onClick={() => removeSkill(skill.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0">
                          <X size={10} className="text-text-ghost" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}

              {/* ── CONNECTORS PANEL ── */}
              {rightPanel === "connectors" && (
                <ConnectorsPanel
                  connectors={connectors}
                  onConnectorsChange={setConnectors}
                  onClose={() => setRightPanel(null)}
                />
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── History panel ── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            key="history"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="shrink-0 overflow-hidden"
            style={{ borderLeft: glassBorder }}
          >
            <div className="w-[340px] h-full">
              <HistoryPanel onClose={() => setShowHistory(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
