"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, ExternalLink, BookOpen, FlaskConical, AlertTriangle, Lightbulb } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MotionGlyph from "./MotionGlyph";

type ProblemTab = "description" | "examples" | "constraints" | "hints";

export default function ProblemPanel() {
  const { accentColor, glowColor } = useEmotion();
  const { currentProblem } = useCodingStore();
  const [activeTab, setActiveTab] = useState<ProblemTab>("description");

  if (!currentProblem) return null;

  const difficultyColor = {
    Easy: "#10b981",
    Medium: "#f59e0b",
    Hard: "#ef4444",
  }[currentProblem.difficulty];

  const tabs: { id: ProblemTab; label: string; icon: React.ElementType }[] = [
    { id: "description", label: "Description", icon: BookOpen },
    { id: "examples", label: "Examples", icon: FlaskConical },
    { id: "constraints", label: "Constraints", icon: AlertTriangle },
    { id: "hints", label: "Hints", icon: Tag },
  ];

  return (
    <div
      className="relative h-full flex flex-col rounded-[26px] overflow-hidden glass-specular"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(32px) saturate(175%)",
        boxShadow: `0 24px 70px -36px rgba(0,0,0,0.9), 0 0 34px -26px ${glowColor}`,
      }}
    >
      <motion.div
        className="absolute -left-20 -top-20 h-40 w-40 rounded-full blur-3xl opacity-25"
        style={{ background: difficultyColor }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative px-4 pt-4 pb-3 border-b border-white/5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <MotionGlyph variant="explain_problem" color={accentColor} size="md" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-text-primary truncate tracking-[-0.01em]">{currentProblem.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: `${difficultyColor}20`, color: difficultyColor, border: `1px solid ${difficultyColor}30` }}>
                  {currentProblem.difficulty}
                </span>
                <span className="text-[10px] text-text-ghost capitalize">{currentProblem.source}</span>
              </div>
            </div>
          </div>
          {currentProblem.sourceUrl && (
            <motion.a href={currentProblem.sourceUrl} target="_blank" rel="noopener noreferrer" whileHover={{ scale: 1.08, rotate: -5 }} whileTap={{ scale: 0.94 }} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Open original">
              <ExternalLink size={13} className="text-text-muted" />
            </motion.a>
          )}
        </div>

        {currentProblem.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentProblem.tags.map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                className="px-2 py-0.5 rounded-md text-[9px] text-text-muted"
                style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.065)" }}
              >
                {tag}
              </motion.span>
            ))}
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-1 px-3 py-2 border-b border-white/5 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all whitespace-nowrap"
              style={isActive ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` } : { color: "rgba(255,255,255,0.42)", border: "1px solid transparent" }}
            >
              {isActive && <motion.span layoutId="problem-tab" className="absolute inset-0 rounded-xl" style={{ background: `${accentColor}10` }} />}
              <Icon size={10} className="relative" />
              <span className="relative">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="relative flex-1 overflow-y-auto p-4 smooth-scroll">
        <AnimatePresence mode="wait">
          {activeTab === "description" && (
            <motion.div key="description" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&_p]:text-[12.5px] [&_p]:leading-relaxed [&_p]:text-text-secondary [&_code]:text-[11px] [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_strong]:text-text-primary [&_strong]:font-semibold [&_ul]:text-[12px] [&_ul]:text-text-secondary [&_ol]:text-[12px] [&_ol]:text-text-secondary [&_li]:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentProblem.statementMarkdown}</ReactMarkdown>
            </motion.div>
          )}

          {activeTab === "examples" && (
            <motion.div key="examples" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              {currentProblem.examples.map((ex, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.026)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Example {i + 1}</p>
                  <ExampleBlock label="Input" value={ex.input} />
                  <ExampleBlock label="Output" value={ex.output} />
                  {ex.explanation && <p className="text-[11px] text-text-muted leading-relaxed"><span className="text-text-ghost">Explanation:</span> {ex.explanation}</p>}
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === "constraints" && (
            <motion.div key="constraints" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
              {currentProblem.constraints.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.026)", border: "1px solid rgba(255,255,255,0.045)" }}>
                  <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
                  <code className="text-[11px] text-text-secondary font-mono">{c}</code>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === "hints" && (
            <motion.div key="hints" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
              {currentProblem.hints && currentProblem.hints.length > 0 ? currentProblem.hints.map((h, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-2 px-3 py-2 rounded-xl text-[11px] text-text-muted" style={{ background: "rgba(245,158,11,0.055)", border: "1px solid rgba(245,158,11,0.14)" }}>
                  <Lightbulb size={12} className="mt-0.5 text-amber-300" />
                  {h}
                </motion.div>
              )) : <p className="text-[11px] text-text-ghost">No static hints available. Open AI Coach for guided hints.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ExampleBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-text-ghost">{label}:</span>
      <pre className="mt-0.5 text-[11px] text-text-secondary font-mono bg-black/20 rounded-xl px-3 py-2 overflow-x-auto whitespace-pre-wrap">{value}</pre>
    </div>
  );
}
