"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MessageSquare,
  CheckCircle2,
  Brain,
  BookOpen,
  Settings,
  Trash2,
  PanelLeftClose,
  Search,
  Sparkles,
  Pin,
} from "lucide-react";
import { useChatStore, Conversation } from "@/store/chatStore";
import { useEmotion } from "@/context/EmotionContext";
import { groupConversationsByDate, formatRelativeDate } from "@/lib/utils";

export default function LeftSidebar() {
  const {
    conversations,
    activeConversationId,
    sidebarOpen,
    createConversation,
    setActiveConversation,
    deleteConversation,
    toggleSidebar,
  } = useChatStore();
  const { accentColor, glowColor } = useEmotion();
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const groups = groupConversationsByDate(filteredConversations);

  const handleNewChat = () => {
    createConversation();
  };

  const quickNav = [
    { id: "tasks", label: "Today's Tasks", icon: CheckCircle2, color: "#10b981" },
    { id: "memory", label: "Memory Vault", icon: Brain, color: "#8b5cf6" },
    { id: "journal", label: "Journal", icon: BookOpen, color: "#f59e0b" },
    { id: "settings", label: "Settings", icon: Settings, color: "rgba(255,255,255,0.4)" },
  ];

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="h-full flex flex-col overflow-hidden border-r border-white/[0.06] shrink-0"
          style={{
            background: "rgba(7,7,16,0.92)",
            backdropFilter: "blur(40px) saturate(180%)",
          }}
        >
          <div className="flex flex-col h-full w-[280px] min-w-[280px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2.5">
                <motion.div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}80)`,
                    boxShadow: `0 0 16px ${glowColor}`,
                  }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles size={12} className="text-white" />
                </motion.div>
                <span className="text-[13px] font-semibold text-white/90">EchoMate</span>
              </div>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                aria-label="Close sidebar"
              >
                <PanelLeftClose size={15} className="text-white/40" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="px-3 pt-2 pb-3">
              <motion.button
                onClick={handleNewChat}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`,
                  border: `1px solid ${accentColor}30`,
                  color: accentColor,
                }}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>New Conversation</span>
              </motion.button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Search size={13} className="text-white/30 shrink-0" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/25 outline-none"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((conv, i) => (
                      <motion.button
                        key={conv.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => setActiveConversation(conv.id)}
                        onMouseEnter={() => setHoveredId(conv.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="w-full group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200"
                        style={{
                          background:
                            activeConversationId === conv.id
                              ? `${accentColor}12`
                              : hoveredId === conv.id
                              ? "rgba(255,255,255,0.04)"
                              : "transparent",
                          border:
                            activeConversationId === conv.id
                              ? `1px solid ${accentColor}25`
                              : "1px solid transparent",
                        }}
                      >
                        <MessageSquare
                          size={13}
                          className="shrink-0 transition-colors"
                          style={{
                            color:
                              activeConversationId === conv.id
                                ? accentColor
                                : "rgba(255,255,255,0.3)",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[12.5px] truncate transition-colors"
                            style={{
                              color:
                                activeConversationId === conv.id
                                  ? "rgba(255,255,255,0.9)"
                                  : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {conv.title}
                          </p>
                          <p className="text-[10px] text-white/25 mt-0.5">
                            {formatRelativeDate(conv.updatedAt)}
                          </p>
                        </div>
                        {/* Delete button on hover */}
                        <AnimatePresence>
                          {hoveredId === conv.id && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="p-1 rounded-md hover:bg-red-500/20 transition-colors"
                              aria-label="Delete conversation"
                            >
                              <Trash2 size={11} className="text-white/30 hover:text-red-400" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}

              {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.04] mb-3">
                    <MessageSquare size={16} className="text-white/20" />
                  </div>
                  <p className="text-[12px] text-white/30 text-center">
                    No conversations yet.
                    <br />
                    Start a new one above.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Navigation */}
            <div className="border-t border-white/[0.06] px-3 py-3 space-y-0.5">
              {quickNav.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
                >
                  <item.icon size={13} style={{ color: item.color }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
