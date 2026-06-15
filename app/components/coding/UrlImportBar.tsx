"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, Loader2, Search, RotateCcw, Command, History, X, ExternalLink } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import MotionGlyph from "./MotionGlyph";

const URL_HISTORY_KEY = "echomate:url-history";
const MAX_HISTORY = 20;

interface HistoryEntry {
  url: string;
  title?: string;
  importedAt: string;
}

function getUrlHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(URL_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUrlToHistory(url: string, title?: string) {
  const history = getUrlHistory().filter((h) => h.url !== url);
  history.unshift({ url, title, importedAt: new Date().toISOString() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(history));
}

export default function UrlImportBar() {
  const { accentColor, glowColor } = useEmotion();
  const { urlInput, setUrlInput, importProblem, problemLoading, problemError, currentProblem, resetWorkspace } = useCodingStore();
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(getUrlHistory());
  }, []);

  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  useEffect(() => {
    if (currentProblem && urlInput) {
      saveUrlToHistory(urlInput, currentProblem.title);
      setHistory(getUrlHistory());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProblem?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) importProblem(urlInput.trim());
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setUrlInput(entry.url);
    setShowHistory(false);
    importProblem(entry.url);
  };

  const clearHistory = () => {
    localStorage.removeItem(URL_HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex min-w-0 items-center gap-2">
        {/* URL Input */}
        <motion.div
          className="group relative flex-1 min-w-0 overflow-hidden rounded-2xl"
          animate={{ boxShadow: problemLoading ? `0 0 34px -14px ${glowColor}` : `0 0 0px ${glowColor}` }}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
            border: `1px solid ${problemError ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.095)"}`,
            backdropFilter: "blur(30px) saturate(170%)",
          }}
        >
          {problemLoading && (
            <motion.div
              className="absolute bottom-0 left-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
              initial={{ x: "-100%", width: "45%" }}
              animate={{ x: "240%" }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="relative flex items-center gap-2 px-3 py-2">
            <MotionGlyph variant="import" color={accentColor} size="sm" active={problemLoading} />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste a LeetCode / NeetCode problem URL..."
              className="min-w-0 flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none"
              disabled={problemLoading}
            />
            {problemLoading && <Loader2 size={13} className="animate-spin" style={{ color: accentColor }} />}
          </div>
        </motion.div>

        {/* History button (replaces Import) */}
        <motion.button
          type={urlInput.trim() ? "submit" : "button"}
          onClick={urlInput.trim() ? undefined : () => setShowHistory((v) => !v)}
          disabled={problemLoading}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-40"
          style={{
            background: urlInput.trim() ? `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)` : "rgba(255,255,255,0.05)",
            border: urlInput.trim() ? `1px solid ${accentColor}55` : "1px solid rgba(255,255,255,0.09)",
          }}
          title={urlInput.trim() ? "Import URL" : "View history"}
        >
          {urlInput.trim() ? (
            <Search size={14} className="text-white" />
          ) : (
            <History size={14} className={showHistory ? "text-white/80" : "text-white/45"} />
          )}
        </motion.button>

        {currentProblem && (
          <motion.button
            type="button"
            onClick={resetWorkspace}
            whileHover={{ scale: 1.04, rotate: -8 }}
            whileTap={{ scale: 0.94 }}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            title="Reset workspace"
          >
            <RotateCcw size={13} className="text-white/45" />
          </motion.button>
        )}
      </form>

      {problemError && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-red-300/80 mt-1.5 px-1">
          {problemError}
        </motion.p>
      )}

      {/* History Dropdown */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
            style={{
              background: "rgba(12,12,20,0.97)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(30px)",
              boxShadow: "0 16px 50px -10px rgba(0,0,0,0.7)",
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <History size={11} style={{ color: accentColor }} />
                <span className="text-[10px] font-semibold text-white/70">Recent Problems</span>
              </div>
              <button onClick={clearHistory} className="text-[9px] text-white/30 hover:text-red-300/70 px-1.5 py-0.5 rounded transition-colors">
                Clear
              </button>
            </div>
            <div className="max-h-[200px] overflow-y-auto py-1">
              {history.map((entry, i) => (
                <button
                  key={`${entry.url}-${i}`}
                  type="button"
                  onClick={() => handleHistorySelect(entry)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition-colors text-left"
                >
                  <ExternalLink size={10} className="text-white/25 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {entry.title && <p className="text-[10px] font-medium text-white/70 truncate">{entry.title}</p>}
                    <p className="text-[9px] text-white/30 truncate">{entry.url.replace("https://", "")}</p>
                  </div>
                  <span className="text-[8px] text-white/20 shrink-0">
                    {new Date(entry.importedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty history state */}
      <AnimatePresence>
        {showHistory && history.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl p-4 text-center"
            style={{ background: "rgba(12,12,20,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <History size={16} className="mx-auto mb-2 text-white/20" />
            <p className="text-[10px] text-white/35">No import history yet</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
