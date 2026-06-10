import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import ConnectorsPanel from "./components/ConnectorsPanel";
import SkillsPanel from "./components/SkillsPanel";
import { Message, Thread, Attachment, Connector, Skill } from "./types";

/* ─── Chat API ────────────────────────────────────────────────────────────── */
const CHAT_API_URL = "http://127.0.0.1:8081/api/chat";

async function fetchAIResponse(
  messages: { role: string; content: string }[],
): Promise<string> {
  const res = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.response || "I couldn't generate a response. Please try again.";
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

/* ─── Connectors & Skills constants ─────────────────────────────────────── */
const DEFAULT_CONNECTORS: Connector[] = [
  { id: "gcal",    name: "Google Calendar", description: "Access your schedule and events",   iconName: "CalendarDays", connected: false, category: "Productivity", color: "#4285F4" },
  { id: "gmail",   name: "Gmail",           description: "Read and summarize your emails",    iconName: "Mail",         connected: false, category: "Productivity", color: "#EA4335" },
  { id: "notion",  name: "Notion",          description: "Search and update your docs",       iconName: "BookOpen",     connected: false, category: "Productivity", color: "#000000" },
  { id: "todoist", name: "Todoist",         description: "Manage your tasks and projects",    iconName: "CheckSquare",  connected: false, category: "Productivity", color: "#DB4035" },
  { id: "slack",   name: "Slack",           description: "Catch up on messages and channels", iconName: "Hash",         connected: false, category: "Communication", color: "#4A154B" },
  { id: "zoom",    name: "Zoom",            description: "Summarize meeting transcripts",     iconName: "Video",        connected: false, category: "Communication", color: "#2D8CFF" },
  { id: "github",  name: "GitHub",          description: "Review PRs, issues, and code",      iconName: "Code2",        connected: false, category: "Development",   color: "#24292E" },
  { id: "linear",  name: "Linear",          description: "Track engineering projects",        iconName: "Layers",       connected: false, category: "Development",   color: "#5E6AD2" },
  { id: "gdrive",  name: "Google Drive",    description: "Search and read your files",        iconName: "FolderOpen",   connected: false, category: "Files",         color: "#34A853" },
  { id: "spotify", name: "Spotify",         description: "Control music and get mood playlists", iconName: "Music",    connected: false, category: "Lifestyle",     color: "#1DB954" },
];

const DEFAULT_SKILLS: Skill[] = [
  { id: "morning",  name: "Morning Coach",      description: "Start your day with energy and clarity",       category: "Wellness",     emoji: "🌅", color: "#f59e0b", prompt: "You are a motivating morning coach. Help the user plan their day, set intentions, and start with energy." },
  { id: "meeting",  name: "Meeting Assistant",  description: "Prepare agendas and capture action items",     category: "Productivity", emoji: "📋", color: "#3b82f6", prompt: "You are a professional meeting assistant. Help structure meetings, create agendas, and track decisions." },
  { id: "learning", name: "Learning Buddy",     description: "Explain concepts and quiz your knowledge",     category: "Education",    emoji: "🧠", color: "#8b5cf6", prompt: "You are a patient tutor. Explain concepts clearly, use analogies, and ask questions to check understanding." },
  { id: "writing",  name: "Writing Assistant",  description: "Draft, edit, and refine your writing",         category: "Creative",     emoji: "✍️", color: "#10b981", prompt: "You are an expert writing assistant. Help draft, edit, and improve writing with clarity and style." },
  { id: "fitness",  name: "Fitness Coach",      description: "Plan workouts and track healthy habits",        category: "Health",       emoji: "💪", color: "#ef4444", prompt: "You are an encouraging fitness coach. Suggest workouts, track progress, and motivate healthy choices." },
  { id: "code",     name: "Code Reviewer",      description: "Review code, suggest improvements, debug",     category: "Tech",         emoji: "💻", color: "#6366f1", prompt: "You are a senior code reviewer. Review code for correctness, performance, readability, and security." },
];

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
  const [connectors, setConnectors]   = useState<Connector[]>(DEFAULT_CONNECTORS);
  const [skills]                      = useState<Skill[]>(DEFAULT_SKILLS);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [panelOpen, setPanelOpen]     = useState<"connectors" | "skills" | null>(null);
  const streamingRef = useRef(false);

  const messages = useMemo(
    () => threadMessages[activeThreadId] ?? [],
    [threadMessages, activeThreadId],
  );

  const isAIStreaming    = messages.some((m) => m.isStreaming);
  const activeSkill      = skills.find((s) => s.id === activeSkillId) ?? null;
  const connectedCount   = connectors.filter((c) => c.connected).length;

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

  /* ── AI response via backend LLM ──────────────────────────────────────── */
  const simulateAI = useCallback(
    async (threadId: string, userInput: string) => {
      if (streamingRef.current) return;
      streamingRef.current = true;

      const aiId = `ai-${Date.now()}`;

      appendMessage(threadId, {
        id: aiId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      try {
        // Build conversation history for context
        const history = (threadMessages[threadId] ?? [])
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: userInput });

        const response = await fetchAIResponse(history);

        // Stream character by character for a nice UX
        for (let i = 1; i <= response.length; i++) {
          patchMessage(threadId, aiId, { content: response.slice(0, i) });
          await sleep(8 + Math.random() * 12);
        }

        patchMessage(threadId, aiId, { isStreaming: false });
        bumpThread(threadId, response.replace(/\*\*/g, "").replace(/\*/g, ""));
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Something went wrong";
        patchMessage(threadId, aiId, {
          content: `⚠️ ${errorMsg}\n\nPlease make sure the backend server is running (\`python token_server.py\`).`,
          isStreaming: false,
        });
        bumpThread(threadId, "Error getting response");
      }

      streamingRef.current = false;
    },
    [appendMessage, patchMessage, bumpThread, threadMessages],
  );

  /* ── User actions ────────────────────────────────────────────────────── */
  const handleSend = useCallback(
    (content: string, pendingAttachments: Attachment[]) => {
      const msg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
        attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      };
      appendMessage(activeThreadId, msg);
      bumpThread(activeThreadId, content || `[${pendingAttachments.length} file(s)]`);
      setAttachments([]);
      const aiInput = [
        activeSkill ? `[Skill: ${activeSkill.name}] ` : "",
        content,
        pendingAttachments.length > 0 ? ` [Attached files: ${pendingAttachments.map((a) => a.name).join(", ")}]` : "",
      ].join("");
      simulateAI(activeThreadId, aiInput);
    },
    [activeThreadId, appendMessage, bumpThread, simulateAI, activeSkill],
  );

  const handleToggleConnector = useCallback((id: string) => {
    setConnectors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, connected: !c.connected } : c)),
    );
  }, []);

  const handleActivateSkill = useCallback((id: string) => {
    setActiveSkillId(id);
    setPanelOpen(null);
  }, []);

  const handleDeactivateSkill = useCallback(() => {
    setActiveSkillId(null);
  }, []);

  const handleAddAttachment = useCallback((file: File) => {
    const type: Attachment["type"] = (() => {
      if (file.type.startsWith("image/")) return "image";
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) return "pdf";
      if (file.name.match(/\.(csv)$/i)) return "csv";
      if (file.name.match(/\.(doc|docx)$/i)) return "doc";
      if (file.name.match(/\.(txt|md|json|ts|tsx|js|jsx|py)$/i)) return "text";
      return "other";
    })();
    setAttachments((prev) => [
      ...prev,
      { id: `att-${Date.now()}-${Math.random()}`, name: file.name, type, size: file.size },
    ]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

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
        activeSkill={activeSkill}
        connectedCount={connectedCount}
        attachments={attachments}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onSend={handleSend}
        onClearThread={handleClearThread}
        onOpenSkills={() => setPanelOpen("skills")}
        onOpenConnectors={() => setPanelOpen("connectors")}
        onDeactivateSkill={handleDeactivateSkill}
        onAddAttachment={handleAddAttachment}
        onRemoveAttachment={handleRemoveAttachment}
      />

      {panelOpen === "connectors" && (
        <ConnectorsPanel
          connectors={connectors}
          onToggle={handleToggleConnector}
          onClose={() => setPanelOpen(null)}
        />
      )}
      {panelOpen === "skills" && (
        <SkillsPanel
          skills={skills}
          activeSkillId={activeSkillId}
          onActivate={handleActivateSkill}
          onDeactivate={handleDeactivateSkill}
          onClose={() => setPanelOpen(null)}
        />
      )}
    </div>
  );
}
