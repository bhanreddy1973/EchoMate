"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, RefreshCw, Shield, FileCode2, Loader2, Check, FileText, Wand2, Eye, Code2, Sparkles, ChevronDown, BookmarkPlus } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useCareerStore } from "@/store/careerStore";
import { useEmotion } from "@/context/EmotionContext";

export default function ResumeEditorPanel() {
  const { accentColor } = useEmotion();
  const {
    generatedLatex, setGeneratedLatex, atsScore, generating, autoGenerating,
    autoGenerateFromJd, parsedJd, filesUsed, totalFilesScanned,
    modelOutputs, selectedOutputIndex, setSelectedOutputIndex, addToTracker,
  } = useCareerStore();
  const editorRef = useRef<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Generate HTML preview from LaTeX using latex.js
  useEffect(() => {
    if (viewMode === "preview" && generatedLatex) {
      generatePreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, generatedLatex]);

  const generatePreview = async () => {
    if (!generatedLatex) return;
    setPreviewLoading(true);
    try {
      // Dynamic import latex.js (client-side only)
      const { parse, HtmlGenerator } = await import("latex.js");
      const generator = new HtmlGenerator({ hyphenate: false });
      const doc = parse(generatedLatex, { generator });
      const htmlDoc = doc.htmlDocument();
      
      // Serialize the document to string
      const serializer = new XMLSerializer();
      const html = serializer.serializeToString(htmlDoc);
      setPreviewHtml(html);
    } catch (err) {
      // latex.js may not support all packages — show a styled fallback
      console.warn("LaTeX preview error:", err);
      const fallbackHtml = `<!DOCTYPE html><html><head><style>
        body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.4; color: #333; background: #fff; }
        h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 14px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 2px; margin-top: 16px; text-transform: uppercase; }
        .contact { text-align: center; font-size: 11px; margin-bottom: 12px; }
        .entry { margin-bottom: 8px; }
        .entry-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; }
        .entry-sub { display: flex; justify-content: space-between; font-style: italic; font-size: 11px; }
        ul { margin: 4px 0; padding-left: 20px; font-size: 11px; }
        li { margin-bottom: 2px; }
        .skills { font-size: 11px; }
        .note { background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 16px; font-size: 11px; color: #856404; }
      </style></head><body>
        <div class="note">⚠️ Preview is approximate — your .tex file uses packages not supported by browser rendering. Download the .tex and compile with pdflatex for exact output.</div>
        <pre style="font-family: 'Courier New', monospace; font-size: 10px; white-space: pre-wrap; background: #f8f9fa; padding: 20px; border-radius: 4px;">${escapeHtml(generatedLatex)}</pre>
      </body></html>`;
      setPreviewHtml(fallbackHtml);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLatex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const role = parsedJd?.role?.replace(/\s+/g, "_").toLowerCase() || "tailored";
    const company = parsedJd?.company?.replace(/\s+/g, "_").toLowerCase() || "";
    const filename = company ? `resume_${company}_${role}.tex` : `resume_${role}.tex`;

    const blob = new Blob([generatedLatex], { type: "application/x-tex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  // Open in Overleaf for proper compilation
  const handleOpenOverleaf = () => {
    const encoded = encodeURIComponent(generatedLatex);
    window.open(`https://www.overleaf.com/docs?snip_uri=data:application/x-tex;base64,${btoa(unescape(encodeURIComponent(generatedLatex)))}`, "_blank");
  };

  if (!generatedLatex && !generating && !autoGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}20` }}>
          <FileCode2 size={28} style={{ color: accentColor, opacity: 0.6 }} />
        </div>
        <div>
          <p className="text-[13px] text-text-primary font-medium mb-1">Your tailored resume will appear here</p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Paste a job link → click <strong>Auto-Generate Resume</strong><br />
            The system scans your .tex and .md files, picks the most relevant content, and generates a tailored LaTeX resume.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-text-ghost">
          <FileText size={10} /> Works with your existing resume files
        </div>
      </div>
    );
  }

  if (generating || autoGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Wand2 size={24} style={{ color: accentColor }} />
        </motion.div>
        <div className="text-center">
          <p className="text-[13px] text-text-primary font-medium">Generating your resume...</p>
          <p className="text-[10px] text-text-muted mt-1">
            Scanning local files and tailoring to the job description
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" style={{ color: accentColor }} />
          <span className="text-[10px]" style={{ color: accentColor }}>
            {autoGenerating ? "Searching files & generating..." : "Generating LaTeX..."}
          </span>
        </div>
      </div>
    );
  }

  const handleSelectOutput = (i: number) => {
    setSelectedOutputIndex(i);
    setGeneratedLatex(modelOutputs[i].latex);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Multi-model comparison tabs */}
      {modelOutputs.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 shrink-0 overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.2)" }}>
          <Sparkles size={10} style={{ color: accentColor }} className="shrink-0" />
          <span className="text-[9px] text-text-ghost shrink-0 mr-1">Compare models:</span>
          {modelOutputs.map((output, i) => (
            <button
              key={output.model}
              onClick={() => handleSelectOutput(i)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all shrink-0"
              style={selectedOutputIndex === i ? {
                background: `${accentColor}15`,
                color: accentColor,
                border: `1px solid ${accentColor}30`,
              } : {
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span>{output.modelLabel}</span>
              <span className="px-1 py-0.5 rounded text-[8px] font-semibold"
                style={{
                  background: output.atsScore >= 70 ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)",
                  color: output.atsScore >= 70 ? "#34d399" : "#fbbf24",
                }}>
                {output.atsScore}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 shrink-0 flex-wrap">
        <FileCode2 size={13} style={{ color: accentColor }} />
        <span className="text-[11px] font-medium text-text-primary">
          {parsedJd?.company ? `resume_${parsedJd.company.toLowerCase().replace(/\s+/g, "_")}.tex` : "resume_tailored.tex"}
        </span>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 ml-2 p-0.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setViewMode("code")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-all"
            style={viewMode === "code" ? { background: `${accentColor}15`, color: accentColor } : { color: "rgba(255,255,255,0.4)" }}>
            <Code2 size={9} /> Code
          </button>
          <button onClick={() => setViewMode("preview")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium transition-all"
            style={viewMode === "preview" ? { background: `${accentColor}15`, color: accentColor } : { color: "rgba(255,255,255,0.4)" }}>
            <Eye size={9} /> Preview
          </button>
        </div>

        <div className="flex-1" />

        {/* ATS Badge */}
        {atsScore > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md"
            style={{ background: atsScore >= 70 ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)", border: `1px solid ${atsScore >= 70 ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}` }}>
            <Shield size={9} style={{ color: atsScore >= 70 ? "#34d399" : "#fbbf24" }} />
            <span className="text-[9px] font-medium" style={{ color: atsScore >= 70 ? "#34d399" : "#fbbf24" }}>ATS {atsScore}%</span>
          </div>
        )}

        {filesUsed.length > 0 && (
          <span className="text-[9px] text-text-ghost">
            {filesUsed.length}/{totalFilesScanned} files
          </span>
        )}

        <div className="w-px h-3.5 bg-white/10" />

        <button onClick={handleDownload}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all hover:scale-105"
          style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
          {downloaded ? <Check size={10} /> : <Download size={10} />}
          {downloaded ? "Done!" : ".tex"}
        </button>
        <button onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors hover:bg-white/5"
          style={{ color: copied ? "#34d399" : "rgba(255,255,255,0.5)" }}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
        </button>
        <button
          onClick={async () => { await addToTracker(); setTracked(true); setTimeout(() => setTracked(false), 2500); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
          style={tracked
            ? { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.30)" }
            : { color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {tracked ? <><Check size={10} /> Tracked!</> : <><BookmarkPlus size={10} /> Track</>}
        </button>
        <button onClick={handleOpenOverleaf}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/5"
          style={{ color: "#47a141" }}>
          Open in Overleaf
        </button>
        <button onClick={autoGenerateFromJd}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors hover:bg-white/5"
          style={{ color: accentColor }}>
          <RefreshCw size={10} />
        </button>
      </div>

      {/* Source files banner */}
      <AnimatePresence>
        {filesUsed.length > 0 && viewMode === "code" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="px-3 py-1.5 border-b border-white/5 overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-[9px] text-text-ghost shrink-0">Sources:</span>
              {filesUsed.slice(0, 6).map((f, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: f.type === "tex" ? "rgba(96,165,250,0.10)" : "rgba(167,139,250,0.10)", color: f.type === "tex" ? "#60a5fa" : "#a78bfa", border: `1px solid ${f.type === "tex" ? "rgba(96,165,250,0.20)" : "rgba(167,139,250,0.20)"}` }}>
                  {f.filename}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {viewMode === "code" ? (
          <Editor
            height="100%"
            defaultLanguage="latex"
            theme="vs-dark"
            value={generatedLatex}
            onChange={(value) => setGeneratedLatex(value || "")}
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              fontSize: 12,
              minimap: { enabled: false },
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              renderLineHighlight: "gutter",
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full w-full relative">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "rgba(0,0,0,0.5)" }}>
                <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
              </div>
            )}
            {previewHtml ? (
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                className="w-full h-full border-none bg-white rounded-b-lg"
                title="Resume Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[11px] text-text-muted">Click Preview to render the LaTeX</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
