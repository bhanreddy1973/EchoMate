import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { Copy, Check, RotateCcw, ChevronRight, Sparkles, FileText, Image, Table, FileCode } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Message, Attachment } from "../types";

interface ChatMessageProps {
  message: Message;
}

/* ─── Code Block with premium styling ───────────────────────────────────── */
function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-3 rounded-xl overflow-hidden border border-white/[0.07] bg-[#0b0b18]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
          <span className="text-[10px] font-mono font-medium text-white/30 uppercase tracking-wider ml-2">
            {language || "text"}
          </span>
        </div>
        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 hover:bg-white/[0.06]"
          style={{ color: copied ? "#34d399" : "rgba(255,255,255,0.35)" }}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={11} />
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Copy size={11} />
              </motion.span>
            )}
          </AnimatePresence>
          {copied ? "Copied!" : "Copy"}
        </motion.button>
      </div>
      {/* Code */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "14px 18px",
            background: "transparent",
            fontSize: "12.5px",
            lineHeight: "1.7",
            borderRadius: 0,
          }}
          showLineNumbers={children.split("\n").length > 3}
          lineNumberStyle={{
            color: "rgba(255,255,255,0.12)",
            fontSize: "10px",
            paddingRight: "14px",
            minWidth: "2em",
          }}
        >
          {children.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

/* ─── Thinking Block ────────────────────────────────────────────────────── */
function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="my-3 rounded-xl overflow-hidden"
      style={{
        background: "rgba(251,191,36,0.03)",
        border: "1px solid rgba(251,191,36,0.12)",
        borderLeftWidth: "3px",
        borderLeftColor: "rgba(251,191,36,0.4)",
      }}
      layout
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={12} className="text-accent-amber/70" />
        </motion.div>
        <Sparkles size={11} className="text-accent-amber/70" />
        <span className="text-[11px] font-medium text-accent-amber/80">Thinking Process</span>
        {!expanded && (
          <span className="ml-2 text-[10px] text-white/25 truncate max-w-[180px]">
            {content.slice(0, 50)}...
          </span>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 text-[12px] leading-relaxed text-white/55 border-t border-accent-amber/10 pt-2.5">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Attachment Chip ───────────────────────────────────────────────────── */
function AttachmentChip({ att }: { att: Attachment }) {
  const icon = (() => {
    switch (att.type) {
      case "pdf":   return <FileText size={10} />;
      case "image": return <Image size={10} />;
      case "csv":   return <Table size={10} />;
      default:      return <FileCode size={10} />;
    }
  })();
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/60">
      <span className="text-accent-blue/70">{icon}</span>
      <span className="truncate max-w-[90px]">{att.name}</span>
    </div>
  );
}

/* ─── Main Message Component ────────────────────────────────────────────── */
function ChatMessageInner({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse thinking blocks
  const parseContent = (text: string) => {
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
    const parts: { type: "text" | "thinking"; content: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = thinkingRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: "thinking", content: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) });
    }
    return parts.length > 0 ? parts : [{ type: "text" as const, content: text }];
  };

  if (isUser) {
    return (
      <motion.div
        className="flex flex-row-reverse gap-2.5 py-1"
        initial={{ opacity: 0, x: 16, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* User avatar */}
        <div className="mt-1 w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold bg-accent-blue/15 text-accent-blue select-none">
          Y
        </div>

        <div className="flex flex-col gap-1 max-w-[72%] items-end">
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {message.attachments.map((att) => <AttachmentChip key={att.id} att={att} />)}
            </div>
          )}

          {/* Message bubble */}
          <div className="rounded-2xl rounded-tr-[4px] px-4 py-2.5 text-[13.5px] leading-relaxed text-white bg-accent-blue shadow-depth-sm">
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          </div>

          <time className="text-[10px] text-text-muted tabular-nums px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(message.timestamp)}
          </time>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  const parts = parseContent(message.content);

  return (
    <motion.div
      className="group flex gap-2.5 py-1"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 250, delay: 0.03 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Assistant avatar */}
      <motion.div
        className="mt-1 w-7 h-7 rounded-full shrink-0 flex items-center justify-center relative"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(167,139,250,0.15))",
          border: "1px solid rgba(99,102,241,0.2)",
          boxShadow: "0 0 12px rgba(99,102,241,0.2)",
        }}
        animate={message.isStreaming ? {
          boxShadow: ["0 0 12px rgba(99,102,241,0.2)", "0 0 20px rgba(99,102,241,0.4)", "0 0 12px rgba(99,102,241,0.2)"]
        } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles size={10} className="text-accent-blue" />
      </motion.div>

      {/* Content */}
      <div className="flex flex-col gap-1 max-w-[78%]">
        <div
          className="rounded-2xl rounded-tl-[4px] px-5 py-3.5 glass-message relative overflow-hidden"
        >
          {/* Specular top highlight */}
          <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 40%)",
          }} />

          {/* Streaming empty state */}
          {message.isStreaming && message.content === "" ? (
            <div className="flex items-center gap-1.5 py-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-accent-blue"
                  animate={{ scale: [0.6, 1.1, 0.6], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                />
              ))}
              <span className="text-[11px] text-text-muted ml-1.5">Thinking...</span>
            </div>
          ) : (
            <div className="relative markdown-content text-[13.5px] leading-[1.75] text-text-primary/90">
              {parts.map((part, i) => {
                if (part.type === "thinking") {
                  return <ThinkingBlock key={i} content={part.content} />;
                }
                return (
                  <ReactMarkdown
                    key={i}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isInline = !match && !className;
                        if (isInline) {
                          return (
                            <code className="px-1.5 py-0.5 rounded-md text-[12px] font-mono bg-white/[0.07] text-accent-cyan/90 border border-white/[0.05]" {...props}>
                              {children}
                            </code>
                          );
                        }
                        return <CodeBlock language={match?.[1] || ""}>{String(children).replace(/\n$/, "")}</CodeBlock>;
                      },
                      a({ children, href }) {
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            className="text-accent-cyan underline underline-offset-2 decoration-accent-cyan/30 hover:decoration-accent-cyan/70 transition-colors">
                            {children}
                          </a>
                        );
                      },
                      strong({ children }) {
                        return <strong className="font-semibold text-text-primary">{children}</strong>;
                      },
                      h1({ children }) {
                        return <h1 className="text-lg font-bold text-text-primary">{children}</h1>;
                      },
                      h2({ children }) {
                        return <h2 className="text-[15px] font-semibold text-text-primary">{children}</h2>;
                      },
                      h3({ children }) {
                        return <h3 className="text-[14px] font-semibold text-text-primary/90">{children}</h3>;
                      },
                    }}
                  >
                    {part.content}
                  </ReactMarkdown>
                );
              })}
              {/* Streaming cursor */}
              {message.isStreaming && message.content !== "" && (
                <span className="inline-block w-[2px] h-[1em] bg-accent-blue/70 align-middle ml-0.5 rounded-full"
                  style={{ animation: "blink 1s step-start infinite" }} />
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <AnimatePresence>
          {hovered && !message.isStreaming && (
            <motion.div
              className="flex items-center gap-1 px-1"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <time className="text-[10px] text-text-muted tabular-nums px-1">
                {formatTime(message.timestamp)}
              </time>
              <div className="w-px h-3 bg-border-primary mx-0.5" />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              >
                {copied ? <Check size={10} className="text-accent-green" /> : <Copy size={10} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all">
                <RotateCcw size={10} />
                <span>Retry</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ChatMessage = memo(ChatMessageInner);
export default ChatMessage;
