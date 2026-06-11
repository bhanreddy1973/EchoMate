"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plug, Plus, X, Link, ToggleLeft, ToggleRight, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

export type ProviderType = "github" | "notion" | "slack" | "google" | "gmail" | "calendar" | "custom";

export interface ChatConnector {
  id: string;
  name: string;
  color: string;
  url: string;
  providerType: ProviderType;
  /** enabled = actively used as context in chat */
  enabled: boolean;
  /** authToken stored after successful validation */
  authToken?: string;
  connectedUser?: { name: string; email?: string; extra?: string; avatar?: string };
}

const PALETTE = ["#4285F4","#EA4335","#8b5cf6","#fbbf24","#e11d48","#10b981","#60a5fa","#fb923c"];

const PROVIDER_META: Record<ProviderType, { label: string; color: string; hint: string; tokenLabel: string; tokenPlaceholder: string; docsUrl?: string }> = {
  github:   { label: "GitHub",       color: "#8b5cf6", hint: "Personal Access Token",           tokenLabel: "Personal Access Token",      tokenPlaceholder: "ghp_xxxxxxxxxxxx",     docsUrl: "https://github.com/settings/tokens/new" },
  notion:   { label: "Notion",       color: "#fbbf24", hint: "Integration Token",               tokenLabel: "Integration Token",          tokenPlaceholder: "secret_xxxxxxxxxxxx",  docsUrl: "https://www.notion.so/my-integrations" },
  slack:    { label: "Slack",        color: "#e11d48", hint: "Bot / User OAuth Token",          tokenLabel: "Bot Token",                  tokenPlaceholder: "xoxb-xxxxxxxxxxxx",    docsUrl: "https://api.slack.com/apps" },
  google:   { label: "Google Drive", color: "#4285F4", hint: "OAuth 2.0 Access Token",          tokenLabel: "Access Token",               tokenPlaceholder: "ya29.xxxxxxxxxxxx",    docsUrl: "https://developers.google.com/oauthplayground" },
  gmail:    { label: "Gmail",        color: "#EA4335", hint: "OAuth 2.0 Access Token",          tokenLabel: "Access Token",               tokenPlaceholder: "ya29.xxxxxxxxxxxx",    docsUrl: "https://developers.google.com/oauthplayground" },
  calendar: { label: "Calendar",     color: "#10b981", hint: "OAuth 2.0 Access Token",          tokenLabel: "Access Token",               tokenPlaceholder: "ya29.xxxxxxxxxxxx",    docsUrl: "https://developers.google.com/oauthplayground" },
  custom:   { label: "Custom",       color: "#60a5fa", hint: "Bearer token (optional)",         tokenLabel: "Bearer Token (optional)",    tokenPlaceholder: "your-token" },
};

export const DEFAULT_CONNECTORS: ChatConnector[] = [
  { id: "google",   name: "Google Drive", color: "#4285F4", url: "drive.google.com",    providerType: "google",   enabled: false },
  { id: "gmail",    name: "Gmail",        color: "#EA4335", url: "mail.google.com",     providerType: "gmail",    enabled: false },
  { id: "github",   name: "GitHub",       color: "#8b5cf6", url: "github.com",          providerType: "github",   enabled: false },
  { id: "notion",   name: "Notion",       color: "#fbbf24", url: "notion.so",           providerType: "notion",   enabled: false },
  { id: "slack",    name: "Slack",        color: "#e11d48", url: "slack.com",           providerType: "slack",    enabled: false },
  { id: "calendar", name: "Calendar",     color: "#10b981", url: "calendar.google.com", providerType: "calendar", enabled: false },
];

type ConnectState = "idle" | "form" | "validating" | "connected" | "error";

interface ConnectStateMap { [id: string]: { state: ConnectState; token: string; error?: string } }

interface Props {
  connectors: ChatConnector[];
  onConnectorsChange: (connectors: ChatConnector[]) => void;
  onClose: () => void;
}

export default function ConnectorsPanel({ connectors, onConnectorsChange, onClose }: Props) {
  const { accentColor } = useEmotion();

  const [connectStates, setConnectStates] = useState<ConnectStateMap>({});
  const [addOpen, setAddOpen]             = useState(false);
  const [newName, setNewName]             = useState("");
  const [newUrl, setNewUrl]               = useState("");
  const [newColor, setNewColor]           = useState(PALETTE[6]);
  const [newProvider, setNewProvider]     = useState<ProviderType>("custom");

  const glassBorder = "1px solid rgba(255,255,255,0.09)";
  const activeCount = connectors.filter((c) => c.enabled && c.connectedUser).length;

  const setConnState = (id: string, patch: Partial<{ state: ConnectState; token: string; error?: string }>) => {
    setConnectStates((prev) => ({ ...prev, [id]: { ...{ state: "idle" as ConnectState, token: "" }, ...prev[id], ...patch } }));
  };

  const handleConnect = async (conn: ChatConnector) => {
    const cs = connectStates[conn.id];
    const token = cs?.token ?? "";

    setConnState(conn.id, { state: "validating" });

    try {
      const res  = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: conn.providerType, token: token || undefined, url: conn.url }),
      });
      const data = await res.json();

      if (!data.valid) {
        setConnState(conn.id, { state: "error", error: data.error ?? "Connection failed" });
        return;
      }

      /* Update connector with user info + store token */
      onConnectorsChange(connectors.map((c) =>
        c.id === conn.id ? { ...c, authToken: token || undefined, connectedUser: data.user, enabled: true } : c
      ));
      setConnState(conn.id, { state: "connected" });
    } catch (e) {
      setConnState(conn.id, { state: "error", error: e instanceof Error ? e.message : "Network error" });
    }
  };

  const handleDisconnect = (id: string) => {
    onConnectorsChange(connectors.map((c) =>
      c.id === id ? { ...c, authToken: undefined, connectedUser: undefined, enabled: false } : c
    ));
    setConnState(id, { state: "idle", token: "" });
  };

  const toggleEnabled = (id: string) => {
    onConnectorsChange(connectors.map((c) => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const addConnector = () => {
    const name = newName.trim();
    if (!name) return;
    onConnectorsChange([...connectors, {
      id: `cn-${Date.now()}`,
      name,
      color: newColor,
      url: newUrl.trim(),
      providerType: newProvider,
      enabled: false,
    }]);
    setNewName(""); setNewUrl(""); setAddOpen(false);
  };

  const removeConnector = (id: string) => onConnectorsChange(connectors.filter((c) => c.id !== id));

  return (
    <div className="w-full h-full flex flex-col pt-2 pb-6 px-4 overflow-y-auto"
      style={{ backdropFilter: "blur(40px)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Plug size={14} style={{ color: accentColor }} />
          <h3 className="text-[13px] font-semibold text-text-primary">Connectors</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: `${accentColor}20`, color: accentColor }}>{activeCount} active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setAddOpen((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor }}>
            {addOpen ? <ChevronUp size={11} /> : <Plus size={11} />}
          </button>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors">
            <X size={11} className="text-text-muted" />
          </button>
        </div>
      </div>

      {/* Add connector form */}
      <AnimatePresence>
        {addOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden shrink-0 mb-3">
            <div className="p-3 rounded-xl flex flex-col gap-2.5"
              style={{ background: "rgba(255,255,255,0.04)", border: glassBorder }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">New Connector</p>

              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Service name  (e.g. Jira)"
                className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />

              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                placeholder="URL / endpoint  (optional)"
                className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />

              <select value={newProvider} onChange={(e) => setNewProvider(e.target.value as ProviderType)}
                className="w-full text-[12px] text-text-secondary outline-none px-2.5 py-1.5 rounded-lg appearance-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {(Object.keys(PROVIDER_META) as ProviderType[]).map((p) => (
                  <option key={p} value={p} style={{ background: "#1a1a2e" }}>{PROVIDER_META[p].label}</option>
                ))}
              </select>

              <div>
                <p className="text-[10px] text-text-muted mb-1.5">Colour</p>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className="w-5 h-5 rounded-full transition-all"
                      style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
                  ))}
                </div>
              </div>

              <button onClick={addConnector} disabled={!newName.trim()}
                className="w-full py-1.5 rounded-lg text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
                style={{ background: accentColor }}>
                Add Connector
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connector list */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {connectors.map((conn) => {
          const cs   = connectStates[conn.id] ?? { state: "idle", token: "" };
          const meta = PROVIDER_META[conn.providerType];
          const isConnected = !!conn.connectedUser;
          const showForm = cs.state === "form" || cs.state === "error";

          return (
            <motion.div key={conn.id} layout
              className="group rounded-xl overflow-hidden transition-colors"
              style={{ background: "rgba(255,255,255,0.02)", border: isConnected ? `1px solid ${conn.color}30` : glassBorder }}>

              {/* Main row */}
              <div className="flex items-center gap-2.5 p-2.5">
                {/* Icon */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: `${conn.color}18`, border: `1px solid ${conn.color}28` }}>
                  {conn.url ? (
                    <img src={`https://www.google.com/s2/favicons?domain=${conn.url}&sz=16`} alt=""
                      width={14} height={14}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <Link size={12} style={{ color: conn.color }} strokeWidth={2} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-medium text-text-primary">{conn.name}</p>
                    {isConnected && (
                      <CheckCircle2 size={10} style={{ color: conn.color }} />
                    )}
                  </div>
                  {isConnected && conn.connectedUser ? (
                    <p className="text-[10px] truncate" style={{ color: conn.color, opacity: 0.8 }}>
                      {conn.connectedUser.name}{conn.connectedUser.extra ? ` · ${conn.connectedUser.extra}` : ""}
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-muted truncate">{meta.hint}</p>
                  )}
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isConnected ? (
                    <button onClick={() => toggleEnabled(conn.id)} aria-label={conn.enabled ? "Disable" : "Enable"}>
                      {conn.enabled
                        ? <ToggleRight size={20} style={{ color: accentColor }} />
                        : <ToggleLeft  size={20} style={{ color: "rgba(255,255,255,0.25)" }} />}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConnState(conn.id, { state: showForm ? "idle" : "form" })}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all"
                      style={{ background: `${conn.color}18`, color: conn.color, border: `1px solid ${conn.color}28` }}>
                      {showForm ? "Cancel" : "Connect"}
                    </button>
                  )}

                  {isConnected && (
                    <button onClick={() => handleDisconnect(conn.id)}
                      className="text-[10px] px-2 py-1 rounded-lg transition-all hover:bg-red-500/10"
                      style={{ color: "rgba(255,255,255,0.3)" }}>
                      <X size={10} />
                    </button>
                  )}

                  {!isConnected && (
                    <button onClick={() => removeConnector(conn.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} className="text-text-ghost" />
                    </button>
                  )}
                </div>
              </div>

              {/* Connect form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mx-2.5 mb-2.5 p-2.5 rounded-lg flex flex-col gap-2"
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>

                      {/* Token input */}
                      <label className="text-[10px] text-text-muted">{meta.tokenLabel}</label>
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          value={cs.token}
                          onChange={(e) => setConnState(conn.id, { token: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && handleConnect(conn)}
                          placeholder={meta.tokenPlaceholder}
                          className="flex-1 bg-transparent text-[11.5px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg font-mono"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />
                        <button
                          onClick={() => handleConnect(conn)}
                          disabled={cs.state === "validating"}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white disabled:opacity-60 flex items-center gap-1"
                          style={{ background: conn.color }}>
                          {cs.state === "validating" ? <Loader2 size={11} className="animate-spin" /> : "Test & Connect"}
                        </button>
                      </div>

                      {/* Error */}
                      {cs.state === "error" && cs.error && (
                        <div className="flex items-center gap-1.5 text-[10.5px] text-red-400">
                          <AlertCircle size={11} />
                          {cs.error}
                        </div>
                      )}

                      {/* Docs link */}
                      {meta.docsUrl && (
                        <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] transition-colors hover:underline"
                          style={{ color: conn.color, opacity: 0.7 }}>
                          <ExternalLink size={9} />
                          Get your {meta.tokenLabel.toLowerCase()}
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Validating state inside card */}
                {cs.state === "validating" && !showForm && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-2.5 pb-2.5 text-[10.5px]"
                    style={{ color: conn.color }}>
                    <Loader2 size={11} className="animate-spin" />
                    Validating…
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
