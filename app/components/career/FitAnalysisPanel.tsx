"use client";

import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, AlertTriangle, Lightbulb, Loader2 } from "lucide-react";
import { useCareerStore } from "@/store/careerStore";
import { useEmotion } from "@/context/EmotionContext";
import FitScoreRing from "./FitScoreRing";
import ATSScoreGauge from "./ATSScoreGauge";
import SuggestionCard from "./SuggestionCard";

export default function FitAnalysisPanel() {
  const { accentColor } = useEmotion();
  const {
    fitAnalysis, analyzing, analyzeError,
    activeAnalysisTab, setActiveAnalysisTab,
    updateSuggestion, generateResume, generating,
  } = useCareerStore();

  if (analyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin" style={{ color: accentColor }} />
        <p className="text-[12px] text-text-muted">Analyzing fit against job description...</p>
      </div>
    );
  }

  if (analyzeError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
        <AlertTriangle size={20} className="text-red-400" />
        <p className="text-[12px] text-red-400 text-center">{analyzeError}</p>
      </div>
    );
  }

  if (!fitAnalysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <BarChart3 size={28} className="text-text-ghost" />
        <p className="text-[12px] text-text-muted">Paste a job description and click Analyze to see your fit score</p>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "skills" as const, label: "Skills" },
    { id: "experience" as const, label: "Experience" },
    { id: "suggestions" as const, label: `Suggestions (${fitAnalysis.suggestions.length})` },
  ];

  const pendingCount = fitAnalysis.suggestions.filter((s) => s.status === "pending").length;
  const allReviewed = pendingCount === 0 && fitAnalysis.suggestions.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 shrink-0 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveAnalysisTab(tab.id)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
            style={activeAnalysisTab === tab.id ? {
              background: `${accentColor}15`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
            } : {
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeAnalysisTab === "overview" && (
          <>
            <div className="flex items-center justify-center gap-6 py-3">
              <FitScoreRing score={fitAnalysis.overallScore} size={100} label="Fit Score" />
            </div>
            <ATSScoreGauge score={fitAnalysis.atsScore} />

            {/* Badges */}
            {fitAnalysis.strengthBadges.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-text-muted mb-1.5">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {fitAnalysis.strengthBadges.map((b, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                      ✓ {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {fitAnalysis.riskBadges.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-text-muted mb-1.5">Risks</p>
                <div className="flex flex-wrap gap-1.5">
                  {fitAnalysis.riskBadges.map((b, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md"
                      style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                      ⚠ {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[16px] font-bold text-green-400">{fitAnalysis.matchingSkills.length}</p>
                <p className="text-[9px] text-text-muted">Matching</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[16px] font-bold text-amber-400">{fitAnalysis.missingSkills.length}</p>
                <p className="text-[9px] text-text-muted">Gaps</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[16px] font-bold" style={{ color: accentColor }}>{fitAnalysis.suggestions.length}</p>
                <p className="text-[9px] text-text-muted">Suggestions</p>
              </div>
            </div>
          </>
        )}

        {activeAnalysisTab === "skills" && (
          <div className="grid grid-cols-2 gap-3">
            {/* Matching */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={11} className="text-green-400" />
                <span className="text-[11px] font-medium text-green-400">Matching</span>
              </div>
              <div className="space-y-1.5">
                {fitAnalysis.matchingSkills.map((skill, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-lg"
                    style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                    <p className="text-[11px] text-text-primary">{skill.skill}</p>
                    <p className="text-[9px] text-text-muted truncate">{skill.evidenceSnippet}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gaps */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={11} className="text-amber-400" />
                <span className="text-[11px] font-medium text-amber-400">Gaps</span>
              </div>
              <div className="space-y-1.5">
                {fitAnalysis.missingSkills.map((skill, i) => (
                  <div key={i} className="px-2.5 py-1.5 rounded-lg"
                    style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                    <div className="flex items-center gap-1">
                      <p className="text-[11px] text-text-primary">{skill.skill}</p>
                      <span className="text-[8px] px-1 py-0.5 rounded"
                        style={{
                          background: skill.importance === "critical" ? "rgba(248,113,113,0.15)" : "rgba(251,191,36,0.15)",
                          color: skill.importance === "critical" ? "#f87171" : "#fbbf24",
                        }}>
                        {skill.importance}
                      </span>
                    </div>
                    <p className="text-[9px] text-text-muted">{skill.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeAnalysisTab === "experience" && (
          <div className="space-y-2">
            <p className="text-[11px] text-text-muted mb-2">How your experience maps to JD requirements</p>
            {fitAnalysis.matchingSkills.map((skill, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "#34d399" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-text-primary font-medium">{skill.skill}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{skill.evidenceSnippet}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full" style={{ width: `${skill.confidence * 100}%`, background: "#34d399" }} />
                    </div>
                    <span className="text-[9px] text-text-ghost">{Math.round(skill.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeAnalysisTab === "suggestions" && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb size={12} style={{ color: accentColor }} />
              <span className="text-[11px] text-text-muted">
                Review each suggestion — accept, reject, or edit before generating
              </span>
            </div>
            {fitAnalysis.suggestions.map((sug) => (
              <SuggestionCard
                key={sug.id}
                suggestion={sug}
                onAccept={() => updateSuggestion(sug.id, "accepted")}
                onReject={() => updateSuggestion(sug.id, "rejected")}
                onEdit={(text) => updateSuggestion(sug.id, "edited", text)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Generate button */}
      {fitAnalysis.suggestions.length > 0 && (
        <div className="shrink-0 p-3 border-t border-white/5">
          <button
            onClick={generateResume}
            disabled={!allReviewed || generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: accentColor, boxShadow: allReviewed ? `0 0 16px ${accentColor}40` : "none" }}
          >
            {generating ? (
              <><Loader2 size={12} className="animate-spin" /> Generating Resume...</>
            ) : (
              <>{allReviewed ? "✨ Generate Tailored Resume" : `Review ${pendingCount} remaining suggestions`}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
