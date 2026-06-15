"use client";

import { motion } from "framer-motion";
import { Code2, Zap, Brain, BarChart3, ArrowUpRight } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import MotionGlyph from "./MotionGlyph";
import CodingStats from "./CodingStats";

export default function WelcomeState() {
  const { accentColor, glowColor } = useEmotion();
  const { setUrlInput, importProblem } = useCodingStore();

  const features = [
    { icon: Code2, glyph: "code" as const, title: "Multi-language editor", desc: "Python, JS, TS, Java, C++, Go, Rust, C#" },
    { icon: Zap, glyph: "run" as const, title: "Judge0 execution", desc: "Run code with compile/runtime feedback" },
    { icon: Brain, glyph: "coach" as const, title: "NVIDIA AI Coach", desc: "Hints, debugging, dry-runs, validation" },
    { icon: BarChart3, glyph: "progress" as const, title: "Progress memory", desc: "Track weak topics and coding style" },
  ];

  return (
    <motion.div className="relative flex-1 flex items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
      <div className="relative max-w-3xl w-full text-center space-y-8 px-2">
        <motion.div
          className="mx-auto relative w-28 h-28 rounded-[32px] flex items-center justify-center"
          style={{ background: `radial-gradient(circle at 30% 20%, ${accentColor}35, rgba(255,255,255,0.035))`, border: `1px solid ${accentColor}35`, boxShadow: `0 0 80px -14px ${glowColor}` }}
          animate={{ y: [0, -8, 0], rotate: [0, 2, 0, -2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div className="absolute inset-[-2px] rounded-[34px]" style={{ background: `conic-gradient(from 0deg, transparent, ${accentColor}80, transparent 30%)` }} animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
          <div className="absolute inset-[2px] rounded-[30px] bg-surface-0/80 backdrop-blur-xl" />
          <Code2 size={38} style={{ color: accentColor }} className="relative z-10" />
        </motion.div>

        <div className="space-y-3">
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-[26px] sm:text-[34px] font-semibold text-text-primary tracking-[-0.04em]">
            Coding Workspace
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="text-[13px] text-text-muted leading-relaxed max-w-xl mx-auto">
            Paste a problem URL to open an animated coding cockpit: problem details, Monaco editor, Judge0 runner, AI coach, and progress memory in one EchoMate-native glass interface.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="group relative overflow-hidden rounded-3xl p-4 text-left glass-specular"
              style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.075)" }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.06 }}
              whileHover={{ y: -4, scale: 1.015 }}
            >
              <MotionGlyph variant={f.glyph} color={accentColor} size="md" />
              <p className="text-[12px] font-semibold text-text-primary mt-3">{f.title}</p>
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium">Try a sample problem</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["leetcode.com/problems/two-sum", "leetcode.com/problems/valid-parentheses", "leetcode.com/problems/merge-two-sorted-lists"].map((url, i) => (
              <motion.button
                key={url}
                onClick={() => { setUrlInput(`https://${url}/`); importProblem(`https://${url}/`); }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.06 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {url.split("/problems/")[1]}
                <ArrowUpRight size={10} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Coding Stats & Progress */}
        <CodingStats />
      </div>
    </motion.div>
  );
}
