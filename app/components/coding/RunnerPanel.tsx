"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock, Copy, Cpu, FlaskConical, History, Play, TerminalSquare, XCircle } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import { RunResult, RunStatus, TestCaseResult } from "@/types/coding";
import MotionGlyph from "./MotionGlyph";
import { ThinkingWave } from "./CodingDecor";

type RunnerTab = "testcases" | "output" | "input" | "history";

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; icon: React.ElementType }> = {
  accepted: { label: "Accepted", color: "#10b981", icon: CheckCircle },
  wrong_answer: { label: "Wrong Answer", color: "#ef4444", icon: XCircle },
  runtime_error: { label: "Runtime Error", color: "#ef4444", icon: XCircle },
  compile_error: { label: "Compile Error", color: "#f59e0b", icon: AlertTriangle },
  time_limit: { label: "Time Limit", color: "#f59e0b", icon: Clock },
  memory_limit: { label: "Memory Limit", color: "#f59e0b", icon: Cpu },
  pending: { label: "Pending", color: "#6366f1", icon: Clock },
  processing: { label: "Processing", color: "#06b6d4", icon: Clock },
};

export default function RunnerPanel() {
  const { accentColor, glowColor } = useEmotion();
  const { runResults, customInput, setCustomInput, isRunning, currentProblem, testResults, runTestCases } = useCodingStore();
  const [activeTab, setActiveTab] = useState<RunnerTab>("testcases");
  const [selectedCase, setSelectedCase] = useState(0);
  const previousRunCount = useRef(runResults.length);

  const latestResult = runResults[0];
  const visibleTestResults = testResults.length > 0 ? testResults : latestResult?.testResults || [];
  const passedCount = visibleTestResults.filter((t) => t.passed).length;
  const totalCount = visibleTestResults.length;

  useEffect(() => {
    if (runResults.length > previousRunCount.current) {
      const latest = runResults[0];
      setActiveTab(latest?.testResults?.length ? "testcases" : "output");
      setSelectedCase(0);
    }
    previousRunCount.current = runResults.length;
  }, [runResults]);

  const tabs: { id: RunnerTab; label: string; icon: React.ElementType }[] = [
    { id: "testcases", label: totalCount > 0 ? `Tests ${passedCount}/${totalCount}` : "Test Cases", icon: FlaskConical },
    { id: "output", label: "Output", icon: TerminalSquare },
    { id: "input", label: "Input", icon: Play },
    { id: "history", label: `History ${runResults.length}`, icon: History },
  ];

  return (
    <div
      className="relative h-full flex flex-col rounded-[26px] overflow-hidden glass-specular"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.052), rgba(255,255,255,0.023))",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(32px) saturate(175%)",
        boxShadow: `0 20px 60px -36px rgba(0,0,0,0.9), 0 0 34px -27px ${glowColor}`,
      }}
    >
      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto smooth-scroll">
          <MotionGlyph variant="run" color={accentColor} size="sm" active={isRunning} />
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
                <Icon size={10} />
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {currentProblem?.examples && currentProblem.examples.length > 0 && activeTab === "testcases" && (
            <motion.button
              onClick={runTestCases}
              disabled={isRunning}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.95 }}
              className="relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all disabled:opacity-40"
              style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}35` }}
            >
              {isRunning && <motion.span className="absolute inset-y-0 left-0 w-8 bg-white/25 blur-md" initial={{ x: "-120%" }} animate={{ x: "320%" }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }} />}
              <Play size={9} fill="currentColor" />
              {isRunning ? "Running" : "Run Tests"}
            </motion.button>
          )}
          {latestResult && <StatusBadge status={latestResult.status} />}
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 overflow-y-auto p-3 smooth-scroll">
        {activeTab === "testcases" && (
          <TestCasesView
            accentColor={accentColor}
            isRunning={isRunning}
            currentExamples={currentProblem?.examples || []}
            results={visibleTestResults}
            selectedCase={selectedCase}
            onSelectCase={setSelectedCase}
            passedCount={passedCount}
            totalCount={totalCount}
          />
        )}

        {activeTab === "output" && <OutputView result={latestResult} isRunning={isRunning} accentColor={accentColor} />}

        {activeTab === "input" && (
          <div className="h-full min-h-[150px] flex flex-col gap-3">
            <div className="flex-1 rounded-2xl border border-white/8 bg-black/20 p-3 flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Custom stdin</p>
                <span className="text-[9px] text-text-ghost">One argument per line, or LeetCode format</span>
              </div>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={'Enter test input, e.g.:\n"ADOBECODEBANC"\n"ABC"\n\nOr LeetCode format:\ns = "ADOBECODEBANC", t = "ABC"'}
                className="w-full flex-1 min-h-[100px] bg-transparent text-[11px] text-text-secondary font-mono resize-none outline-none placeholder:text-text-ghost"
              />
            </div>
            <motion.button
              onClick={() => {
                if (customInput.trim()) {
                  const { runCode: run } = useCodingStore.getState();
                  run();
                }
              }}
              disabled={isRunning || !customInput.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}35` }}
            >
              <Play size={11} fill="currentColor" />
              {isRunning ? "Running..." : "Run with Custom Input"}
            </motion.button>
          </div>
        )}

        {activeTab === "history" && <HistoryView results={runResults} />}
      </div>
    </div>
  );
}

function TestCasesView({
  accentColor,
  isRunning,
  currentExamples,
  results,
  selectedCase,
  onSelectCase,
  passedCount,
  totalCount,
}: {
  accentColor: string;
  isRunning: boolean;
  currentExamples: { input: string; output: string }[];
  results: TestCaseResult[];
  selectedCase: number;
  onSelectCase: (index: number) => void;
  passedCount: number;
  totalCount: number;
}) {
  if (isRunning) return <ThinkingWave color={accentColor} label="Running test cases" />;

  if (results.length > 0) {
    return (
      <div className="space-y-3">
        <RunSummary passedCount={passedCount} totalCount={totalCount} accentColor={accentColor} />
        <div className="flex items-center gap-1.5 flex-wrap">
          {results.map((result, index) => (
            <CasePill key={result.id} result={result} index={index} selected={selectedCase === index} onClick={() => onSelectCase(index)} />
          ))}
        </div>
        {results[selectedCase] && <TestCaseDetail result={results[selectedCase]} index={selectedCase} />}
      </div>
    );
  }

  if (currentExamples.length === 0) {
    return <EmptyRunner title="No test cases yet" description="Add custom input or ask the coach to generate edge cases." />;
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {currentExamples.map((ex, index) => (
        <ExampleCaseCard key={index} input={ex.input} output={ex.output} index={index} />
      ))}
    </div>
  );
}

function OutputView({ result, isRunning, accentColor }: { result?: RunResult; isRunning: boolean; accentColor: string }) {
  if (isRunning) return <ThinkingWave color={accentColor} label="Running your code" />;
  if (!result) return <EmptyRunner title="No run output" description="Press Run in the editor to execute your current code. The panel will switch here automatically." />;

  const blocks = [
    { label: "stdout", value: result.stdout, tone: "normal" as const },
    { label: "stderr", value: result.stderr, tone: "error" as const },
    { label: "compile output", value: result.compileOutput, tone: "warning" as const },
  ].filter((block) => block.value);

  return (
    <div className="space-y-3">
      <RunMetricRow result={result} />
      {blocks.length > 0 ? blocks.map((block) => <OutputBlock key={block.label} {...block} />) : <OutputBlock label="output" value="Program finished with no output." tone="muted" />}
    </div>
  );
}

function RunMetricRow({ result }: { result: RunResult }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <MetricCard label="Status" value={STATUS_CONFIG[result.status].label} color={STATUS_CONFIG[result.status].color} />
      <MetricCard label="Time" value={result.time !== "0" ? `${result.time}s` : "—"} />
      <MetricCard label="Memory" value={result.memory !== "0" ? `${result.memory} KB` : "—"} />
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2">
      <p className="text-[8px] uppercase tracking-wider text-text-ghost">{label}</p>
      <p className="mt-1 truncate text-[11px] font-semibold" style={{ color: color || "rgba(255,255,255,0.72)" }}>{value}</p>
    </div>
  );
}

function OutputBlock({ label, value, tone }: { label: string; value: string; tone: "normal" | "error" | "warning" | "muted" }) {
  const toneClass = tone === "error" ? "text-red-300/85" : tone === "warning" ? "text-amber-300/85" : tone === "muted" ? "text-text-muted" : "text-emerald-100/85";

  const copy = () => navigator.clipboard.writeText(value);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/25">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-text-ghost">{label}</p>
        <button onClick={copy} className="rounded-lg p-1 text-text-ghost hover:text-text-secondary hover:bg-white/5 transition-colors" title="Copy output">
          <Copy size={11} />
        </button>
      </div>
      <pre className={`max-h-[260px] overflow-auto whitespace-pre-wrap p-3 text-[11px] leading-relaxed font-mono ${toneClass}`}>{value}</pre>
    </div>
  );
}

function RunSummary({ passedCount, totalCount, accentColor }: { passedCount: number; totalCount: number; accentColor: string }) {
  const allPassed = totalCount > 0 && passedCount === totalCount;
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-text-secondary">Test Result</p>
        <span className="text-[10px] font-semibold" style={{ color: allPassed ? "#10b981" : "#ef4444" }}>{passedCount}/{totalCount} passed</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div initial={{ width: 0 }} animate={{ width: `${totalCount ? (passedCount / totalCount) * 100 : 0}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full rounded-full" style={{ background: allPassed ? "#10b981" : `linear-gradient(90deg, ${accentColor}, #ef4444)` }} />
      </div>
    </div>
  );
}

function CasePill({ result, index, selected, onClick }: { result: TestCaseResult; index: number; selected: boolean; onClick: () => void }) {
  const color = result.passed ? "#10b981" : "#ef4444";
  const Icon = result.passed ? CheckCircle : XCircle;
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-all" style={{ background: selected ? `${color}20` : "rgba(255,255,255,0.04)", border: `1px solid ${selected ? `${color}55` : "rgba(255,255,255,0.08)"}`, color }}>
      <Icon size={10} />
      Case {index + 1}
    </button>
  );
}

function ExampleCaseCard({ input, output, index }: { input: string; output: string; index: number }) {
  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.026] p-3">
      <div className="mb-2 flex items-center gap-2">
        <FlaskConical size={11} className="text-text-ghost" />
        <span className="text-[10px] font-semibold text-text-muted">Case {index + 1}</span>
      </div>
      <MiniPre label="Input" value={input} />
      <MiniPre label="Expected" value={output} />
    </div>
  );
}

function TestCaseDetail({ result, index }: { result: TestCaseResult; index: number }) {
  const statusConfig = STATUS_CONFIG[result.status];
  const Icon = statusConfig.icon;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.026)", border: `1px solid ${result.passed ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.22)"}` }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Icon size={12} style={{ color: statusConfig.color }} />
          <span className="text-[11px] font-semibold" style={{ color: statusConfig.color }}>Case {index + 1} — {result.passed ? "Passed" : statusConfig.label}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-text-ghost">
          {result.time !== "0" && <span>{result.time}s</span>}
          {result.memory !== "0" && <span>{result.memory} KB</span>}
        </div>
      </div>
      <div className="grid gap-2 p-3 md:grid-cols-3">
        <MiniPre label="Input" value={result.input || "(empty)"} />
        <MiniPre label="Expected" value={result.expectedOutput || "(empty)"} tone="success" />
        <MiniPre label="Your Output" value={result.actualOutput || "(no output)"} tone={result.passed ? "success" : "error"} />
      </div>
    </div>
  );
}

function MiniPre({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "success" | "error" }) {
  const color = tone === "success" ? "text-emerald-300/75" : tone === "error" ? "text-red-300/75" : "text-text-muted";
  return (
    <div className="min-w-0">
      <span className="text-[8px] text-text-ghost uppercase tracking-wider">{label}</span>
      <pre className={`mt-1 min-h-[42px] text-[10px] font-mono whitespace-pre-wrap bg-black/20 rounded-xl p-2 overflow-auto ${color}`}>{value}</pre>
    </div>
  );
}

function HistoryView({ results }: { results: RunResult[] }) {
  if (results.length === 0) return <EmptyRunner title="No run history" description="Every run appears here with status, time, and memory." />;

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const config = STATUS_CONFIG[result.status];
        const Icon = config.icon;
        return (
          <div key={result.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/7 bg-white/[0.026] px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={12} style={{ color: config.color }} />
              <span className="text-[10px] font-semibold truncate" style={{ color: config.color }}>{config.label}</span>
              {result.testResults && <span className="text-[9px] text-text-ghost">{result.testResults.filter((t) => t.passed).length}/{result.testResults.length}</span>}
            </div>
            <div className="flex items-center gap-3 text-[9px] text-text-ghost shrink-0">
              {result.time !== "0" && <span>{result.time}s</span>}
              {result.memory !== "0" && <span>{result.memory} KB</span>}
              <span>{new Date(result.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-semibold" style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}>
      <Icon size={10} />
      {config.label}
    </span>
  );
}

function EmptyRunner({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full min-h-[130px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.018] p-4 text-center">
      <div>
        <TerminalSquare size={20} className="mx-auto mb-2 text-text-ghost" />
        <p className="text-[12px] font-semibold text-text-secondary">{title}</p>
        <p className="mt-1 max-w-[320px] text-[10px] leading-relaxed text-text-ghost">{description}</p>
      </div>
    </div>
  );
}
