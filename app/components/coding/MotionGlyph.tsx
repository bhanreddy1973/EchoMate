"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  Brain,
  Bug,
  CheckCircle2,
  Code2,
  Cpu,
  GitBranch,
  Lightbulb,
  LockOpen,
  Network,
  Play,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { CoachAction } from "@/types/coding";

type GlyphVariant = CoachAction | "code" | "run" | "coach" | "progress" | "model" | "import" | "success" | "error" | "loading";

const ICONS: Record<GlyphVariant, React.ElementType> = {
  explain_problem: BookOpen,
  walkthrough_examples: Search,
  validate_approach: CheckCircle2,
  give_hint: Lightbulb,
  debug_code: Bug,
  generate_edge_cases: Zap,
  analyze_complexity: BarChart3,
  optimize_approach: GitBranch,
  dry_run: Play,
  visualize_flow: Network,
  show_solution: LockOpen,
  code: Code2,
  run: Play,
  coach: Brain,
  progress: BarChart3,
  model: Cpu,
  import: Search,
  success: CheckCircle2,
  error: Zap,
  loading: Sparkles,
};

interface MotionGlyphProps {
  variant: GlyphVariant;
  color: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
  className?: string;
}

export default function MotionGlyph({ variant, color, size = "md", active = false, className = "" }: MotionGlyphProps) {
  const Icon = ICONS[variant] || Sparkles;
  const dims = size === "lg" ? "w-14 h-14" : size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const iconSize = size === "lg" ? 22 : size === "sm" ? 11 : 14;

  return (
    <motion.span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-2xl overflow-hidden ${dims} ${className}`}
      style={{
        background: `radial-gradient(circle at 30% 20%, ${color}3d, rgba(255,255,255,0.035) 48%, rgba(255,255,255,0.015))`,
        border: `1px solid ${active ? `${color}66` : "rgba(255,255,255,0.08)"}`,
        boxShadow: active ? `0 0 24px -8px ${color}` : "inset 0 1px 0 rgba(255,255,255,0.10)",
      }}
      whileHover={{ scale: 1.06, rotate: active ? 0 : -2 }}
      whileTap={{ scale: 0.94 }}
    >
      <motion.span
        className="absolute inset-[-40%] opacity-60"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${color}55, transparent 32%)`,
        }}
        animate={active || variant === "loading" ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 2.8, repeat: active || variant === "loading" ? Infinity : 0, ease: "linear" }}
      />
      <motion.span
        className="absolute inset-[2px] rounded-[14px]"
        style={{ background: "rgba(7,7,16,0.72)", backdropFilter: "blur(12px)" }}
      />
      <motion.span
        className="absolute h-1/2 w-1/2 rounded-full blur-md opacity-50"
        style={{ background: color }}
        animate={{ x: [0, 5, -3, 0], y: [0, -4, 3, 0], scale: [0.9, 1.15, 0.95, 0.9] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <Icon size={iconSize} style={{ color }} className="relative z-10" strokeWidth={2} />
    </motion.span>
  );
}
