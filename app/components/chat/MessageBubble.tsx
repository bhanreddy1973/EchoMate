"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, RotateCcw, Sparkles } from "lucide-react";
import { ChatMessage } from "@/store/chatStore";
import { useEmotion } from "@/context/EmotionContext";
import MarkdownRenderer from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

function MessageBubbleInner({ message, isLatest }: MessageBubbleProps) {
  const { accentColor, glowColor } = useEmotion();
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div
          className="max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-md relative group"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            boxShadow: `0 4px 20px -4px ${glowColor}`,
          }}
        >
          <p className="text-[13.5px] leading-relaxed text-white font-[420]">
            {message.content}
          </p>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.attachments.map((file, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/20 text-white/80"
                >
                  📎 {file.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      className="flex justify-start gap-3"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 250, delay: 0.05 }}
    >
      {/* Avatar */}
      <motion.div
        className="w-7 h-7 rounded-full shrink-0 mt-1 flex items-center justify-center relative"
        style={{
          background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}15)`,
          border: `1px solid ${accentColor}30`,
          boxShadow: `0 0 12px ${glowColor}`,
        }}
        animate={{
          boxShadow: isLatest
            ? [
                `0 0 12px ${glowColor}`,
                `0 0 20px ${glowColor}`,
                `0 0 12px ${glowColor}`,
              ]
            : `0 0 12px ${glowColor}`,
        }}
        transition={{ duration: 2, repeat: isLatest ? Infinity : 0, ease: "easeInOut" }}
      >
        <Sparkles size={11} style={{ color: accentColor }} />
      </motion.div>

      {/* Message content */}
      <div
        className="max-w-[80%] relative group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="px-5 py-4 rounded-2xl rounded-tl-md relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px) saturate(150%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 12px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Specular highlight */}
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
            }}
          />
          
          {/* Content */}
          <div className="relative">
            <MarkdownRenderer
              content={message.content}
              className="text-[13.5px] leading-[1.75] text-white/85"
            />
          </div>
        </div>

        {/* Action buttons */}
        <motion.div
          className="absolute -bottom-8 left-0 flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all">
            <RotateCcw size={10} />
            <span>Regenerate</span>
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleInner);
export default MessageBubble;
