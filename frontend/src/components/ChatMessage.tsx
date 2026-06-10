import { useState } from "react";
import clsx from "clsx";
import { Copy, Check, RotateCcw, FileText, Image, Table, FileCode } from "lucide-react";
import { Message, Attachment } from "../types";

interface ChatMessageProps {
  message: Message;
}

/* ─── Inline markdown renderer ──────────────────────────────────────────── */
function renderContent(text: string): React.ReactNode[] {
  /*
   * Handles:  **bold**  *italic*  `inline code`  \n line breaks
   * Everything else is rendered as plain text.
   */
  const segments = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\n)/g);
  return segments.map((seg, i) => {
    if (seg === "\n")
      return <br key={i} />;
    if (seg.startsWith("**") && seg.endsWith("**"))
      return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("*") && seg.endsWith("*"))
      return <em key={i} className="italic">{seg.slice(1, -1)}</em>;
    if (seg.startsWith("`") && seg.endsWith("`"))
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md text-[12px] font-mono bg-white/10 text-text-primary"
        >
          {seg.slice(1, -1)}
        </code>
      );
    return <span key={i}>{seg}</span>;
  });
}

function AttachmentChip({ att }: { att: Attachment }) {
  const icon = (() => {
    switch (att.type) {
      case "pdf":   return <FileText size={11} strokeWidth={2} />;
      case "image": return <Image    size={11} strokeWidth={2} />;
      case "csv":   return <Table    size={11} strokeWidth={2} />;
      case "doc":   return <FileText size={11} strokeWidth={2} />;
      default:      return <FileCode size={11} strokeWidth={2} />;
    }
  })();
  const size = att.size < 1024 ? `${att.size}B` : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(0)}KB` : `${(att.size / (1024 * 1024)).toFixed(1)}MB`;
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[11px] text-white/80">
      <span className="text-white/60">{icon}</span>
      <span className="truncate max-w-[100px]">{att.name}</span>
      <span className="text-white/40">{size}</span>
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silently fail in non-HTTPS environments */ }
  };

  return (
    <div
      className={clsx(
        "group flex gap-2.5 py-0.5 animate-[fade-up_0.22s_ease]",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "mt-1 w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold select-none",
          isUser
            ? "bg-accent-blue/15 text-accent-blue"
            : "bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 text-accent-purple",
        )}
      >
        {isUser ? "Y" : "E"}
      </div>

      {/* Bubble + action bar */}
      <div className={clsx("flex flex-col gap-1 max-w-[76%]", isUser && "items-end")}>

        {/* Attachment chips (user messages only) */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {message.attachments.map((att) => (
              <AttachmentChip key={att.id} att={att} />
            ))}
          </div>
        )}

        {/* Bubble */}
        <div
          className={clsx(
            "rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed shadow-depth-sm",
            isUser
              ? "bg-accent-blue text-white rounded-tr-[4px]"
              : "bg-surface-tertiary text-text-primary border border-border-primary rounded-tl-[4px]",
          )}
        >
          {/* Empty streaming bubble shows a pulsing ellipsis */}
          {!isUser && message.isStreaming && message.content === "" ? (
            <span className="flex items-center gap-1 py-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-text-muted"
                  style={{ animation: `float 1.4s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
          ) : (
            <p className="break-words">
              {renderContent(message.content)}
              {/* Streaming cursor */}
              {message.isStreaming && (
                <span
                  className="inline-block w-[2px] h-[1em] bg-text-secondary align-middle ml-0.5 rounded-full"
                  style={{ animation: "blink 1s step-start infinite" }}
                />
              )}
            </p>
          )}
        </div>

        {/* Hover action bar */}
        <div
          className={clsx(
            "flex items-center gap-1 px-0.5 transition-all duration-150 opacity-0 group-hover:opacity-100",
            isUser ? "flex-row-reverse" : "flex-row",
          )}
        >
          <time className="text-[10px] text-text-muted tabular-nums px-1">
            {formatTime(message.timestamp)}
          </time>

          {!isUser && !message.isStreaming && (
            <>
              <div className="w-px h-3 bg-border-primary mx-0.5" />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
                aria-label="Copy"
              >
                {copied
                  ? <Check size={11} className="text-accent-green" />
                  : <Copy size={11} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
                aria-label="Retry"
              >
                <RotateCcw size={11} />
                <span>Retry</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
