"use client";

import { motion } from "framer-motion";
import { Link, Loader2, Search, RotateCcw, Command } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import MotionGlyph from "./MotionGlyph";

export default function UrlImportBar() {
  const { accentColor, glowColor } = useEmotion();
  const { urlInput, setUrlInput, importProblem, problemLoading, problemError, currentProblem, resetWorkspace } = useCodingStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) importProblem(urlInput.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col sm:flex-row sm:items-center gap-2">
      <motion.div
        className="group relative flex-1 min-w-0 overflow-hidden rounded-2xl"
        animate={{ boxShadow: problemLoading ? `0 0 34px -14px ${glowColor}` : `0 0 0px ${glowColor}` }}
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
          border: `1px solid ${problemError ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.095)"}`,
          backdropFilter: "blur(30px) saturate(170%)",
        }}
      >
        <motion.div
          className="absolute inset-y-0 left-0 w-24 opacity-0 group-focus-within:opacity-100"
          style={{ background: `linear-gradient(90deg, ${accentColor}20, transparent)` }}
        />
        {problemLoading && (
          <motion.div
            className="absolute bottom-0 left-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
            initial={{ x: "-100%", width: "45%" }}
            animate={{ x: "240%" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="relative flex items-center gap-2 px-3 py-2.5">
          <MotionGlyph variant="import" color={accentColor} size="sm" active={problemLoading} />
          <Link size={13} className="text-text-muted shrink-0 hidden sm:block" />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a LeetCode / NeetCode problem URL..."
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-ghost outline-none"
            disabled={problemLoading}
          />
          <div className="hidden md:flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] px-1.5 py-1 text-[9px] text-text-ghost">
            <Command size={9} /> URL
          </div>
          {problemLoading && <Loader2 size={14} className="animate-spin" style={{ color: accentColor }} />}
        </div>
      </motion.div>

      <div className="flex items-center gap-2 shrink-0">
        <motion.button
          type="submit"
          disabled={!urlInput.trim() || problemLoading}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
            border: `1px solid ${accentColor}55`,
            color: "#fff",
            boxShadow: `0 14px 34px -20px ${glowColor}`,
          }}
        >
          <Search size={14} />
          <span className="hidden sm:inline">Import</span>
        </motion.button>

        {currentProblem && (
          <motion.button
            type="button"
            onClick={resetWorkspace}
            whileHover={{ scale: 1.02, rotate: -5 }}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center justify-center rounded-2xl px-3 py-2.5 text-[12px] font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.55)" }}
          >
            <RotateCcw size={14} />
          </motion.button>
        )}
      </div>

      {problemError && (
        <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-red-300/85 shrink-0">
          {problemError}
        </motion.span>
      )}
    </form>
  );
}
