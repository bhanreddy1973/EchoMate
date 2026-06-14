"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Columns3, Maximize2, PanelLeft, PanelRight, RotateCcw } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import UrlImportBar from "./UrlImportBar";
import ProblemPanel from "./ProblemPanel";
import CodeEditorPanel from "./CodeEditorPanel";
import RunnerPanel from "./RunnerPanel";
import AICoachPanel from "./AICoachPanel";
import ModelPicker from "./ModelPicker";
import WelcomeState from "./WelcomeState";
import { CodingDecor } from "./CodingDecor";

const LAYOUT_STORAGE_KEY = "echomate:coding-layout:v2";
const DEFAULT_LEFT_WIDTH = 40;
const DEFAULT_EDITOR_HEIGHT = 64;
const COACH_WIDTH = 380;
const HANDLE_WIDTH = 8;

type LayoutPreset = "balanced" | "problem" | "code";

type SavedLayout = {
  leftWidth?: number;
  editorHeight?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readSavedLayout(): Required<SavedLayout> {
  if (typeof window === "undefined") {
    return { leftWidth: DEFAULT_LEFT_WIDTH, editorHeight: DEFAULT_EDITOR_HEIGHT };
  }

  try {
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) || "{}") as SavedLayout;
    return {
      leftWidth: clamp(saved.leftWidth ?? DEFAULT_LEFT_WIDTH, 26, 62),
      editorHeight: clamp(saved.editorHeight ?? DEFAULT_EDITOR_HEIGHT, 36, 82),
    };
  } catch {
    return { leftWidth: DEFAULT_LEFT_WIDTH, editorHeight: DEFAULT_EDITOR_HEIGHT };
  }
}

export default function CodingWorkspace() {
  const { accentColor } = useEmotion();
  const { currentProblem, coachOpen } = useCodingStore();
  const savedLayout = readSavedLayout();

  // NeetCode-style adjustable problem/editor/test split.
  const [leftWidth, setLeftWidth] = useState(savedLayout.leftWidth);
  const [editorHeight, setEditorHeight] = useState(savedLayout.editorHeight);
  const [isDraggingH, setIsDraggingH] = useState(false);
  const [isDraggingV, setIsDraggingV] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ leftWidth, editorHeight }));
    } catch {}
  }, [leftWidth, editorHeight]);

  const applyPreset = useCallback((preset: LayoutPreset) => {
    const next = {
      balanced: { leftWidth: 40, editorHeight: 64 },
      problem: { leftWidth: 56, editorHeight: 58 },
      code: { leftWidth: 30, editorHeight: 74 },
    }[preset];

    setLeftWidth(next.leftWidth);
    setEditorHeight(next.editorHeight);
  }, []);

  const resetLayout = useCallback(() => {
    setLeftWidth(DEFAULT_LEFT_WIDTH);
    setEditorHeight(DEFAULT_EDITOR_HEIGHT);
  }, []);

  const handleHorizontalDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingH(true);

    const handleMove = (ev: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const reserved = coachOpen ? COACH_WIDTH + HANDLE_WIDTH : 0;
      const availableWidth = Math.max(520, rect.width - reserved - HANDLE_WIDTH);
      const x = ev.clientX - rect.left;
      const pct = (x / availableWidth) * 100;
      setLeftWidth(clamp(pct, 26, coachOpen ? 54 : 62));
    };

    const handleUp = () => {
      setIsDraggingH(false);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [coachOpen]);

  const handleVerticalDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingV(true);

    const handleMove = (ev: PointerEvent) => {
      if (!rightPanelRef.current) return;
      const rect = rightPanelRef.current.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      const pct = (y / rect.height) * 100;
      setEditorHeight(clamp(pct, 36, 82));
    };

    const handleUp = () => {
      setIsDraggingV(false);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, []);

  const gridTemplateColumns = coachOpen
    ? `minmax(300px, ${leftWidth}%) ${HANDLE_WIDTH}px minmax(420px, 1fr) ${HANDLE_WIDTH}px ${COACH_WIDTH}px`
    : `minmax(300px, ${leftWidth}%) ${HANDLE_WIDTH}px minmax(420px, 1fr)`;

  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col pt-16 pb-2 px-3 sm:px-4 gap-3 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <CodingDecor accentColor={accentColor} />

      {/* Top bar: URL import + model picker */}
      <motion.div
        className="relative flex flex-col xl:flex-row xl:items-center gap-3 shrink-0"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <div className="flex-1 min-w-0">
          <UrlImportBar />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentProblem && (
            <LayoutControls accentColor={accentColor} onPreset={applyPreset} onReset={resetLayout} />
          )}
          <ModelPicker />
        </div>
      </motion.div>

      {/* Main workspace */}
      {!currentProblem ? (
        <WelcomeState />
      ) : (
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 overflow-hidden flex flex-col lg:grid gap-2 lg:gap-0"
          style={{
            cursor: isDraggingH ? "col-resize" : undefined,
            gridTemplateColumns,
          }}
        >
          {/* Left: Problem panel */}
          <motion.div
            className="min-h-0 flex flex-col h-[42%] lg:h-auto"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ProblemPanel />
          </motion.div>

          {/* Horizontal drag handle */}
          <DragRail
            axis="x"
            active={isDraggingH}
            color={accentColor}
            label="Resize problem and editor panels. Double click to reset."
            onPointerDown={handleHorizontalDragStart}
            onDoubleClick={resetLayout}
          />

          {/* Right: Code editor + runner */}
          <div
            ref={rightPanelRef}
            className="flex-1 min-h-0 grid"
            style={{
              cursor: isDraggingV ? "row-resize" : undefined,
              gridTemplateRows: `minmax(220px, ${editorHeight}%) ${HANDLE_WIDTH}px minmax(150px, 1fr)`,
            }}
          >
            <motion.div
              className="min-h-0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <CodeEditorPanel />
            </motion.div>

            <DragRail
              axis="y"
              active={isDraggingV}
              color={accentColor}
              label="Resize editor and tests. Double click to reset."
              onPointerDown={handleVerticalDragStart}
              onDoubleClick={resetLayout}
            />

            <motion.div
              className="min-h-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <RunnerPanel />
            </motion.div>
          </div>

          {/* Coach drawer */}
          <AnimatePresence>
            {coachOpen && (
              <>
                <div className="hidden lg:block" />
                <motion.div
                  className="absolute inset-x-0 bottom-0 top-10 z-20 lg:static shrink-0 min-h-0"
                  initial={{ opacity: 0, x: 42, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 42, scale: 0.98 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AICoachPanel />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function LayoutControls({
  accentColor,
  onPreset,
  onReset,
}: {
  accentColor: string;
  onPreset: (preset: LayoutPreset) => void;
  onReset: () => void;
}) {
  const controls: { id: LayoutPreset; label: string; icon: React.ElementType }[] = [
    { id: "balanced", label: "Balanced", icon: Columns3 },
    { id: "problem", label: "Problem", icon: PanelLeft },
    { id: "code", label: "Code", icon: PanelRight },
  ];

  return (
    <div
      className="hidden md:flex items-center gap-1 rounded-2xl p-1"
      style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.085)", backdropFilter: "blur(24px)" }}
    >
      {controls.map((control) => {
        const Icon = control.icon;
        return (
          <motion.button
            key={control.id}
            type="button"
            onClick={() => onPreset(control.id)}
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
            title={`Switch to ${control.label.toLowerCase()} layout`}
          >
            <Icon size={11} />
            {control.label}
          </motion.button>
        );
      })}
      <div className="h-4 w-px bg-white/10" />
      <motion.button
        type="button"
        onClick={onReset}
        whileHover={{ rotate: -12, scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        className="rounded-xl px-2 py-1.5 text-text-muted hover:text-text-primary transition-colors"
        title="Reset split panels"
        style={{ color: accentColor }}
      >
        <RotateCcw size={12} />
      </motion.button>
    </div>
  );
}

function DragRail({
  axis,
  active,
  color,
  label,
  onPointerDown,
  onDoubleClick,
}: {
  axis: "x" | "y";
  active: boolean;
  color: string;
  label: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}) {
  const isHorizontal = axis === "y";

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isHorizontal ? "horizontal" : "vertical"}
      className={
        isHorizontal
          ? "flex h-2 shrink-0 items-center justify-center cursor-row-resize group relative z-10"
          : "hidden lg:flex w-2 shrink-0 items-center justify-center cursor-col-resize group relative z-10"
      }
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title={label}
    >
      <motion.div
        className={isHorizontal ? "h-[2px] w-full rounded-full" : "w-[2px] h-full rounded-full"}
        style={{ backgroundColor: active ? color : "rgba(255,255,255,0.075)" }}
        animate={active ? { opacity: [0.65, 1, 0.65], scale: isHorizontal ? [1, 1.01, 1] : [1, 1.04, 1] } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, repeat: active ? Infinity : 0 }}
      />
      <div className={isHorizontal ? "absolute inset-x-0 -top-1 -bottom-1 rounded group-hover:bg-white/[0.03]" : "absolute inset-y-0 -left-1 -right-1 rounded group-hover:bg-white/[0.03]"} />
      <motion.div
        className="absolute rounded-full opacity-0 group-hover:opacity-100"
        style={{ background: color, boxShadow: `0 0 16px ${color}` }}
        animate={active ? { scale: [0.8, 1.25, 0.8], opacity: [0.5, 1, 0.5] } : undefined}
        transition={{ duration: 0.9, repeat: active ? Infinity : 0 }}
      >
        <Maximize2 size={10} className="m-1 text-white" />
      </motion.div>
    </div>
  );
}
