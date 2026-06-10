import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import { Message, Thread } from "./types";

/* ─── Mock AI responses ──────────────────────────────────────────────────── */
function getAIResponse(input: string): string {
  const q = input.toLowerCase();

  if (/\b(hi|hello|hey|hio|heya|howdy|sup)\b/.test(q))
    return "Hey! Great to hear from you.\n\nI'm **EchoMate** — your voice-powered daily companion. I can help with:\n\n• **Morning briefings** and schedule overviews\n• **Tasks & reminders** — just say what you need\n• **Weekly planning** and habit tracking\n• **Voice conversations** — speak naturally, I'll listen\n\nWhat's on your mind today?";

  if (/morning|briefing|today|schedule|day ahead/.test(q))
    return "Good morning! Here's your day at a glance:\n\n**9:00 AM** — Team standup (15 min)\n**11:30 AM** — Client call with Acme Corp\n**2:00 PM** — Design review session\n**4:30 PM** — 1:1 with manager\n\nYou have **3 unread messages** and **2 tasks due today**. Want me to read them out?";

  if (/add.*task|new task|create task|todo|to.do/.test(q))
    return "Task added! ✓\n\nYour current task list:\n1. Review Q3 metrics — *due today*\n2. Update project proposal — *due tomorrow*\n3. Schedule team offsite — *this week*\n4. **" + input.replace(/^(add|create|new)\s+(a\s+|the\s+)?task:?\s*/i, "").trim() + "**\n\nWant me to set a deadline or priority?";

  if (/remind|reminder|alert/.test(q))
    return "Reminder set! I'll make sure you don't miss it.\n\nYou can get specific:\n• *\"Remind me in 30 minutes\"*\n• *\"Set a reminder for 3 PM\"*\n• *\"Remind me every Monday morning\"*\n\nAnything else to track?";

  if (/week|weekly|this week|next week/.test(q))
    return "Here's your week overview:\n\n**Mon** — 3 meetings · 2 deadlines\n**Tue** — Focus block 2–5 PM *(blocked)*\n**Wed** — All-hands 10 AM\n**Thu** — Client presentations × 2\n**Fri** — 1:1s + weekly review\n\nLooking busy mid-week. Want me to suggest schedule adjustments?";

  if (/habit|track|streak|daily/.test(q))
    return "Here's your habit tracker:\n\n🟢 **Morning workout** — 12-day streak!\n🟢 **Reading** — 8 days\n🟡 **Meditation** — 3 days *(broke streak)*\n🔴 **Evening walk** — missed yesterday\n\nYou're doing great overall! Shall I set a reminder to rebuild your streak?";

  if (/help|what can you|features|what do you do/.test(q))
    return "Here's everything I can do:\n\n🗓 **Schedule** — briefings, events, planning\n✅ **Tasks** — add, complete, prioritize\n⏰ **Reminders** — smart time-based alerts\n📊 **Habits** — track streaks and progress\n🎙 **Voice** — speak naturally, I'll understand\n\nTry *\"Morning briefing\"* or *\"How's my week?\"* to get started!";

  if (/weather|forecast/.test(q))
    return "I don't have live weather data just yet — that's on the roadmap!\n\nFor now I'd suggest checking your local forecast app. Want me to add a *\"Check weather\"* reminder to your morning routine?";

  const fallbacks = [
    `Got it — I've noted *\"${input.slice(0, 60)}${input.length > 60 ? "…" : ""}\"*.\n\nWould you like me to add this as a **task**, set a **reminder**, or is there something specific you'd like to explore?`,
    `Interesting point! Right now my core skills cover **scheduling, tasks, and reminders** — but I'm always learning.\n\nIs there something in those areas I can help you tackle right now?`,
    `I hear you. I've logged that for context.\n\n**Tip:** You can also just *speak to me* using the microphone — sometimes it's faster than typing. What else can I help with?`,
    `Thanks for sharing! Here's a quick question back: would you like me to track this as a **goal** or turn it into an **action item** for this week?`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ─── LocalStorage helpers ───────────────────────────────────────────────── */
const LS_THREADS  = "echomate:threads";
const LS_MESSAGES = "echomate:messages";

function readLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function writeLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded */ }
}

type RawMessage = Omit<Message, "timestamp"> & { timestamp: string };
type RawThread  = Omit<Thread,  "timestamp"> & { timestamp: string };

function hydrateMessages(raw: Record<string, RawMessage[]>): Record<string, Message[]> {
  const out: Record<string, Message[]> = {};
  for (const [tid, msgs] of Object.entries(raw)) {
    out[tid] = msgs.map((m) => ({ ...m, isStreaming: false, timestamp: new Date(m.timestamp) }));
  }
  return out;
}
function hydrateThreads(raw: RawThread[]): Thread[] {
  return raw.map((t) => ({ ...t, timestamp: new Date(t.timestamp) }));
}

/* ─── Seed data ──────────────────────────────────────────────────────────── */
const SEED_ID = "seed-1";
const SEED_THREAD: Thread = {
  id: SEED_ID,
  title: "Morning Briefing",
  lastMessage: "Good morning! Here's your day ahead…",
  timestamp: new Date(),
  active: true,
};

/* ─── App ────────────────────────────────────────────────────────────────── */
export default function App() {
  const [threads, setThreads] = useState<Thread[]>(() => {
    const stored = readLS<RawThread[]>(LS_THREADS, []);
    return stored.length ? hydrateThreads(stored) : [SEED_THREAD];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(
    () => readLS<RawThread[]>(LS_THREADS, [{ id: SEED_ID } as RawThread])[0]?.id ?? SEED_ID,
  );

  const [threadMessages, setThreadMessages] = useState<Record<string, Message[]>>(() =>
    hydrateMessages(readLS<Record<string, RawMessage[]>>(LS_MESSAGES, {})),
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const streamingRef = useRef(false);

  const messages = useMemo(
    () => threadMessages[activeThreadId] ?? [],
    [threadMessages, activeThreadId],
  );

  const isAIStreaming = messages.some((m) => m.isStreaming);

  /* Persist whenever threads or messages change */
  useEffect(() => { writeLS(LS_THREADS, threads); }, [threads]);
  useEffect(() => { writeLS(LS_MESSAGES, threadMessages); }, [threadMessages]);

  /* ── Message helpers ─────────────────────────────────────────────────── */
  const appendMessage = useCallback((threadId: string, msg: Message) => {
    setThreadMessages((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] ?? []), msg],
    }));
  }, []);

  const patchMessage = useCallback((threadId: string, id: string, patch: Partial<Message>) => {
    setThreadMessages((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }, []);

  const bumpThread = useCallback((threadId: string, preview: string) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, lastMessage: preview.slice(0, 72), timestamp: new Date() }
          : t,
      ),
    );
  }, []);

  /* ── AI simulation ───────────────────────────────────────────────────── */
  const simulateAI = useCallback(
    async (threadId: string, userInput: string) => {
      if (streamingRef.current) return;
      streamingRef.current = true;

      const aiId = `ai-${Date.now()}`;

      /* Thinking delay */
      await sleep(550 + Math.random() * 350);

      appendMessage(threadId, {
        id: aiId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      /* Pause before stream starts (feels more natural) */
      await sleep(450 + Math.random() * 300);

      const response = getAIResponse(userInput);

      /* Stream character by character */
      for (let i = 1; i <= response.length; i++) {
        patchMessage(threadId, aiId, { content: response.slice(0, i) });
        await sleep(8 + Math.random() * 12);
      }

      patchMessage(threadId, aiId, { isStreaming: false });
      bumpThread(threadId, response.replace(/\*\*/g, "").replace(/\*/g, ""));
      streamingRef.current = false;
    },
    [appendMessage, patchMessage, bumpThread],
  );

  /* ── User actions ────────────────────────────────────────────────────── */
  const handleSend = useCallback(
    (content: string) => {
      const msg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };
      appendMessage(activeThreadId, msg);
      bumpThread(activeThreadId, content);
      simulateAI(activeThreadId, content);
    },
    [activeThreadId, appendMessage, bumpThread, simulateAI],
  );

  const handleNewThread = useCallback(() => {
    const t: Thread = {
      id: `thread-${Date.now()}`,
      title: "New conversation",
      lastMessage: "",
      timestamp: new Date(),
      active: true,
    };
    setThreads((prev) => [t, ...prev]);
    setActiveThreadId(t.id);
  }, []);

  const handleSelectThread = useCallback((id: string) => {
    setActiveThreadId(id);
  }, []);

  const handleDeleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeThreadId) {
          if (next.length > 0) setActiveThreadId(next[0].id);
          else {
            const fresh: Thread = {
              id: `thread-${Date.now()}`,
              title: "New conversation",
              lastMessage: "",
              timestamp: new Date(),
              active: true,
            };
            setTimeout(() => setActiveThreadId(fresh.id), 0);
            return [fresh];
          }
        }
        return next;
      });
      setThreadMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [activeThreadId],
  );

  const handleRenameThread = useCallback((id: string, title: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }, []);

  const handleClearThread = useCallback(() => {
    setThreadMessages((prev) => ({ ...prev, [activeThreadId]: [] }));
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, lastMessage: "" } : t)),
    );
  }, [activeThreadId]);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex h-full overflow-hidden bg-surface-primary">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewThread={handleNewThread}
        onSelectThread={handleSelectThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={handleRenameThread}
      />
      <ChatArea
        thread={activeThread}
        messages={messages}
        isAIStreaming={isAIStreaming}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onSend={handleSend}
        onClearThread={handleClearThread}
      />
    </div>
  );
}
