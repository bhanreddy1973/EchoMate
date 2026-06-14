"use client";

import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Copy, Download, RotateCcw, Bot } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import { LANGUAGE_DISPLAY_NAMES, LANGUAGE_MONACO_MAP, CodingLanguage } from "@/types/coding";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import MotionGlyph from "./MotionGlyph";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CodeEditorPanel() {
  const { accentColor, glowColor } = useEmotion();
  const {
    code,
    setCode,
    selectedLanguage,
    setSelectedLanguage,
    runCode,
    isRunning,
    toggleCoach,
    coachOpen,
  } = useCodingStore();

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
  }, [code]);

  const handleDownload = useCallback(() => {
    const ext: Record<CodingLanguage, string> = {
      python: "py", javascript: "js", typescript: "ts",
      java: "java", cpp: "cpp", go: "go", rust: "rs", csharp: "cs",
    };
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solution.${ext[selectedLanguage]}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, selectedLanguage]);

  const handleReset = useCallback(() => {
    const store = useCodingStore.getState();
    const problem = store.currentProblem;
    if (problem?.starterCode[selectedLanguage]) {
      setCode(problem.starterCode[selectedLanguage]);
    }
  }, [selectedLanguage, setCode]);

  const languages = Object.entries(LANGUAGE_DISPLAY_NAMES) as [CodingLanguage, string][];

  return (
    <div
      className="h-full flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(30px)",
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <MotionGlyph variant="code" color={accentColor} size="sm" />
          {/* Language selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value as CodingLanguage)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/8 text-text-secondary outline-none cursor-pointer hover:bg-white/8 transition-colors"
            style={{ colorScheme: "dark" }}
          >
            {languages.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Coach button */}
          <motion.button
            onClick={toggleCoach}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
            style={coachOpen ? {
              background: `${accentColor}15`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
            } : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <Bot size={12} />
            AI Coach
          </motion.button>

          <div className="w-px h-4 bg-white/8" />

          {/* Action buttons */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted transition-colors"
            title="Copy code"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted transition-colors"
            title="Download"
          >
            <Download size={12} />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted transition-colors"
            title="Reset to starter code"
          >
            <RotateCcw size={12} />
          </button>

          <div className="w-px h-4 bg-white/8" />

          {/* Run button */}
          <motion.button
            onClick={runCode}
            disabled={isRunning}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              color: "#fff",
              boxShadow: `0 0 20px -5px ${glowColor}`,
            }}
          >
            {isRunning && (
              <motion.span
                className="absolute inset-y-0 left-0 w-10 bg-white/25 blur-md"
                initial={{ x: "-120%" }}
                animate={{ x: "320%" }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <motion.span animate={isRunning ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 1, repeat: isRunning ? Infinity : 0, ease: "linear" }}>
              <Play size={11} fill="currentColor" />
            </motion.span>
            {isRunning ? "Running..." : "Run"}
          </motion.button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="relative flex-1 min-h-0">
        {isRunning && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <MonacoEditor
          height="100%"
          language={LANGUAGE_MONACO_MAP[selectedLanguage]}
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || "")}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            lineNumbers: "on",
            renderLineHighlight: "line",
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            tabSize: 4,
            wordWrap: "on",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            roundedSelection: true,
            contextmenu: true,
            folding: true,
            suggest: { showMethods: true, showFunctions: true },
          }}
        />
      </div>
    </div>
  );
}
