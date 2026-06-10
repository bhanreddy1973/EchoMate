import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, ArrowUp, Square } from "lucide-react";
import clsx from "clsx";
import { AgentStatus, ConnectionState } from "../types";
import VoiceOrb from "./VoiceOrb";

interface ComposerProps {
  agentStatus: AgentStatus;
  connectionState: ConnectionState;
  isAIStreaming: boolean;
  onSend: (text: string) => void;
}

export default function Composer({
  agentStatus,
  connectionState,
  isAIStreaming,
  onSend,
}: ComposerProps) {
  const [text, setText]             = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);

  const isConnected = connectionState === "connected";
  const hasText     = text.trim().length > 0;
  const isActive    = agentStatus !== "idle";
  const canSend     = hasText && !isAIStreaming;

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isAIStreaming) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /* Dynamic placeholder */
  const placeholder = (() => {
    if (isAIStreaming) return "EchoMate is responding…";
    if (isConnected && micEnabled) {
      if (agentStatus === "listening") return "Listening… or type a message";
      if (agentStatus === "thinking")  return "Thinking…";
      if (agentStatus === "speaking")  return "Speaking…";
    }
    return "Type a message";
  })();

  return (
    <div className="px-4 pb-6 pt-2">
      <div className="max-w-2xl mx-auto space-y-2">

        {/* Agent voice status strip */}
        {isConnected && isActive && !hasText && !isAIStreaming && (
          <div className="flex items-center justify-center gap-2.5 animate-[fade-up_0.2s_ease]">
            <VoiceOrb status={agentStatus} size="sm" />
            <span className="text-[12px] text-text-secondary">
              {agentStatus === "listening" ? "Listening…"
               : agentStatus === "thinking" ? "Thinking…"
               : "Speaking…"}
            </span>
          </div>
        )}

        {/* Input pill */}
        <div
          className={clsx(
            "flex items-end gap-2 rounded-2xl border p-2 bg-surface-tertiary composer-shadow transition-colors duration-200",
            canSend
              ? "border-accent-blue/30"
              : "border-border-primary focus-within:border-accent-blue/20",
          )}
        >
          {/* Mic toggle */}
          <button
            type="button"
            onClick={() => setMicEnabled((v) => !v)}
            className={clsx(
              "shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150",
              micEnabled && isConnected
                ? "bg-accent-blue/12 text-accent-blue hover:bg-accent-blue/20"
                : "text-text-muted hover:text-text-secondary hover:bg-surface-hover",
            )}
            aria-label={micEnabled ? "Disable microphone" : "Enable microphone"}
          >
            {micEnabled ? <Mic size={16} strokeWidth={2} /> : <MicOff size={16} strokeWidth={2} />}
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isAIStreaming}
            rows={1}
            className="
              flex-1 resize-none bg-transparent
              text-[13.5px] text-text-primary placeholder:text-text-muted
              outline-none py-2.5 leading-relaxed
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            style={{ maxHeight: 140 }}
          />

          {/* Right action — swaps between Send / Stop / Ghost */}
          {hasText ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isAIStreaming}
              className={clsx(
                "shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 animate-[scale-in_0.14s_ease]",
                isAIStreaming
                  ? "bg-accent-blue/30 text-white/50 cursor-not-allowed"
                  : "bg-accent-blue text-white hover:bg-accent-blue/85 active:scale-[0.92]",
              )}
              aria-label="Send"
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          ) : agentStatus === "speaking" ? (
            <button
              type="button"
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors animate-[scale-in_0.14s_ease]"
              aria-label="Stop"
            >
              <Square size={15} strokeWidth={2} />
            </button>
          ) : (
            <div className="shrink-0 w-9 h-9 flex items-center justify-center text-text-muted opacity-20">
              <ArrowUp size={17} strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-[10px] text-text-muted select-none">
          <kbd className="font-mono font-medium">Enter</kbd>
          {" to send · "}
          <kbd className="font-mono font-medium">Shift+Enter</kbd>
          {" for new line"}
        </p>
      </div>
    </div>
  );
}
