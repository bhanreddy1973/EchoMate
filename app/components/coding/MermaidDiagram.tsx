"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Maximize2 } from "lucide-react";
import mermaid from "mermaid";
import { useEmotion } from "@/context/EmotionContext";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    background: "transparent",
    primaryColor: "#151527",
    primaryTextColor: "#f8fafc",
    primaryBorderColor: "rgba(255,255,255,0.22)",
    lineColor: "rgba(255,255,255,0.55)",
    secondaryColor: "#0f172a",
    tertiaryColor: "#111827",
    fontFamily: "Inter, system-ui, sans-serif",
    nodeBorder: "rgba(255,255,255,0.24)",
    clusterBkg: "rgba(255,255,255,0.045)",
    clusterBorder: "rgba(255,255,255,0.12)",
    edgeLabelBackground: "#0b0b14",
  },
});

export default function MermaidDiagram({ chart }: { chart: string }) {
  const { accentColor, glowColor } = useEmotion();
  const rawId = useId();
  const diagramId = useMemo(() => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [rawId]);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setError(null);
        const { svg: renderedSvg } = await mermaid.render(diagramId, chart.trim());
        if (!cancelled) setSvg(renderedSvg);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to render Mermaid diagram");
          setSvg("");
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart, diagramId]);

  const copySource = async () => {
    await navigator.clipboard.writeText(chart.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="not-prose my-3 overflow-hidden rounded-2xl border border-white/10 bg-[#070711]/90"
      style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 34px -24px ${glowColor}` }}
    >
      <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.035] px-3 py-2">
        <div className="flex items-center gap-2">
          <Maximize2 size={11} style={{ color: accentColor }} />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-ghost">Mermaid visual</span>
        </div>
        <motion.button
          type="button"
          onClick={copySource}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.94 }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.045] px-2 py-1 text-[9px] font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          {copied ? <Check size={10} className="text-emerald-300" /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy source"}
        </motion.button>
      </div>

      <div className="relative min-h-[180px] overflow-auto p-4">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(${accentColor}33 1px, transparent 1px), linear-gradient(90deg, ${accentColor}33 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        {error ? (
          <div className="relative rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-[11px] leading-relaxed text-red-200/80">
            Mermaid render error. Ask the coach to regenerate a valid Mermaid diagram.
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-red-100/65">{error}</pre>
          </div>
        ) : svg ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative min-w-[320px] [&_svg]:mx-auto [&_svg]:max-w-none [&_svg]:rounded-xl"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="relative flex min-h-[140px] items-center justify-center text-[11px] text-text-ghost">
            Rendering diagram...
          </div>
        )}
      </div>
    </div>
  );
}
