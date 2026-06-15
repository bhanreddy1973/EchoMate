"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle, Clock, Code2, Flame, Target, TrendingUp, XCircle, Zap } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { getCodingStats, type CodingStatsData } from "@/lib/codingStats";

export default function CodingStats() {
  const { accentColor } = useEmotion();
  const [stats, setStats] = useState<CodingStatsData>({ totalProblems: 0, solved: 0, attempted: 0, totalRuns: 0, acceptedRuns: 0, wrongAnswers: 0, runtimeErrors: 0, totalTimeSpentMs: 0, streak: 0, lastActiveDate: "", byDifficulty: { easy: 0, medium: 0, hard: 0 }, byLanguage: {}, recentActivity: [] });

  useEffect(() => {
    setStats(getCodingStats());
    const interval = setInterval(() => setStats(getCodingStats()), 5000);
    return () => clearInterval(interval);
  }, []);

  const successRate = stats.totalRuns > 0 ? Math.round((stats.acceptedRuns / stats.totalRuns) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full max-w-3xl mx-auto space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard icon={Target} label="Problems" value={stats.totalProblems} subtitle={`${stats.solved} solved`} color="#10b981" />
        <StatCard icon={Activity} label="Total Runs" value={stats.totalRuns} subtitle={`${successRate}% pass`} color="#3b82f6" />
        <StatCard icon={Flame} label="Streak" value={stats.streak} subtitle={stats.streak > 0 ? "days" : "start!"} color="#f59e0b" />
        <StatCard icon={Clock} label="Languages" value={Object.keys(stats.byLanguage).length} subtitle="used" color="#8b5cf6" />
      </div>
      {stats.totalRuns > 0 && (
        <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={11} className="text-white/40" />
            <span className="text-[9px] font-semibold text-white/50 uppercase tracking-wider">Run Breakdown</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-white/[0.04] mb-2">
            {stats.acceptedRuns > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.acceptedRuns / stats.totalRuns) * 100}%` }} className="h-full" style={{ background: "#10b981" }} />}
            {stats.wrongAnswers > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.wrongAnswers / stats.totalRuns) * 100}%` }} className="h-full" style={{ background: "#ef4444" }} />}
            {stats.runtimeErrors > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.runtimeErrors / stats.totalRuns) * 100}%` }} className="h-full" style={{ background: "#f59e0b" }} />}
          </div>
          <div className="flex items-center gap-4 text-[9px]">
            <span className="flex items-center gap-1"><CheckCircle size={9} className="text-emerald-400" /><span className="text-white/50">{stats.acceptedRuns} accepted</span></span>
            <span className="flex items-center gap-1"><XCircle size={9} className="text-red-400" /><span className="text-white/50">{stats.wrongAnswers} wrong</span></span>
            <span className="flex items-center gap-1"><Zap size={9} className="text-amber-400" /><span className="text-white/50">{stats.runtimeErrors} errors</span></span>
          </div>
        </div>
      )}
      {Object.keys(stats.byLanguage).length > 0 && (
        <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Code2 size={11} className="text-white/40" />
            <span className="text-[9px] font-semibold text-white/50 uppercase tracking-wider">Languages</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byLanguage).sort(([, a], [, b]) => b - a).map(([lang, count]) => (
              <div key={lang} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px]" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}25` }}>
                <span className="text-white/60 capitalize">{lang}</span>
                <span className="font-semibold" style={{ color: accentColor }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, subtitle, color }: { icon: React.ElementType; label: string; value: number | string; subtitle: string; color: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="rounded-2xl p-3 text-left" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <Icon size={11} style={{ color }} />
        </div>
        <span className="text-[9px] text-white/40 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[18px] font-bold text-white/85 leading-none">{value}</p>
      <p className="text-[9px] text-white/35 mt-1">{subtitle}</p>
    </motion.div>
  );
}
