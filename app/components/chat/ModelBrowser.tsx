"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, ChevronDown, Code2, Cpu, Gauge, Mic, Zap, AlertCircle } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

export type ChatModelTier = "auto" | "fast" | "reasoning" | "creative" | "technical" | "voice" | "image";

type ModelProvider = "nvidia" | "openai" | "anthropic" | "google" | "openrouter" | "deepseek" | "meta";

interface ChatModel {
  id: string;
  name: string;
  provider: ModelProvider;
  tier: ChatModelTier;
  description: string;
  configured: boolean;
}

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  nvidia: "#76b900",
  openai: "#10a37f",
  anthropic: "#d97706",
  google: "#4285f4",
  openrouter: "#f97316",
  deepseek: "#06b6d4",
  meta: "#3b82f6",
};

const TIER_CONFIG: { id: ChatModelTier; label: string; color: string; icon: React.ElementType }[] = [
  { id: "auto", label: "Auto", color: "#06b6d4", icon: Zap },
  { id: "fast", label: "Fast", color: "#10b981", icon: Gauge },
  { id: "technical", label: "Code", color: "#3b82f6", icon: Code2 },
  { id: "reasoning", label: "Deep Think", color: "#f59e0b", icon: Brain },
];

const CHAT_MODELS: ChatModel[] = [
  // ─── Reasoning (verified ✅) ───
  { id: "mistralai/mistral-large-3-675b-instruct-2512", name: "Mistral Large 675B", provider: "nvidia", tier: "reasoning", description: "Largest model — extreme deep reasoning", configured: true },
  { id: "qwen/qwen3.5-397b-a17b", name: "Qwen 3.5 397B", provider: "nvidia", tier: "reasoning", description: "Massive reasoning — rivals GPT-4", configured: true },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron Ultra 550B", provider: "nvidia", tier: "reasoning", description: "NVIDIA's most powerful reasoning model", configured: true },
  { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron Super 120B", provider: "nvidia", tier: "reasoning", description: "Strong reasoning with good speed", configured: true },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", name: "Nemotron Omni 30B", provider: "nvidia", tier: "reasoning", description: "Chain-of-thought step-by-step", configured: true },
  // ─── Technical / Code (verified ✅) ───
  { id: "qwen/qwen3.5-122b-a10b", name: "Qwen 3.5 122B", provider: "nvidia", tier: "technical", description: "Excellent at code — Qwen's best coder", configured: true },
  { id: "mistralai/mistral-small-4-119b-2603", name: "Mistral Small 4 119B", provider: "nvidia", tier: "technical", description: "Great balance of speed + code quality", configured: true },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Nemotron Super 49B", provider: "nvidia", tier: "technical", description: "Best balance speed + quality", configured: true },
  { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron", provider: "nvidia", tier: "technical", description: "NVIDIA-tuned Mistral for code", configured: true },
  { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "meta", tier: "technical", description: "Newest Llama — excellent code gen", configured: true },
  { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6", provider: "nvidia", tier: "technical", description: "Strong coding and analysis", configured: true },
  { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B", provider: "meta", tier: "technical", description: "Meta's latest — 128K context", configured: true },
  // ─── Fast (verified ✅) ───
  { id: "bytedance/seed-oss-36b-instruct", name: "Seed 36B", provider: "nvidia", tier: "fast", description: "ByteDance's fast + smart model", configured: true },
  { id: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron Nano 30B", provider: "nvidia", tier: "fast", description: "Fast with good quality", configured: true },
  { id: "z-ai/glm-5.1", name: "GLM 5.1", provider: "nvidia", tier: "fast", description: "Versatile and quick", configured: true },
  { id: "stepfun-ai/step-3.5-flash", name: "Step 3.5 Flash", provider: "nvidia", tier: "fast", description: "Ultra fast responses", configured: true },
  { id: "nvidia/nvidia-nemotron-nano-9b-v2", name: "Nemotron Nano 9B", provider: "nvidia", tier: "fast", description: "Fast and capable", configured: true },
  { id: "meta/llama-3.2-3b-instruct", name: "Llama 3.2 3B", provider: "meta", tier: "fast", description: "Instant — smallest and fastest", configured: true },
  { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", provider: "meta", tier: "fast", description: "Quick and reliable", configured: true },
];

interface Props {
  selectedTier: ChatModelTier;
  onChange: (tier: ChatModelTier) => void;
  onModelChange?: (modelId: string) => void;
}

export default function ModelBrowser({ selectedTier, onChange, onModelChange }: Props) {
  const { accentColor } = useEmotion();
  const [open, setOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("meta/llama-3.3-70b-instruct");
  const containerRef = useRef<HTMLDivElement>(null);

  const currentModel = CHAT_MODELS.find((m) => m.id === selectedModelId) || CHAT_MODELS[0];
  const providerColor = PROVIDER_COLORS[currentModel.provider];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Filter models by selected tier (or show all for "auto")
  const filteredModels = selectedTier === "auto"
    ? CHAT_MODELS
    : CHAT_MODELS.filter((m) => m.tier === selectedTier);

  const handleSelectModel = (model: ChatModel) => {
    if (!model.configured) return;
    setSelectedModelId(model.id);
    onChange(model.tier);
    onModelChange?.(model.id);
    setOpen(false);
  };

  const activeTierConfig = TIER_CONFIG.find((t) => t.id === selectedTier) || TIER_CONFIG[0];

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      {/* Compact display: model name + tier toggle */}
      <div className="flex items-center gap-3">
        {/* Current model button */}
        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: `${providerColor}18` }}
          >
            <Cpu size={11} style={{ color: providerColor }} />
          </div>
          <span className="text-[11px] font-medium text-white/80 max-w-[130px] truncate">
            {currentModel.name}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase"
            style={{ background: `${providerColor}18`, color: providerColor }}
          >
            {currentModel.provider}
          </span>
          <ChevronDown
            size={10}
            className="text-white/40 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
          />
        </motion.button>

        {/* Tier toggle pills */}
        <div className="flex items-center gap-1">
          {TIER_CONFIG.map((tier) => {
            const Icon = tier.icon;
            const isActive = tier.id === selectedTier;
            return (
              <motion.button
                key={tier.id}
                type="button"
                onClick={() => {
                  onChange(tier.id);
                  // Auto-select first configured model in this tier
                  const firstModel = CHAT_MODELS.find(m => m.tier === tier.id && m.configured);
                  if (firstModel) {
                    setSelectedModelId(firstModel.id);
                    onModelChange?.(firstModel.id);
                  }
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200"
                style={{
                  background: isActive ? `${tier.color}18` : "transparent",
                  border: isActive ? `1px solid ${tier.color}40` : "1px solid transparent",
                  color: isActive ? tier.color : "rgba(255,255,255,0.35)",
                }}
                title={tier.label}
              >
                <Icon size={11} strokeWidth={2} />
                <span className="hidden sm:inline">{tier.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Dropdown — fixed positioning to avoid overflow clip */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[150px] z-[100] w-[380px] max-w-[90vw] rounded-2xl overflow-hidden"
            style={{
              background: "rgba(12,12,20,0.97)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(40px) saturate(180%)",
              boxShadow: "0 20px 60px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Tier filter in dropdown */}
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
              <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium mb-2">Mode</p>
              <div className="flex gap-1.5 flex-wrap">
                {TIER_CONFIG.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => {
                      onChange(tier.id);
                      const firstModel = CHAT_MODELS.find(m => m.tier === tier.id && m.configured);
                      if (firstModel) {
                        setSelectedModelId(firstModel.id);
                        onModelChange?.(firstModel.id);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                    style={selectedTier === tier.id ? {
                      background: `${tier.color}15`,
                      color: tier.color,
                      border: `1px solid ${tier.color}30`,
                    } : {
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model list — grouped by tier */}
            <div className="max-h-[280px] overflow-y-auto py-1.5">
              {filteredModels.length === 0 && (
                <p className="px-3 py-4 text-center text-[11px] text-white/30">No models for this mode</p>
              )}
              {selectedTier === "auto" ? (
                // Show grouped
                (["reasoning", "technical", "fast", "voice"] as ChatModelTier[]).map((tier) => {
                  const tierModels = filteredModels.filter((m) => m.tier === tier);
                  if (tierModels.length === 0) return null;
                  const tierConfig = TIER_CONFIG.find((t) => t.id === tier);
                  return (
                    <div key={tier}>
                      <div className="px-3 py-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tierConfig?.color }} />
                        <span className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: tierConfig?.color }}>
                          {tierConfig?.label}
                        </span>
                        <span className="text-[8px] text-white/25">({tierModels.length})</span>
                      </div>
                      {tierModels.map((model) => {
                        const isSelected = model.id === selectedModelId;
                        const color = PROVIDER_COLORS[model.provider];
                        return (
                          <button
                            key={model.id}
                            onClick={() => handleSelectModel(model)}
                            disabled={!model.configured}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                              <Cpu size={11} style={{ color }} />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium text-white/85 truncate">{model.name}</span>
                                <span className="text-[8px] uppercase text-white/30">{model.provider}</span>
                              </div>
                              <p className="text-[9px] text-white/35 truncate">{model.description}</p>
                            </div>
                            {isSelected && model.configured && <Check size={12} style={{ color: accentColor }} />}
                            {!model.configured && <span className="text-[8px] text-amber-300/60">needs key</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                // Show flat filtered list
                filteredModels.map((model) => {
                  const isSelected = model.id === selectedModelId;
                  const color = PROVIDER_COLORS[model.provider];
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      disabled={!model.configured}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                        <Cpu size={12} style={{ color }} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-white/85 truncate">{model.name}</span>
                          <span className="text-[8px] uppercase text-white/35">{model.provider}</span>
                        </div>
                        <p className="text-[9px] text-white/40 truncate mt-0.5">{model.description}</p>
                      </div>
                      {isSelected && model.configured && <Check size={13} style={{ color: accentColor }} />}
                      {!model.configured && <AlertCircle size={10} className="text-amber-300/60" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/[0.06]">
              <p className="text-[9px] text-white/30">
                Add API keys in .env to enable more providers
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
