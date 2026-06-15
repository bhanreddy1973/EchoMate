"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Cpu, Check, AlertCircle } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { useCodingStore } from "@/store/codingStore";
import { ModelProvider, ModelTier, AIModel } from "@/types/coding";
import MotionGlyph from "./MotionGlyph";

const PROVIDER_COLORS: Record<ModelProvider, string> = {
  nvidia: "#76b900",
  openai: "#10a37f",
  gemini: "#4285f4",
  openrouter: "#f97316",
};

const TIER_LABELS: Record<ModelTier, { label: string; color: string }> = {
  auto: { label: "Auto", color: "#06b6d4" },
  fast: { label: "Fast", color: "#10b981" },
  technical: { label: "Code", color: "#3b82f6" },
  reasoning: { label: "Deep Think", color: "#f59e0b" },
};

export default function ModelPicker() {
  const { accentColor } = useEmotion();
  const { selectedModel, selectedTier, setSelectedModel, setSelectedTier, availableModels } = useCodingStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentModel = availableModels.find((m) => m.id === selectedModel);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-[11px] font-medium transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
          border: "1px solid rgba(255,255,255,0.095)",
          backdropFilter: "blur(30px) saturate(170%)",
        }}
      >
        <MotionGlyph variant="model" color={currentModel ? PROVIDER_COLORS[currentModel.provider] : accentColor} size="sm" active={open} />
        <span className="text-text-secondary max-w-[140px] truncate">
          {currentModel?.name || "Select Model"}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[8px] font-semibold"
          style={{
            background: `${TIER_LABELS[selectedTier].color}20`,
            color: TIER_LABELS[selectedTier].color,
          }}
        >
          {TIER_LABELS[selectedTier].label}
        </span>
        <ChevronDown
          size={10}
          className="text-text-muted transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
        />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full right-0 mt-2 w-[300px] rounded-2xl overflow-hidden z-50"
            style={{
              background: "rgba(12,12,20,0.95)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6)",
            }}
          >
            {/* Tier selector */}
            <div className="px-3 py-2.5 border-b border-white/5">
              <p className="text-[9px] text-text-ghost uppercase tracking-wider font-medium mb-2">Mode</p>
              <div className="flex gap-1.5">
                {(Object.entries(TIER_LABELS) as [ModelTier, { label: string; color: string }][]).map(([tier, config]) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                    style={selectedTier === tier ? {
                      background: `${config.color}15`,
                      color: config.color,
                      border: `1px solid ${config.color}30`,
                    } : {
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model list — filtered by selected tier or show all */}
            <div className="max-h-[280px] overflow-y-auto py-1.5 smooth-scroll">
              {selectedTier === "auto" ? (
                // Show all models grouped by tier
                (["reasoning", "technical", "fast"] as ModelTier[]).map((tier) => {
                  const tierModels = availableModels.filter((m) => m.tier === tier);
                  if (tierModels.length === 0) return null;
                  const tierConfig = TIER_LABELS[tier];
                  return (
                    <div key={tier}>
                      <div className="px-3 py-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tierConfig.color }} />
                        <span className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: tierConfig.color }}>
                          {tierConfig.label}
                        </span>
                        <span className="text-[8px] text-text-ghost">({tierModels.length})</span>
                      </div>
                      {tierModels.map((model) => (
                        <ModelRow key={model.id} model={model} isSelected={model.id === selectedModel} providerColor={PROVIDER_COLORS[model.provider]} accentColor={accentColor} onSelect={() => { setSelectedModel(model.id); setOpen(false); }} />
                      ))}
                    </div>
                  );
                })
              ) : (
                // Show only models matching selected tier
                (() => {
                  const filtered = availableModels.filter((m) => m.tier === selectedTier);
                  return filtered.length > 0 ? (
                    filtered.map((model) => (
                      <ModelRow key={model.id} model={model} isSelected={model.id === selectedModel} providerColor={PROVIDER_COLORS[model.provider]} accentColor={accentColor} onSelect={() => { setSelectedModel(model.id); setOpen(false); }} />
                    ))
                  ) : (
                    <p className="px-3 py-4 text-[10px] text-text-ghost text-center">No models for this tier</p>
                  );
                })()
              )}
            </div>

            {/* Footer note */}
            <div className="px-3 py-2 border-t border-white/5">
              <p className="text-[9px] text-text-ghost">
                All NVIDIA models use your same API key • Add OpenAI/Gemini keys for more
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Model row component ─────────────────────────────────────────────────────
function ModelRow({ model, isSelected, providerColor, accentColor, onSelect }: {
  model: { id: string; name: string; provider: string; description: string; configured: boolean };
  isSelected: boolean;
  providerColor: string;
  accentColor: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={model.configured ? onSelect : undefined}
      disabled={!model.configured}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={isSelected ? { background: `${accentColor}08` } : undefined}
    >
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${providerColor}15` }}
      >
        <Cpu size={10} style={{ color: providerColor }} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-text-primary truncate">{model.name}</span>
          <span className="text-[8px] uppercase text-text-ghost">{model.provider}</span>
        </div>
        <p className="text-[9px] text-text-ghost truncate">{model.description}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {!model.configured && (
          <AlertCircle size={10} className="text-yellow-400/60" />
        )}
        {isSelected && (
          <Check size={12} style={{ color: accentColor }} />
        )}
      </div>
    </button>
  );
}
