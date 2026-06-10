import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, ArrowUp, Square, Paperclip, Zap, Plug, X, FileText, Image, Table, FileCode } from "lucide-react";
import clsx from "clsx";
import { AgentStatus, ConnectionState, Attachment, Skill } from "../types";
import VoiceOrb from "./VoiceOrb";

interface ComposerProps {
  agentStatus: AgentStatus;
  connectionState: ConnectionState;
  isAIStreaming: boolean;
  activeSkill: Skill | null;
  connectedCount: number;
  attachments: Attachment[];
  onSend: (text: string, attachments: Attachment[]) => void;
  onOpenSkills: () => void;
  onOpenConnectors: () => void;
  onDeactivateSkill: () => void;
  onAddAttachment: (file: File) => void;
  onRemoveAttachment: (id: string) => void;
}

function attachmentIcon(type: Attachment["type"]) {
  switch (type) {
    case "pdf":   return <FileText size={11} strokeWidth={2} />;
    case "image": return <Image    size={11} strokeWidth={2} />;
    case "csv":   return <Table    size={11} strokeWidth={2} />;
    case "doc":   return <FileText size={11} strokeWidth={2} />;
    default:      return <FileCode size={11} strokeWidth={2} />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function Composer({
  agentStatus,
  connectionState,
  isAIStreaming,
  activeSkill,
  connectedCount,
  attachments,
  onSend,
  onOpenSkills,
  onOpenConnectors,
  onDeactivateSkill,
  onAddAttachment,
  onRemoveAttachment,
}: ComposerProps) {
  const [text, setText]             = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const textareaRef                 = useRef<HTMLTextAreaElement>(null);
  const fileInputRef                = useRef<HTMLInputElement>(null);

  const isConnected = connectionState === "connected";
  const hasText     = text.trim().length > 0;
  const isActive    = agentStatus !== "idle";
  const canSend     = (hasText || attachments.length > 0) && !isAIStreaming;

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isAIStreaming) return;
    onSend(trimmed, attachments);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(onAddAttachment);
    e.target.value = "";
  };

  const placeholder = (() => {
    if (isAIStreaming) return "EchoMate is responding…";
    if (activeSkill) return `${activeSkill.emoji} ${activeSkill.name} mode — ${activeSkill.description.toLowerCase()}`;
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

        {/* Active skill chip */}
        {activeSkill && (
          <div className="flex items-center gap-2 animate-[fade-up_0.2s_ease]">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
              style={{ backgroundColor: `${activeSkill.color}15`, borderColor: `${activeSkill.color}35`, color: activeSkill.color }}
            >
              <span>{activeSkill.emoji}</span>
              <span>{activeSkill.name}</span>
              <button onClick={onDeactivateSkill} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                <X size={10} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 animate-[fade-up_0.2s_ease]">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-tertiary border border-border-primary text-[11px] text-text-secondary"
              >
                <span className="text-accent-blue">{attachmentIcon(att.type)}</span>
                <span className="truncate max-w-[120px]">{att.name}</span>
                <span className="text-text-muted">{formatBytes(att.size)}</span>
                <button
                  onClick={() => onRemoveAttachment(att.id)}
                  className="text-text-muted hover:text-accent-red transition-colors ml-0.5"
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input pill */}
        <div
          className={clsx(
            "rounded-2xl border bg-surface-tertiary composer-shadow transition-colors duration-200",
            canSend
              ? "border-accent-blue/30"
              : "border-border-primary focus-within:border-accent-blue/20",
          )}
        >
          {/* Toolbar row */}
          <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
            {/* Attach file */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.csv,.doc,.docx,.md,.json,.ts,.tsx,.js,.jsx,.py"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              aria-label="Attach file"
            >
              <Paperclip size={12} strokeWidth={2} />
              <span>Attach</span>
              {attachments.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-accent-blue text-white text-[9px] flex items-center justify-center font-bold">
                  {attachments.length}
                </span>
              )}
            </button>

            {/* Skills */}
            <button
              type="button"
              onClick={onOpenSkills}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all",
                activeSkill
                  ? "text-accent-purple bg-accent-purple/10 hover:bg-accent-purple/15"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-hover",
              )}
              aria-label="Skill presets"
            >
              <Zap size={12} strokeWidth={2} />
              <span>Skills</span>
              {activeSkill && <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />}
            </button>

            {/* Integrations */}
            <button
              type="button"
              onClick={onOpenConnectors}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all",
                connectedCount > 0
                  ? "text-accent-green bg-accent-green/8 hover:bg-accent-green/12"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-hover",
              )}
              aria-label="Integrations"
            >
              <Plug size={12} strokeWidth={2} />
              <span>Integrations</span>
              {connectedCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded-md"
                  style={{ backgroundColor: "rgba(52,211,153,0.2)", color: "#34d399" }}
                >
                  {connectedCount}
                </span>
              )}
            </button>
          </div>

          {/* Input row */}
          <div className="flex items-end gap-2 px-2 pb-2">
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

            {/* Right action */}
            {hasText || attachments.length > 0 ? (
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
