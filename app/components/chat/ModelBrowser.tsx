"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Brain, Check, ChevronDown, Code2, Cpu, Gauge, Globe2, Image, Mic, Search, Sparkles, Star, Zap } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

export type ChatModelTier = "auto" | "fast" | "reasoning" | "creative" | "technical" | "voice" | "image";

type Provider = "NVIDIA" | "OpenAI" | "Anthropic" | "Google" | "OpenRouter";

type ModelOption = {
  id: ChatModelTier;
  provider: Provider;
  name: string;
  shortName: string;
  description: string;
  bestFor: string[];
  effectiveness: number;
  latency: "Low" | "Medium" | "High";
  configured: boolean;
  color: string;
  icon: React.ElementType;
};

const MODELS: ModelOption[] = [
  {
    id: "auto",
    provider: "NVIDIA",
    name: "Auto Router",
    shortName: "Auto",
    description: "EchoMate picks the best available model for the prompt.",
    bestFor: ["general chat", "balanced cost", "fallbacks"],
    effectiveness: 92,
    latency: "Medium",
    configured: true,
    color: "#06b6d4",
    icon: Zap,
  },
  {
    id: "fast",
    provider: "NVIDIA",
    name: "Fast NIM",
    shortName: "Fast",
    description: "Low-latency model for quick answers and short tasks.",
    bestFor: ["quick Q&A", "summaries", "simple edits"],
    effectiveness: 78,
    latency: "Low",
    configured: true,
    color: "#10b981",
    icon: Gauge,
  },
  {
    id: "reasoning",
    provider: "NVIDIA",
    name: "Deep Reasoning",
    shortName: "Deep Think",
    description: "Larger reasoning model for hard planning, debugging, and analysis.",
    bestFor: ["complex reasoning", "architecture", "multi-step debugging"],
    effectiveness: 96,
    latency: "High",
    configured: true,
    color: "#f59e0b",
    icon: Brain,
  },
  {
    id: "technical",
    provider: "OpenRouter",
    name: "Code Specialist",
    shortName: "Code",
    description: "Coding-focused route for implementation, refactors, and explanations.",
    bestFor: ["code generation", "debugging", "algorithms"],
    effectiveness: 94,
    latency: "Medium",
    configured: true,
    color: "#3b82f6",
    icon: Code2,
  },
  {
    id: "creative",
    provider: "Anthropic",
    name: "Claude-style Creative",
    shortName: "Creative",
    description: "Long-form writing, ideation, UX copy, and structured thinking.",
    bestFor: ["writing", "brainstorming", "product thinking"],
    effectiveness: 88,
    latency: "Medium",
    configured: false,
    color: "#8b5cf6",
    icon: Star,
  },
  {
    id: "voice",
    provider: "NVIDIA",
    name: "Voice Companion",
    shortName: "Voice",
    description: "Voice-optimized mode for Spatial/LiveKit conversations.",
    bestFor: ["voice chat", "short spoken replies", "assistant mode"],
    effectiveness: 82,
    latency: "Low",
    configured: true,
    color: "#76b900",
    icon: Mic,
  },
  {
    id: "image",
    provider: "Google",
    name: "Vision/Image Mode",
    shortName: "Image",
    description: "Image understanding/generation route when image providers are configured.",
    bestFor: ["image prompts", "visual analysis", "creative assets"],
    effectiveness: 80,
    latency: "High",
    configured: false,
    color: "#ec4899",
    icon: Image,
  },
];

interface Props {
  selectedTier: ChatModelTier;
  onChange: (tier: ChatModelTier) => void;
}

export default function ModelBrowser({ selectedTier, onChange }: Props) {
  const { accentColor } = useEmotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = MODELS.find((m) => m.id === selectedTier) || MODELS[0];
  const CurrentIcon = current.icon;

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODELS;
    return MODELS.filter((model) => [model.name, model.provider, model.shortName, model.description, ...model.bestFor].join(" ").toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="relative border-t border-white/5 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] text-text-ghost font-medium uppercase tracking-wider shrink-0">Model</span>
        <motion.button
          type="button"
          onClick={() => setOpen((value) => !value)}
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left"
          style={{
            background: `linear-gradient(135deg, ${current.color}18, rgba(255,255,255,0.035))`,
            border: `1px solid ${current.color}35`,
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl" style={{ background: `${current.color}20`, color: current.color }}>
              <CurrentIcon size={14} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-text-primary">{current.shortName}</span>
              <span className="block truncate text-[9px] text-text-ghost">{current.provider} · {current.effectiveness}% effective</span>
            </span>
          </span>
          <ChevronDown size={12} className="shrink-0 text-text-muted transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-3 right-3 bottom-[calc(100%-2px)] z-50 mb-2 overflow-hidden rounded-3xl"
            style={{
              background: "rgba(10,10,18,0.96)",
              border: "1px solid rgba(255,255,255,0.11)",
              backdropFilter: "blur(36px) saturate(180%)",
              boxShadow: "0 24px 70px -18px rgba(0,0,0,0.8)",
            }}
          >
            <div className="border-b border-white/6 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Bot size={14} style={{ color: accentColor }} />
                <div>
                  <p className="text-[12px] font-semibold text-text-primary">Model Browser</p>
                  <p className="text-[9px] text-text-ghost">Claude / GPT style model selector with effectiveness routing</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2">
                <Search size={12} className="text-text-ghost" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models or use-cases..." className="min-w-0 flex-1 bg-transparent text-[11px] text-text-primary outline-none placeholder:text-text-ghost" />
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2 smooth-scroll">
              {filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  active={model.id === selectedTier}
                  onSelect={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModelCard({ model, active, onSelect }: { model: ModelOption; active: boolean; onSelect: () => void }) {
  const Icon = model.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full rounded-2xl p-3 text-left transition-all hover:bg-white/[0.045]"
      style={{ border: active ? `1px solid ${model.color}50` : "1px solid transparent", background: active ? `${model.color}10` : "transparent" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${model.color}18`, color: model.color, border: `1px solid ${model.color}30` }}>
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[12px] font-semibold text-text-primary">{model.name}</p>
            <span className="shrink-0 rounded-md border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[8px] uppercase text-text-ghost">{model.provider}</span>
            {active && <Check size={12} style={{ color: model.color }} />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-text-muted">{model.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {model.bestFor.map((useCase) => (
              <span key={useCase} className="rounded-md bg-white/[0.045] px-1.5 py-0.5 text-[8px] text-text-ghost">{useCase}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div initial={{ width: 0 }} animate={{ width: `${model.effectiveness}%` }} className="h-full rounded-full" style={{ background: model.color }} />
            </div>
            <span className="text-[9px] font-semibold" style={{ color: model.color }}>{model.effectiveness}%</span>
            <span className={`text-[8px] ${model.configured ? "text-emerald-300/80" : "text-amber-300/80"}`}>{model.configured ? "ready" : "add key"}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
