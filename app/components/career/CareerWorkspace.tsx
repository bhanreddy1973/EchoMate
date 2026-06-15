"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, FileText, BarChart3, Code2, Users, ClipboardEdit,
  Plug, Wrench, Settings, X, ClipboardList, History,
  ToggleLeft, ToggleRight, Check, Eye, EyeOff, ExternalLink,
  GitBranch, Globe, Search, Zap,
} from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCareerStore } from "@/store/careerStore";
import JDInputPanel from "./JDInputPanel";
import FitAnalysisPanel from "./FitAnalysisPanel";
import ResumeEditorPanel from "./ResumeEditorPanel";
import NetworkPanel from "./NetworkPanel";
import ResumeDataForm from "./ResumeDataForm";
import TrackerPanel from "./TrackerPanel";
import ResumeHistoryPanel from "./HistoryPanel";

const LAYOUT_KEY = "echomate:career-layout";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const CONNECTOR_META: Record<string, {
  icon: React.ElementType;
  color: string;
  free: string;
  docsUrl: string;
  fields: { key: string; label: string; placeholder: string; isSecret: boolean }[];
}> = {
  "custom": {
    icon: GitBranch,
    color: "#e6edf3",
    free: "Free · no key needed",
    docsUrl: "https://docs.github.com/en/rest",
    fields: [],
  },
  "google-cse": {
    icon: Search,
    color: "#4285F4",
    free: "100 free/day",
    docsUrl: "https://programmablesearchengine.google.com",
    fields: [
      { key: "apiKey",  label: "API Key",          placeholder: "AIza...",      isSecret: true  },
      { key: "cseId",   label: "Search Engine ID",  placeholder: "a1b2c3:xyz",  isSecret: false },
    ],
  },
  "perplexity": {
    icon: Zap,
    color: "#20b2aa",
    free: "1 000 free/month",
    docsUrl: "https://app.tavily.com",
    fields: [
      { key: "apiKey", label: "Tavily API Key", placeholder: "tvly-...", isSecret: true },
    ],
  },
  "serpapi": {
    icon: Globe,
    color: "#f59e0b",
    free: "100 free/month",
    docsUrl: "https://serpapi.com",
    fields: [
      { key: "apiKey", label: "SerpAPI Key", placeholder: "your_key", isSecret: true },
    ],
  },
};

export default function CareerWorkspace() {
  const { accentColor } = useEmotion();
  const { activePanel, setActivePanel, generatedLatex } = useCareerStore();

  const [leftWidth, setLeftWidth] = useState(30);
  const [isDraggingL, setIsDraggingL] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
      if (saved.leftWidth) setLeftWidth(clamp(saved.leftWidth, 20, 50));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ leftWidth })); } catch { /* ignore */ }
  }, [leftWidth]);

  const handleLeftDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingL(true);
    const move = (ev: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setLeftWidth(clamp(((ev.clientX - rect.left) / rect.width) * 100, 20, 50));
    };
    const up = () => {
      setIsDraggingL(false);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }, []);

  const panelTabs = [
    { id: "jd"       as const, label: "Job Description", icon: FileText      },
    { id: "analysis" as const, label: "Fit Analysis",    icon: BarChart3     },
    { id: "resume"   as const, label: "Resume",          icon: Code2         },
    { id: "tracker"  as const, label: "Tracker",         icon: ClipboardList },
    { id: "history"  as const, label: "History",         icon: History       },
    { id: "network"  as const, label: "Network",         icon: Users         },
    { id: "form"     as const, label: "My Resume",       icon: ClipboardEdit },
  ];

  // Network tab = full-width, no split layout needed
  const isNetworkFull = activePanel === "network";

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col pt-16 pb-2 px-3 gap-2 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-2 shrink-0">
        <Briefcase size={14} style={{ color: accentColor }} />
        <span className="text-[13px] font-semibold text-text-primary">Career</span>

        <div className="flex items-center gap-1 ml-4 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {panelTabs.map(({ id, label, icon: Icon }) => {
            const active = activePanel === id;
            return (
              <button key={id} onClick={() => setActivePanel(id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={active
                  ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }
                  : { color: "rgba(255,255,255,0.4)" }}>
                <Icon size={10} />
                <span className="hidden lg:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <button onClick={() => setShowTools(!showTools)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
          style={showTools
            ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }
            : { color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Settings size={10} />
          <span>Tools & Connectors</span>
        </button>
      </div>

      {/* Main content */}
      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden rounded-xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Left panel — hidden on network full view */}
        {!isNetworkFull && (
          <>
            <div className="h-full overflow-hidden" style={{ width: `${leftWidth}%` }}>
              <JDInputPanel />
            </div>

            {/* Drag handle */}
            <div className="w-[6px] h-full cursor-col-resize shrink-0 flex items-center justify-center"
              style={{ background: isDraggingL ? `${accentColor}15` : "transparent" }}
              onPointerDown={handleLeftDrag}>
              <div className="w-[2px] h-8 rounded-full transition-colors"
                style={{ background: isDraggingL ? accentColor : "rgba(255,255,255,0.10)" }} />
            </div>
          </>
        )}

        {/* Center / full panel */}
        <div className="flex-1 h-full overflow-hidden">
          <AnimatePresence mode="wait">
            {activePanel === "jd" && !generatedLatex && (
              <motion.div key="analysis" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FitAnalysisPanel />
              </motion.div>
            )}
            {activePanel === "jd" && generatedLatex && (
              <motion.div key="resume-auto" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResumeEditorPanel />
              </motion.div>
            )}
            {activePanel === "analysis" && (
              <motion.div key="analysis2" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FitAnalysisPanel />
              </motion.div>
            )}
            {activePanel === "resume" && (
              <motion.div key="resume" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResumeEditorPanel />
              </motion.div>
            )}
            {activePanel === "network" && (
              <motion.div key="network" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <NetworkPanel />
              </motion.div>
            )}
            {activePanel === "tracker" && (
              <motion.div key="tracker" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TrackerPanel />
              </motion.div>
            )}
            {activePanel === "history" && (
              <motion.div key="history" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResumeHistoryPanel />
              </motion.div>
            )}
            {activePanel === "form" && (
              <motion.div key="form" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResumeDataForm />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tools & Connectors drawer */}
      <AnimatePresence>
        {showTools && <ToolsDrawer accentColor={accentColor} onClose={() => setShowTools(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tools & Connectors Drawer ───────────────────────────────────────────────

function ToolsDrawer({ accentColor, onClose }: { accentColor: string; onClose: () => void }) {
  const { connectors, mcpTools, toggleConnector, setConnectorApiKey, setConnectorExtraConfig, toggleMCPTool } = useCareerStore();

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-16 bottom-0 w-[360px] z-50 flex flex-col"
      style={{ background: "rgba(10,10,20,0.97)", backdropFilter: "blur(40px)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25` }}>
            <Settings size={13} style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text-primary">Tools & Connectors</p>
            <p className="text-[10px] text-text-muted">Configure search sources & AI tools</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <X size={12} className="text-text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

        {/* Search Connectors */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Plug size={11} style={{ color: accentColor }} />
            <span className="text-[11px] font-semibold text-text-primary">Search Connectors</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: `${accentColor}15`, color: accentColor }}>
              {connectors.filter(c => c.enabled).length} / {connectors.length} active
            </span>
          </div>
          <div className="space-y-2">
            {connectors.map((conn) => (
              <ConnectorCard
                key={conn.id}
                connector={conn}
                accentColor={accentColor}
                onToggle={() => toggleConnector(conn.id)}
                onSaveKey={(key) => setConnectorApiKey(conn.id, key)}
                onSaveExtra={(config) => setConnectorExtraConfig(conn.id, config)}
              />
            ))}
          </div>
        </section>

        {/* AI Tools */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={11} style={{ color: accentColor }} />
            <span className="text-[11px] font-semibold text-text-primary">AI Tools</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: `${accentColor}15`, color: accentColor }}>
              {mcpTools.filter(t => t.enabled).length} / {mcpTools.length} active
            </span>
          </div>
          <div className="space-y-1.5">
            {mcpTools.map((tool) => (
              <div key={tool.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: tool.enabled ? `${accentColor}07` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${tool.enabled ? `${accentColor}20` : "rgba(255,255,255,0.06)"}`,
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: tool.enabled ? `${accentColor}15` : "rgba(255,255,255,0.04)" }}>
                  <Wrench size={11} style={{ color: tool.enabled ? accentColor : "rgba(255,255,255,0.25)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-text-primary">{tool.name}</p>
                  <p className="text-[9px] text-text-muted truncate">{tool.description}</p>
                </div>
                <button onClick={() => toggleMCPTool(tool.id)} className="shrink-0">
                  {tool.enabled
                    ? <ToggleRight size={22} style={{ color: accentColor }} />
                    : <ToggleLeft size={22} style={{ color: "rgba(255,255,255,0.2)" }} />}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Storage note */}
        <div className="px-3 py-2.5 rounded-xl text-[10px] text-text-muted leading-relaxed"
          style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}>
          <span className="text-emerald-400 font-medium">Keys are saved locally</span> in your browser and sent to the server only when searching. They are never stored on any external server.
        </div>
      </div>
    </motion.div>
  );
}

// ─── Connector Card ──────────────────────────────────────────────────────────

function ConnectorCard({ connector, accentColor, onToggle, onSaveKey, onSaveExtra }: {
  connector: { id: string; name: string; type: string; apiKey?: string; extraConfig?: Record<string, string>; enabled: boolean; status: string; description: string };
  accentColor: string;
  onToggle: () => void;
  onSaveKey: (key: string) => void;
  onSaveExtra: (config: Record<string, string>) => void;
}) {
  const meta = CONNECTOR_META[connector.type] || CONNECTOR_META["serpapi"];
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of meta.fields) {
      init[f.key] = f.key === "apiKey"
        ? (connector.apiKey || "")
        : (connector.extraConfig?.[f.key] || "");
    }
    return init;
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const isGitHub = connector.type === "custom";
  const isConnected = connector.enabled && connector.status === "connected";

  const handleSave = () => {
    for (const f of meta.fields) {
      if (f.key === "apiKey") {
        onSaveKey(fieldValues["apiKey"] || "");
      } else {
        onSaveExtra({ [f.key]: fieldValues[f.key] || "" });
      }
    }
    if (!connector.enabled) onToggle();
    setSaved(true);
    setTimeout(() => { setSaved(false); setExpanded(false); }, 1500);
  };

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{
        background: isConnected ? `${meta.color}08` : "rgba(255,255,255,0.02)",
        border: `1px solid ${isConnected ? `${meta.color}25` : "rgba(255,255,255,0.07)"}`,
      }}>
      {/* Row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: isConnected ? `${meta.color}15` : "rgba(255,255,255,0.04)" }}>
          <Icon size={14} style={{ color: isConnected ? meta.color : "rgba(255,255,255,0.3)" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-primary">{connector.name}</span>
            {isConnected && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>
                Connected
              </span>
            )}
          </div>
          <span className="text-[9px]" style={{ color: meta.color + "aa" }}>{meta.free}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* GitHub just has a toggle */}
          {isGitHub ? (
            <button onClick={onToggle} className="shrink-0">
              {connector.enabled
                ? <ToggleRight size={22} style={{ color: meta.color }} />
                : <ToggleLeft size={22} style={{ color: "rgba(255,255,255,0.2)" }} />}
            </button>
          ) : (
            <>
              <button onClick={() => setExpanded(!expanded)}
                className="text-[9px] px-2 py-1 rounded-lg transition-all"
                style={{
                  color: expanded ? accentColor : "rgba(255,255,255,0.5)",
                  background: expanded ? `${accentColor}12` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${expanded ? `${accentColor}25` : "rgba(255,255,255,0.08)"}`,
                }}>
                {expanded ? "Hide" : "Setup"}
              </button>
              {connector.enabled && (
                <button onClick={onToggle}
                  className="text-[9px] px-2 py-1 rounded-lg"
                  style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)" }}>
                  Disable
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded config */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/5">
              {/* Docs link */}
              <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] w-fit"
                style={{ color: meta.color }}>
                <ExternalLink size={9} /> Get {connector.name} API key
              </a>

              {/* Fields */}
              {meta.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-[9px] text-text-muted mb-1">{field.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type={field.isSecret && !showSecrets[field.key] ? "password" : "text"}
                      value={fieldValues[field.key] || ""}
                      onChange={(e) => setFieldValues(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="flex-1 text-[10px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg font-mono"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                    />
                    {field.isSecret && (
                      <button onClick={() => setShowSecrets(p => ({ ...p, [field.key]: !p[field.key] }))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8"
                        style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                        {showSecrets[field.key] ? <EyeOff size={11} className="text-text-muted" /> : <Eye size={11} className="text-text-muted" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Save */}
              <button onClick={handleSave}
                className="w-full py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={saved
                  ? { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                  : { background: accentColor, color: "#fff" }}>
                {saved ? <><Check size={11} /> Saved!</> : "Save & Enable"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
