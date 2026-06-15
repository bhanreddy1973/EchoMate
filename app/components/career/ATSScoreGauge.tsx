"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

interface Props {
  score: number;
}

export default function ATSScoreGauge({ score }: Props) {
  const getColor = () => {
    if (score >= 80) return "#34d399";
    if (score >= 60) return "#fbbf24";
    return "#f87171";
  };

  const getLabel = () => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: `${getColor()}15`, border: `1px solid ${getColor()}30` }}>
        <Shield size={18} style={{ color: getColor() }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-text-secondary">ATS Score</span>
          <span className="text-[12px] font-bold" style={{ color: getColor() }}>{score}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: getColor() }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <span className="text-[9px] mt-0.5 block" style={{ color: getColor() }}>{getLabel()}</span>
      </div>
    </div>
  );
}
