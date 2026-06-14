"use client";

import { isValidElement, useState, useRef, useEffect, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Command, Copy, Send, Sparkles, X } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import { COACH_ACTIONS, CoachAction } from "@/types/coding";
import ReactMarkdown from "react-markdown";
import MotionGlyph from "./MotionGlyph";
import { ThinkingWave } from "./CodingDecor";
import MermaidDiagram from "./MermaidDiagram";

const PRIMARY_ACTIONS: CoachAction[] = ["give_hint", "debug_code", "validate_approach", "dry_run"];

export default function AICoachPanel() {
  const { accentColor, glowColor } = useEmotion();
  const { coachMessages, coachLoading, sendCoachMessage, sendCoachFreeText, toggleCoach } = useCodingStore();
  const [freeText, setFreeText] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachMessages, coachLoading]);

  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (freeText.trim() && !coachLoading) {
      sendCoachFreeText(freeText.trim());
      setFreeText("");
    }
  };

  const primaryActions = COACH_ACTIONS.filter((action) => PRIMARY_ACTIONS.includes(action.id));

  return (
    <div
      className="relative h-full flex flex-col rounded-[26px] overflow-hidden glass-specular"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.024))",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(34px) saturate(185%)",
        boxShadow: `0 24px 70px -34px rgba(0,0,0,0.9), 0 0 42px -24px ${glowColor}`,
      }}
    >
      <motion.div
        className="absolute -right-16 -top-16 h-36 w-36 rounded-full blur-3xl opacity-30"
        style={{ background: accentColor }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.18, 0.34, 0.18] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <MotionGlyph variant="coach" color={accentColor} size="md" active={coachLoading} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-text-primary truncate">AI Coach</p>
            <p className="text-[9px] text-text-ghost truncate">NVIDIA-first guided problem solving</p>
          </div>
        </div>
        <motion.button onClick={toggleCoach} whileHover={{ rotate: 90, scale: 1.05 }} whileTap={{ scale: 0.92 }} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0">
          <X size={12} className="text-text-muted" />
        </motion.button>
      </div>

      {/* Compact action rail. Keeps the reply area large. */}
      <div className="relative border-b border-white/5 shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto smooth-scroll">
          {primaryActions.map((action) => (
            <CoachActionButton key={action.id} action={action} accentColor={accentColor} disabled={coachLoading} onClick={() => sendCoachMessage(action.id)} />
          ))}
          <motion.button
            type="button"
            onClick={() => setActionsOpen((value) => !value)}
            whileHover={{ y: -1, scale: 1.015 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[9.5px] font-medium text-text-secondary whitespace-nowrap"
            style={{ background: actionsOpen ? `${accentColor}14` : "rgba(255,255,255,0.035)", border: `1px solid ${actionsOpen ? `${accentColor}32` : "rgba(255,255,255,0.07)"}` }}
          >
            <Command size={11} style={{ color: accentColor }} />
            More
            <ChevronDown size={10} className="transition-transform" style={{ transform: actionsOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </motion.button>
        </div>

        <AnimatePresence>
          {actionsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-1.5 px-3 pb-2 max-h-[168px] overflow-y-auto smooth-scroll">
                {COACH_ACTIONS.map((action) => (
                  <CoachActionButton key={action.id} action={action} accentColor={accentColor} disabled={coachLoading} detailed onClick={() => { sendCoachMessage(action.id); setActionsOpen(false); }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0 overflow-y-auto p-3 space-y-3 smooth-scroll">
        <AnimatePresence initial={false}>
          {coachMessages.length === 0 && !coachLoading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex h-full flex-col items-center justify-center text-center space-y-3"
            >
              <MotionGlyph variant="coach" color={accentColor} size="lg" active />
              <div>
                <p className="text-[12px] text-text-secondary">Ready to coach your current solution</p>
                <p className="text-[9px] text-text-ghost mt-1 max-w-[240px]">
                  Use a compact action above or ask anything. The coach reads the problem, code, and latest run output.
                </p>
              </div>
            </motion.div>
          )}

          {coachMessages.map((msg) => (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" ? (
                <AssistantResponseCard content={msg.content} model={msg.model} accentColor={accentColor} />
              ) : (
                <div
                  className="relative max-w-[88%] overflow-hidden rounded-2xl px-3 py-2 text-[11px] leading-relaxed"
                  style={{ background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`, color: "rgba(255,255,255,0.92)", border: `1px solid ${accentColor}35` }}
                >
                  {msg.content}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {coachLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <ThinkingWave color={accentColor} label="Coach is reasoning" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleFreeTextSubmit} className="relative px-3 py-2.5 border-t border-white/5 shrink-0">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 28px -18px ${glowColor}` }}
        >
          <Sparkles size={12} style={{ color: accentColor }} />
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Ask the coach anything..."
            disabled={coachLoading}
            className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
          />
          <motion.button type="submit" disabled={!freeText.trim() || coachLoading} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="p-1 rounded-md transition-colors disabled:opacity-30" style={{ color: accentColor }}>
            <Send size={12} />
          </motion.button>
        </div>
      </form>
    </div>
  );
}

function CoachActionButton({
  action,
  accentColor,
  disabled,
  detailed = false,
  onClick,
}: {
  action: (typeof COACH_ACTIONS)[number];
  accentColor: string;
  disabled: boolean;
  detailed?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -1, scale: 1.015 }}
      whileTap={{ scale: 0.96 }}
      className={`group flex items-center gap-2 rounded-xl text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${detailed ? "px-2 py-2" : "px-2.5 py-2 whitespace-nowrap"}`}
      style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}
      title={action.description}
    >
      <MotionGlyph variant={action.id} color={accentColor} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[9.5px] font-medium text-text-secondary group-hover:text-text-primary">{action.label}</span>
        {detailed && <span className="block truncate text-[8px] text-text-ghost">{action.description}</span>}
      </span>
    </motion.button>
  );
}

function AssistantResponseCard({ content, model, accentColor }: { content: string; model?: string; accentColor: string }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] p-4 text-[12px] leading-relaxed"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.032))",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 16px 42px -28px rgba(0,0,0,0.9)",
      }}
    >
      <motion.span
        className="absolute left-0 top-0 h-px w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 1.35, ease: "easeOut" }}
      />
      <div className="mb-3 flex items-center gap-2">
        <MotionGlyph variant="coach" color={accentColor} size="sm" />
        <div>
          <p className="text-[10px] font-semibold text-text-primary">Coach Response</p>
          <p className="text-[8px] text-text-ghost">Context-aware guidance</p>
        </div>
      </div>
      <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-[23px] [&_h1]:leading-tight [&_h1]:tracking-[-0.03em] [&_h2]:text-[17px] [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-[14px] [&_h3]:mt-3 [&_p]:text-text-secondary [&_p]:leading-relaxed [&_li]:text-text-secondary [&_ul]:my-2 [&_ol]:my-2 [&_table]:text-[11px] [&_th]:text-text-primary [&_td]:text-text-secondary [&_blockquote]:border-l-current [&_blockquote]:text-text-muted">
        <ReactMarkdown components={{ pre: MarkdownCodeBlock, code: InlineCode }}>{content}</ReactMarkdown>
      </div>
      {model && <p className="mt-3 text-[8px] text-text-ghost opacity-70">Model: {model}</p>}
    </div>
  );
}

type MarkdownElementProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  className?: string;
};

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return getNodeText(node.props.children);
  return "";
}

function getCodeLanguage(children: ReactNode): string {
  if (!isValidElement<{ className?: string }>(children)) return "code";
  const className = children.props.className || "";
  return className.replace("language-", "") || "code";
}

function MarkdownCodeBlock({ children }: MarkdownElementProps) {
  const [copied, setCopied] = useState(false);
  const code = getNodeText(children).replace(/\n$/, "");
  const language = getCodeLanguage(children);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (language.toLowerCase() === "mermaid") {
    return <MermaidDiagram chart={code} />;
  }

  return (
    <div className="not-prose my-3 overflow-hidden rounded-2xl border border-white/10 bg-[#070711]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.035] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-300/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-text-ghost">{language}</span>
        </div>
        <motion.button
          type="button"
          onClick={copyCode}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.94 }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-[9px] font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          {copied ? <Check size={10} className="text-emerald-300" /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </motion.button>
      </div>
      <pre className="m-0 max-h-[360px] overflow-auto p-3 text-[11px] leading-relaxed text-slate-200">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children, className }: MarkdownElementProps) {
  if (className?.startsWith("language-")) {
    return <code className={className}>{children}</code>;
  }

  return (
    <code className="rounded-md border border-white/8 bg-white/[0.075] px-1.5 py-0.5 text-[0.88em] text-cyan-100">
      {children}
    </code>
  );
}
