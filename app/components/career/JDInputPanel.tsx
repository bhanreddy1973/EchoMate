"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Link2, Search, Loader2, Sparkles, Clock, Wand2, Globe, ArrowRight, FileCode2, Upload, X, FilePlus2 } from "lucide-react";
import { useCareerStore } from "@/store/careerStore";
import { useEmotion } from "@/context/EmotionContext";

export default function JDInputPanel() {
  const { accentColor } = useEmotion();
  const {
    jdInput, setJdInput, jdUrl, setJdUrl, jdUrlLoading,
    analyzing, analyzeJd, masterResume, parsedJd,
    scrapeJdUrl, autoGenerateFromJd, autoGenerating, filesUsed, totalFilesScanned,
    uploadedFiles, addUploadedFile, removeUploadedFile,
  } = useCareerStore();

  const [mode, setMode] = useState<"url" | "paste">("url");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jdHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("echomate:jd-history") || "[]");
    } catch { return []; }
  });

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const file of arr) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "tex" && ext !== "md" && ext !== "txt") continue;
      const content = await file.text();
      addUploadedFile({
        filename: file.name,
        content,
        type: ext === "tex" ? "tex" : "md",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleScrapeUrl = () => {
    if (!jdUrl.trim()) return;
    scrapeJdUrl(jdUrl.trim());
  };

  const handleAnalyze = () => {
    if (!jdInput.trim() || !masterResume) return;
    // Save to history
    try {
      const history = JSON.parse(localStorage.getItem("echomate:jd-history") || "[]");
      const updated = [jdInput.slice(0, 200), ...history.filter((h: string) => h !== jdInput.slice(0, 200))].slice(0, 5);
      localStorage.setItem("echomate:jd-history", JSON.stringify(updated));
    } catch { /* ignore */ }
    analyzeJd();
  };

  const handleAutoGenerate = () => {
    if (!jdInput.trim() && !parsedJd) return;
    autoGenerateFromJd();
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
          <FileText size={14} style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary">Job Description</h3>
          <p className="text-[10px] text-text-muted">Paste a link or text to get started</p>
        </div>
      </div>

      {/* ── Resume Files Upload ─────────────────────────────── */}
      <div className="mb-3 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Resume Files</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-colors"
            style={{ color: accentColor, border: `1px solid ${accentColor}30`, background: `${accentColor}08` }}
          >
            <FilePlus2 size={9} /> Add Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tex,.md,.txt"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Drop zone / file list */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => uploadedFiles.length === 0 && fileInputRef.current?.click()}
          className="relative rounded-xl transition-all overflow-hidden"
          style={{
            background: dragging ? `${accentColor}10` : "rgba(255,255,255,0.02)",
            border: dragging ? `1.5px dashed ${accentColor}` : "1.5px dashed rgba(255,255,255,0.12)",
            cursor: uploadedFiles.length === 0 ? "pointer" : "default",
            minHeight: uploadedFiles.length === 0 ? 56 : "auto",
          }}
        >
          {uploadedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-3 gap-1">
              <Upload size={14} style={{ color: dragging ? accentColor : "rgba(255,255,255,0.25)" }} />
              <p className="text-[10px] text-text-ghost text-center">
                Drop your <span style={{ color: accentColor }}>.tex</span> or <span style={{ color: accentColor }}>.md</span> resume files here
              </p>
            </div>
          ) : (
            <div className="p-2 flex flex-wrap gap-1.5">
              {uploadedFiles.map((f) => (
                <div
                  key={f.filename}
                  className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg"
                  style={{
                    background: f.type === "tex" ? "rgba(96,165,250,0.10)" : "rgba(167,139,250,0.10)",
                    border: `1px solid ${f.type === "tex" ? "rgba(96,165,250,0.25)" : "rgba(167,139,250,0.25)"}`,
                  }}
                >
                  <FileCode2 size={9} style={{ color: f.type === "tex" ? "#60a5fa" : "#a78bfa" }} />
                  <span className="text-[9px] max-w-[90px] truncate" style={{ color: f.type === "tex" ? "#60a5fa" : "#a78bfa" }}>
                    {f.filename}
                  </span>
                  <button
                    onClick={() => removeUploadedFile(f.filename)}
                    className="ml-0.5 hover:text-red-400 transition-colors"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <X size={8} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] transition-colors hover:bg-white/5"
                style={{ color: accentColor, border: `1px dashed ${accentColor}30` }}
              >
                <Upload size={8} /> Add more
              </button>
            </div>
          )}
        </div>
        {uploadedFiles.length > 0 && (
          <p className="text-[9px] text-text-ghost mt-1 px-0.5">
            {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""} · These are used as primary source for generation
          </p>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 mb-3 shrink-0 p-0.5 rounded-lg"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => setMode("url")}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all"
          style={mode === "url" ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` } : { color: "rgba(255,255,255,0.4)" }}>
          <Globe size={10} /> Paste URL
        </button>
        <button onClick={() => setMode("paste")}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all"
          style={mode === "paste" ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` } : { color: "rgba(255,255,255,0.4)" }}>
          <FileText size={10} /> Paste Text
        </button>
      </div>

      {/* URL input mode */}
      {mode === "url" && (
        <div className="mb-3 shrink-0 space-y-2">
          <div className="flex items-center gap-2 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="pl-3">
              <Link2 size={13} className="text-text-ghost" />
            </div>
            <input
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrapeUrl()}
              placeholder="https://linkedin.com/jobs/view/... or any job URL"
              className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none py-2.5"
            />
            <button
              onClick={handleScrapeUrl}
              disabled={!jdUrl.trim() || jdUrlLoading}
              className="flex items-center gap-1 px-3 py-2 text-[10px] font-medium text-white transition-all disabled:opacity-40"
              style={{ background: accentColor }}
            >
              {jdUrlLoading ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
              {jdUrlLoading ? "Scraping..." : "Fetch"}
            </button>
          </div>
          <p className="text-[9px] text-text-ghost px-1">
            Supports: LinkedIn, Greenhouse, Lever, Workday, or any job posting URL
          </p>
        </div>
      )}

      {/* Parsed JD summary (after scraping or analysis) */}
      <AnimatePresence>
        {parsedJd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2.5 rounded-xl shrink-0"
            style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={11} style={{ color: accentColor }} />
              <span className="text-[11px] font-medium" style={{ color: accentColor }}>
                {jdUrlLoading ? "Scraping..." : "JD Extracted"}
              </span>
            </div>
            {parsedJd.role && <p className="text-[12px] text-text-primary font-medium">{parsedJd.role} at {parsedJd.company}</p>}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {parsedJd.requiredSkills?.slice(0, 6).map((skill: string, i: number) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                  {skill}
                </span>
              ))}
              {(parsedJd.requiredSkills?.length || 0) > 6 && (
                <span className="text-[9px] text-text-ghost">+{parsedJd.requiredSkills.length - 6} more</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea (always visible, filled by scraper or manual paste) */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <textarea
          value={jdInput}
          onChange={(e) => setJdInput(e.target.value)}
          placeholder={mode === "url"
            ? "Job description text will appear here after scraping the URL..."
            : "Paste the full job description here...\n\nExample:\nWe're looking for a Senior Software Engineer with experience in React, TypeScript, and cloud infrastructure..."
          }
          className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none resize-none p-3 leading-relaxed"
        />

        {/* Bottom toolbar */}
        <div className="flex items-center gap-2 p-2.5 border-t border-white/5 flex-wrap">
          <span className="text-[10px] text-text-muted">
            {jdInput.length > 0 ? `${jdInput.split(/\s+/).length} words` : ""}
          </span>

          <div className="flex-1" />

          {/* Analyze button (needs resume data) */}
          {masterResume && (
            <button
              onClick={handleAnalyze}
              disabled={!jdInput.trim() || analyzing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-40"
              style={{ color: accentColor, border: `1px solid ${accentColor}30`, background: `${accentColor}08` }}
            >
              {analyzing ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
              Analyze Fit
            </button>
          )}

          {/* Auto-generate button (main action — searches files & builds resume) */}
          <button
            onClick={handleAutoGenerate}
            disabled={(!jdInput.trim() && !parsedJd) || autoGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: accentColor, boxShadow: `0 0 12px ${accentColor}40` }}
          >
            {autoGenerating ? (
              <><Loader2 size={11} className="animate-spin" /> Generating...</>
            ) : (
              <><Wand2 size={11} /> Auto-Generate Resume</>
            )}
          </button>
        </div>
      </div>

      {/* Files used info */}
      <AnimatePresence>
        {filesUsed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-2.5 rounded-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileCode2 size={10} style={{ color: accentColor }} />
              <span className="text-[10px] font-medium text-text-secondary">
                Scanned {totalFilesScanned} files · Used {filesUsed.length} most relevant
              </span>
            </div>
            <div className="space-y-0.5">
              {filesUsed.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px]">
                  <span className="w-4 text-right text-text-ghost">{f.score}</span>
                  <div className="w-1 h-1 rounded-full" style={{ background: f.type === "tex" ? "#60a5fa" : "#a78bfa" }} />
                  <span className="text-text-muted truncate">{f.filename}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No resume warning (only for Analyze flow) */}
      {!masterResume && jdInput && (
        <div className="mt-2 px-3 py-2 rounded-lg text-[10px] text-text-muted"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          💡 <strong>Auto-Generate</strong> works without importing — it searches your local .tex and .md files directly.
          Use <strong>Analyze Fit</strong> if you want detailed scoring (requires resume data in My Resume tab).
        </div>
      )}

      {/* History */}
      {jdHistory.length > 0 && !jdInput && mode === "paste" && (
        <div className="mt-3 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock size={10} className="text-text-muted" />
            <span className="text-[10px] text-text-muted">Recent</span>
          </div>
          <div className="space-y-1">
            {jdHistory.slice(0, 3).map((h, i) => (
              <button key={i} onClick={() => setJdInput(h)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] text-text-secondary truncate transition-colors hover:bg-white/[0.04]"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                {h.slice(0, 80)}...
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
