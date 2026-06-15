"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, FileCode2, Download, Eye, Trash2, Clock, Shield, FolderOpen, ChevronRight } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCareerStore } from "@/store/careerStore";
import { ResumeHistory, RESUME_CATEGORIES, ResumeCategory } from "@/types/career";

export default function ResumeHistoryPanel() {
  const { accentColor } = useEmotion();
  const { setGeneratedLatex, setActivePanel } = useCareerStore();
  const [history, setHistory] = useState<ResumeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"all" | "category">("category");
  const [selectedCategory, setSelectedCategory] = useState<ResumeCategory | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/career/tracker?type=history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const deleteEntry = async (id: string) => {
    await fetch("/api/career/tracker", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "history" }),
    });
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const loadResume = (entry: ResumeHistory) => {
    setGeneratedLatex(entry.latex);
    setActivePanel("resume");
  };

  const downloadResume = (entry: ResumeHistory) => {
    const blob = new Blob([entry.latex], { type: "application/x-tex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group by category
  const grouped = RESUME_CATEGORIES.map((cat) => ({
    ...cat,
    resumes: history.filter((h) => (h.category || "other") === cat.id),
  })).filter((g) => g.resumes.length > 0);

  const displayHistory = selectedCategory
    ? history.filter((h) => (h.category || "other") === selectedCategory)
    : history;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Clock size={16} className="animate-spin text-text-ghost" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <History size={14} style={{ color: accentColor }} />
        <h3 className="text-[13px] font-semibold text-text-primary">Resume History</h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: `${accentColor}15`, color: accentColor }}>{history.length} resumes</span>
        <div className="flex-1" />
        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setViewMode("category"); setSelectedCategory(null); }}
            className="px-2 py-1 rounded-md text-[9px] font-medium transition-all"
            style={viewMode === "category" ? { background: `${accentColor}15`, color: accentColor } : { color: "rgba(255,255,255,0.4)" }}>
            Categories
          </button>
          <button onClick={() => { setViewMode("all"); setSelectedCategory(null); }}
            className="px-2 py-1 rounded-md text-[9px] font-medium transition-all"
            style={viewMode === "all" ? { background: `${accentColor}15`, color: accentColor } : { color: "rgba(255,255,255,0.4)" }}>
            All
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <FileCode2 size={24} className="text-text-ghost" />
          <p className="text-[11px] text-text-muted">Generated resumes will appear here</p>
          <p className="text-[9px] text-text-ghost">Organized by category: SDE, ML/AI, Backend, etc.</p>
        </div>
      ) : viewMode === "category" && !selectedCategory ? (
        /* Category grid view */
        <div className="flex-1 overflow-y-auto space-y-2">
          {grouped.map((group) => (
            <motion.button
              key={group.id}
              layout
              onClick={() => setSelectedCategory(group.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:bg-white/[0.03]"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${group.color}12`, border: `1px solid ${group.color}20` }}>
                <FolderOpen size={16} style={{ color: group.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-text-primary">{group.label}</p>
                <p className="text-[10px] text-text-muted">{group.resumes.length} resume{group.resumes.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium" style={{ color: group.color }}>{group.resumes.length}</span>
                <ChevronRight size={12} className="text-text-ghost" />
              </div>
            </motion.button>
          ))}

          {/* Storage info */}
          <div className="mt-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[9px] text-text-ghost leading-relaxed">
              📁 Resumes are stored in <code className="text-text-muted">data/resumes/&lt;category&gt;/</code> as .tex files.<br/>
              Each category has its own folder for easy management.
            </p>
          </div>
        </div>
      ) : (
        /* Resume list view (all or filtered by category) */
        <div className="flex-1 overflow-y-auto space-y-2">
          {/* Back button when viewing category */}
          {selectedCategory && (
            <button onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-1.5 text-[10px] mb-2 px-2 py-1 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: accentColor }}>
              ← Back to categories
            </button>
          )}

          {displayHistory.map((entry) => {
            const catConfig = RESUME_CATEGORIES.find((c) => c.id === (entry.category || "other")) || RESUME_CATEGORIES[RESUME_CATEGORIES.length - 1];
            return (
              <motion.div key={entry.id} layout
                className="p-3 rounded-xl group"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${catConfig.color}12` }}>
                    <FileCode2 size={14} style={{ color: catConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-medium text-text-primary truncate">{entry.company}</p>
                      <div className="flex items-center gap-0.5">
                        <Shield size={8} style={{ color: entry.atsScore >= 70 ? "#34d399" : "#fbbf24" }} />
                        <span className="text-[9px] font-medium" style={{ color: entry.atsScore >= 70 ? "#34d399" : "#fbbf24" }}>{entry.atsScore}%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted truncate">{entry.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${catConfig.color}12`, color: catConfig.color }}>{catConfig.label}</span>
                      <span className="text-[8px] text-text-ghost">{new Date(entry.createdAt).toLocaleDateString()}</span>
                      <span className="text-[8px] text-text-ghost">{entry.filesUsed?.length || 0} sources</span>
                    </div>
                    {entry.keywords && entry.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1.5">
                        {entry.keywords.slice(0, 5).map((kw, i) => (
                          <span key={i} className="text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => loadResume(entry)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.08)" }} title="Load in editor">
                      <Eye size={10} style={{ color: accentColor }} />
                    </button>
                    <button onClick={() => downloadResume(entry)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.08)" }} title="Download .tex">
                      <Download size={10} className="text-text-muted" />
                    </button>
                    <button onClick={() => deleteEntry(entry.id)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.08)" }} title="Delete">
                      <Trash2 size={10} className="text-red-400/50" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
