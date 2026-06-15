"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, GitBranch, Settings, Home, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import AmbientBackground from "@/components/background/AmbientBackground";
import MarkdownRenderer from "@/components/chat/MarkdownRenderer";
import Link from "next/link";

type DocFile = "WORKFLOW.md" | "SETUP.md" | "README.md";

const DOCS: { id: DocFile; label: string; icon: typeof BookOpen; description: string }[] = [
  { id: "README.md",   label: "Overview",  icon: BookOpen,   description: "Project summary, architecture, tech stack" },
  { id: "WORKFLOW.md", label: "Workflow",  icon: GitBranch,  description: "Section-by-section system diagrams" },
  { id: "SETUP.md",    label: "Setup",     icon: Settings,   description: "Installation, configuration, usage guide" },
];

export default function DocsPage() {
  const [active, setActive] = useState<DocFile>("WORKFLOW.md");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent("");

    fetch(`/api/docs?file=${active}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [active]);

  const activeDoc = DOCS.find((d) => d.id === active)!;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <AmbientBackground />

      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]"
        style={{ background: "rgba(4,4,10,0.7)", backdropFilter: "blur(30px)" }}>
        <Link href="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-white/[0.07]"
          style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Home size={13} />
          <span>App</span>
        </Link>
        <ChevronRight size={12} className="text-white/20" />
        <div className="flex items-center gap-2">
          <activeDoc.icon size={14} className="text-violet-400" />
          <span className="text-[13px] font-semibold text-white/90">EchoMate Docs</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {DOCS.map((doc) => {
            const Icon = doc.icon;
            const isActive = doc.id === active;
            return (
              <button
                key={doc.id}
                onClick={() => setActive(doc.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200"
                style={isActive ? {
                  background: "rgba(139,92,246,0.18)",
                  color: "#a78bfa",
                  border: "1px solid rgba(139,92,246,0.3)",
                } : {
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid transparent",
                }}
              >
                <Icon size={12} strokeWidth={2} />
                <span>{doc.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Content area */}
      <div className="absolute inset-0 pt-[64px] flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex flex-col gap-2 p-4 border-r border-white/[0.06] overflow-y-auto"
          style={{ background: "rgba(8,8,18,0.6)", backdropFilter: "blur(20px)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-1 mb-1">Documents</p>
          {DOCS.map((doc) => {
            const Icon = doc.icon;
            const isActive = doc.id === active;
            return (
              <button
                key={doc.id}
                onClick={() => setActive(doc.id)}
                className="flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-200 hover:bg-white/[0.04]"
                style={isActive ? {
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.25)",
                } : {
                  border: "1px solid transparent",
                }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isActive ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                    border: isActive ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                  }}>
                  <Icon size={13} style={{ color: isActive ? "#a78bfa" : "rgba(255,255,255,0.4)" }} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium" style={{ color: isActive ? "#e2d9f8" : "rgba(255,255,255,0.7)" }}>
                    {doc.label}
                  </p>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {doc.description}
                  </p>
                </div>
              </button>
            );
          })}

          <div className="mt-auto pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/25 px-1">Source files at project root</p>
            {DOCS.map((doc) => (
              <div key={doc.id}
                className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-mono"
                style={{ color: "rgba(255,255,255,0.25)" }}>
                <ExternalLink size={9} />
                {doc.id}
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="text-violet-400 animate-spin" />
                  <p className="text-[13px] text-white/40">Loading {active}…</p>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center h-full">
                <div className="text-center space-y-2">
                  <p className="text-[14px] text-red-300">Failed to load {active}</p>
                  <p className="text-[12px] text-white/30">{error}</p>
                  <p className="text-[11px] text-white/20">Make sure the Next.js server can read files from the project root.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="max-w-4xl mx-auto px-8 py-10">
                <MarkdownRenderer content={content} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
