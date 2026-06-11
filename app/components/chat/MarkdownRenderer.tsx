"use client";

import { memo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ChevronDown, ChevronRight, Sparkles } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Custom code block component with copy button
function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  const displayLang = language || "text";

  return (
    <div className="group relative my-4 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d0d1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[11px] font-mono font-medium text-white/40 uppercase tracking-wider ml-2">
            {displayLang}
          </span>
        </div>
        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 hover:bg-white/[0.08]"
          style={{ color: copied ? "#10b981" : "rgba(255,255,255,0.45)" }}
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check size={12} />
              </motion.div>
            ) : (
              <motion.div
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Copy size={12} />
              </motion.div>
            )}
          </AnimatePresence>
          <span>{copied ? "Copied!" : "Copy"}</span>
        </motion.button>
      </div>
      {/* Code content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "16px 20px",
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.7",
            borderRadius: 0,
          }}
          showLineNumbers={children.split("\n").length > 3}
          lineNumberStyle={{
            color: "rgba(255,255,255,0.15)",
            fontSize: "11px",
            paddingRight: "16px",
            minWidth: "2.5em",
          }}
        >
          {children.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// Thinking/reasoning block
function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="my-4 rounded-xl overflow-hidden border-l-2 border-amber-500/40"
      style={{
        background: "rgba(245,158,11,0.04)",
        border: "1px solid rgba(245,158,11,0.12)",
        borderLeftWidth: "3px",
        borderLeftColor: "rgba(245,158,11,0.5)",
      }}
      layout
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight size={14} className="text-amber-400/70" />
        </motion.div>
        <Sparkles size={13} className="text-amber-400/70" />
        <span className="text-[12px] font-medium text-amber-300/80">
          Thinking Process
        </span>
        {!expanded && (
          <span className="ml-2 text-[11px] text-white/30 truncate max-w-[200px]">
            {content.slice(0, 60)}...
          </span>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-[13px] leading-relaxed text-white/60 border-t border-amber-500/10 pt-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MarkdownRendererInner({ content, className = "" }: MarkdownRendererProps) {
  // Parse thinking blocks
  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
  const parts: { type: "text" | "thinking"; content: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = thinkingRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "thinking", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return (
    <div className={`markdown-body ${className}`}>
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
              code({ className: codeClassName, children, ...props }) {
                const match = /language-(\w+)/.exec(codeClassName || "");
                const isInline = !match && !codeClassName;
                
                if (isInline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded-md text-[12.5px] font-mono bg-white/[0.08] text-cyan-300/90 border border-white/[0.06]"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return (
                  <CodeBlock language={match?.[1] || ""}>
                    {String(children).replace(/\n$/, "")}
                  </CodeBlock>
                );
              },
              table({ children }) {
                return (
                  <div className="my-4 overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full text-[13px]">{children}</table>
                  </div>
                );
              },
              thead({ children }) {
                return (
                  <thead className="bg-white/[0.04] border-b border-white/[0.08]">
                    {children}
                  </thead>
                );
              },
              th({ children }) {
                return (
                  <th className="px-4 py-2.5 text-left text-[12px] font-semibold text-white/70 uppercase tracking-wider">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="px-4 py-2.5 text-white/80 border-t border-white/[0.05]">
                    {children}
                  </td>
                );
              },
              blockquote({ children }) {
                return (
                  <blockquote className="my-3 pl-4 border-l-2 border-indigo-400/40 text-white/60 italic bg-indigo-500/[0.03] rounded-r-lg py-2 pr-3">
                    {children}
                  </blockquote>
                );
              },
              a({ children, href }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 underline underline-offset-2 decoration-cyan-400/30 hover:decoration-cyan-400/70 transition-colors"
                  >
                    {children}
                  </a>
                );
              },
              ul({ children }) {
                return <ul className="my-2 space-y-1 list-disc list-inside marker:text-white/30">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="my-2 space-y-1 list-decimal list-inside marker:text-white/40">{children}</ol>;
              },
              li({ children }) {
                return <li className="text-white/85 leading-relaxed">{children}</li>;
              },
              h1({ children }) {
                return <h1 className="text-xl font-bold mt-6 mb-3 text-white/95">{children}</h1>;
              },
              h2({ children }) {
                return <h2 className="text-lg font-semibold mt-5 mb-2.5 text-white/90">{children}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-[15px] font-semibold mt-4 mb-2 text-white/85">{children}</h3>;
              },
              p({ children }) {
                return <p className="my-2 leading-[1.75] text-white/85">{children}</p>;
              },
              hr() {
                return <hr className="my-6 border-white/[0.08]" />;
              },
              strong({ children }) {
                return <strong className="font-semibold text-white/95">{children}</strong>;
              },
              em({ children }) {
                return <em className="italic text-white/75">{children}</em>;
              },
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererInner);
export default MarkdownRenderer;
