"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Mic,
  MicOff,
  X,
  FileText,
  Image as ImageIcon,
  Zap,
  ArrowUp,
} from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accentColor, glowColor } = useEmotion();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput("");
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, disabled, onSend, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = input.trim().length > 0 && !disabled;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {/* Attached files */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 flex-wrap mb-2 overflow-hidden"
          >
            {attachedFiles.map((file, i) => (
              <motion.div
                key={`${file.name}-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {file.type.startsWith("image/") ? (
                  <ImageIcon size={11} className="text-white/50" />
                ) : (
                  <FileText size={11} className="text-white/50" />
                )}
                <span className="text-white/60 max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X size={9} className="text-white/40" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input container */}
      <motion.div
        className="relative rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(40px) saturate(180%)",
          border: isFocused
            ? `1px solid ${accentColor}40`
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: isFocused
            ? `0 0 30px -8px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : "0 4px 12px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        animate={{
          boxShadow: isFocused
            ? `0 0 30px -8px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : "0 4px 12px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Specular top highlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 30%)",
            borderRadius: "inherit",
          }}
        />

        {/* Textarea */}
        <div className="relative flex items-end gap-2 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || (disabled ? "EchoMate is thinking..." : "Message EchoMate...")}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-[14px] text-white/90 placeholder:text-white/25 outline-none resize-none leading-relaxed py-1 disabled:opacity-50"
            style={{ maxHeight: "160px" }}
            aria-label="Message input"
          />
        </div>

        {/* Bottom toolbar */}
        <div className="relative flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-white/35 hover:text-white/60 hover:bg-white/[0.06] transition-all"
              aria-label="Attach file"
            >
              <Paperclip size={15} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg text-white/35 hover:text-white/60 hover:bg-white/[0.06] transition-all"
              aria-label="Voice input"
            >
              <Mic size={15} />
            </motion.button>
          </div>

          {/* Send button */}
          <motion.button
            onClick={handleSend}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.92 } : {}}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: canSend ? accentColor : "rgba(255,255,255,0.06)",
              boxShadow: canSend ? `0 0 16px -2px ${glowColor}` : "none",
            }}
            aria-label="Send message"
          >
            <ArrowUp size={15} className="text-white" strokeWidth={2.5} />
          </motion.button>
        </div>
      </motion.div>

      {/* Subtle hint */}
      <p className="text-center text-[10px] text-white/20 mt-2">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
