"use client";

import { motion } from "framer-motion";
import {
  PanelLeft,
  PanelRight,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useEmotion } from "@/context/EmotionContext";

interface ChatHeaderProps {
  onSpatialView?: () => void;
}

export default function ChatHeader({ onSpatialView }: ChatHeaderProps) {
  const { sidebarOpen, rightSidebarOpen, toggleSidebar, toggleRightSidebar, getActiveConversation } = useChatStore();
  const { accentColor, glowColor, emotion } = useEmotion();
  const conversation = getActiveConversation();

  return (
    <motion.header
      className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.05]"
      style={{
        background: "rgba(4,4,10,0.6)",
        backdropFilter: "blur(20px)",
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Left: Toggle sidebar + title */}
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
            aria-label="Open sidebar"
          >
            <PanelLeft size={16} className="text-white/50" />
          </motion.button>
        )}

        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: accentColor }}
            animate={{
              scale: emotion === "thinking" ? [1, 1.3, 1] : 1,
              opacity: emotion === "idle" ? 0.5 : 1,
            }}
            transition={{ duration: 1, repeat: emotion === "thinking" ? Infinity : 0 }}
          />
          <h1 className="text-[13px] font-medium text-white/70 truncate max-w-[200px]">
            {conversation?.title || "EchoMate"}
          </h1>
        </div>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-2">
        <motion.div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
          style={{
            background: `${accentColor}12`,
            border: `1px solid ${accentColor}20`,
            color: accentColor,
          }}
          animate={{
            boxShadow: emotion !== "idle"
              ? [`0 0 8px ${glowColor}`, `0 0 16px ${glowColor}`, `0 0 8px ${glowColor}`]
              : "none",
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles size={9} />
          <span className="capitalize">{emotion}</span>
        </motion.div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {onSpatialView && (
          <button
            onClick={onSpatialView}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            <LayoutGrid size={13} />
            <span>Spatial</span>
          </button>
        )}
        {!rightSidebarOpen && (
          <motion.button
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={toggleRightSidebar}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
            aria-label="Open dashboard"
          >
            <PanelRight size={16} className="text-white/50" />
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
