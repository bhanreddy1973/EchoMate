"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Trash2, ChevronLeft, MessageSquare, Mic, Clock, RefreshCw } from "lucide-react";
import GlassPanel from "./GlassPanel";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  source: "voice" | "chat";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ConversationFull extends ConversationSummary {
  messages: ConversationMessage[];
}

export default function HistoryPanel({ onClose }: { onClose: () => void }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "chat" | "voice">("all");

  const filteredConversations = filter === "all"
    ? conversations
    : conversations.filter((c) => c.source === filter);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError("Could not load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const openConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data: ConversationFull = await res.json();
      setSelectedConv(data);
    } catch {
      setError("Could not load conversation");
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedConv?.id === id) setSelectedConv(null);
    } catch {
      setError("Could not delete conversation");
    }
  };

  const formatTime = (iso: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <GlassPanel className="flex flex-col h-full min-h-0" noPad>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
          {selectedConv ? (
            <button
              onClick={() => setSelectedConv(null)}
              className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <History size={14} className="text-cyan-400" />
              <h3 className="text-[13px] font-semibold text-text-primary">History</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400">
                {conversations.length}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {!selectedConv && (
              <button
                onClick={fetchConversations}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw size={11} className="text-text-muted" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-[11px] px-2 py-1 rounded-md hover:bg-white/10 text-text-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        {!selectedConv && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 shrink-0">
            {(["all", "chat", "voice"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all capitalize"
                style={filter === tab ? {
                  background: "rgba(6,182,212,0.15)",
                  color: "#06b6d4",
                  border: "1px solid rgba(6,182,212,0.3)",
                } : {
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid transparent",
                }}
              >
                {tab === "all" ? "All" : tab === "chat" ? "💬 Chat" : "🎤 Voice"}
              </button>
            ))}
            <span className="ml-auto text-[9px] text-text-ghost">
              {filteredConversations.length} conversation{filteredConversations.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3">
          <AnimatePresence mode="wait">
            {loading && !selectedConv ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-12"
              >
                <div className="flex items-center gap-2 text-text-muted text-[12px]">
                  <RefreshCw size={12} className="animate-spin" />
                  Loading history…
                </div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12 text-[12px] text-red-400/80"
              >
                {error}
              </motion.div>
            ) : selectedConv ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {/* Conversation header */}
                <div className="mb-4">
                  <h4 className="text-[13px] font-medium text-text-primary leading-snug">
                    {selectedConv.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Clock size={9} />
                      {formatTime(selectedConv.createdAt)}
                    </span>
                    <span className="text-[10px]">
                      {selectedConv.source === "voice" ? "🎤" : "💬"}
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-2.5">
                  {selectedConv.messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className="max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed"
                        style={
                          msg.role === "user"
                            ? {
                                background: "rgba(96, 165, 250, 0.8)",
                                color: "#fff",
                              }
                            : {
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: "rgba(255,255,255,0.85)",
                              }
                        }
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : filteredConversations.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <History size={28} className="text-text-ghost mb-3" />
                <p className="text-[12px] text-text-muted">No conversations yet</p>
                <p className="text-[10px] text-text-ghost mt-1">
                  Your chat history will appear here
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {filteredConversations.map((conv, i) => (
                  <motion.button
                    key={conv.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => openConversation(conv.id)}
                    className="w-full text-left group p-3 rounded-xl transition-all hover:bg-white/[0.04]"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-text-primary truncate">
                          {conv.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-text-muted flex items-center gap-1">
                            <Clock size={9} />
                            {formatTime(conv.updatedAt)}
                          </span>
                          <span className="text-[10px] text-text-ghost flex items-center gap-1">
                            {conv.source === "voice" ? (
                              <>
                                <Mic size={9} />
                                🎤
                              </>
                            ) : (
                              <>
                                <MessageSquare size={9} />
                                💬
                              </>
                            )}
                          </span>
                          <span className="text-[10px] text-text-ghost">
                            {conv.messageCount} msg{conv.messageCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-500/10"
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={11} className="text-red-400/70" />
                      </button>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassPanel>
  );
}
