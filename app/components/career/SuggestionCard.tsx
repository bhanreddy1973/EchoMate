"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Pencil, ArrowRight } from "lucide-react";
import { FramingSuggestion } from "@/types/career";
import { useEmotion } from "@/context/EmotionContext";

interface Props {
  suggestion: FramingSuggestion;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (text: string) => void;
}

export default function SuggestionCard({ suggestion, onAccept, onReject, onEdit }: Props) {
  const { accentColor } = useEmotion();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(suggestion.suggestedBullet);

  const statusColors = {
    pending: "rgba(255,255,255,0.06)",
    accepted: "rgba(52,211,153,0.08)",
    rejected: "rgba(248,113,113,0.08)",
    edited: "rgba(96,165,250,0.08)",
  };

  const statusBorders = {
    pending: "rgba(255,255,255,0.10)",
    accepted: "rgba(52,211,153,0.25)",
    rejected: "rgba(248,113,113,0.25)",
    edited: "rgba(96,165,250,0.25)",
  };

  return (
    <motion.div
      layout
      className="p-3 rounded-xl transition-all"
      style={{
        background: statusColors[suggestion.status],
        border: `1px solid ${statusBorders[suggestion.status]}`,
      }}
    >
      {/* Original bullet */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
          Original
        </span>
        <p className="text-[11px] text-text-muted leading-relaxed">{suggestion.originalBullet}</p>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-1 my-1.5 pl-2">
        <ArrowRight size={10} style={{ color: accentColor }} />
        <span className="text-[9px]" style={{ color: accentColor }}>{suggestion.reason}</span>
      </div>

      {/* Suggested bullet */}
      <div className="flex items-start gap-2 mb-2.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: `${accentColor}15`, color: accentColor }}>
          Suggested
        </span>
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="flex-1 bg-transparent text-[11px] text-text-primary outline-none resize-none leading-relaxed p-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
            rows={2}
          />
        ) : (
          <p className="text-[11px] text-text-primary leading-relaxed">
            {suggestion.editedText || suggestion.suggestedBullet}
          </p>
        )}
      </div>

      {/* Actions */}
      {suggestion.status === "pending" && (
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={onAccept}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all hover:scale-105"
            style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.30)" }}
          >
            <Check size={10} /> Accept
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all hover:scale-105"
            style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.30)" }}
          >
            <X size={10} /> Reject
          </button>
          <button
            onClick={() => {
              if (editing) {
                onEdit(editText);
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all hover:scale-105"
            style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.30)" }}
          >
            <Pencil size={10} /> {editing ? "Save" : "Edit"}
          </button>
        </div>
      )}

      {/* Status badge */}
      {suggestion.status !== "pending" && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] font-medium capitalize px-2 py-0.5 rounded-md"
            style={{
              background: suggestion.status === "accepted" ? "rgba(52,211,153,0.15)"
                : suggestion.status === "rejected" ? "rgba(248,113,113,0.15)"
                : "rgba(96,165,250,0.15)",
              color: suggestion.status === "accepted" ? "#34d399"
                : suggestion.status === "rejected" ? "#f87171"
                : "#60a5fa",
            }}>
            {suggestion.status}
          </span>
        </div>
      )}
    </motion.div>
  );
}
