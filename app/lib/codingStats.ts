// Coding statistics tracking utilities

export interface CodingStatsData {
  totalProblems: number;
  solved: number;
  attempted: number;
  totalRuns: number;
  acceptedRuns: number;
  wrongAnswers: number;
  runtimeErrors: number;
  totalTimeSpentMs: number;
  streak: number;
  lastActiveDate: string;
  byDifficulty: { easy: number; medium: number; hard: number };
  byLanguage: Record<string, number>;
  recentActivity: { date: string; count: number }[];
}

export function recordRun(sessionId: string, status: string, time: string) {
  try {
    const runs = JSON.parse(localStorage.getItem("echomate_runs") || "[]");
    runs.push({ sessionId, status, time, timestamp: Date.now() });
    localStorage.setItem("echomate_runs", JSON.stringify(runs.slice(-200)));
  } catch {}
}

export function recordProblemAttempt(problemId: string, solved: boolean) {
  try {
    const attempts = JSON.parse(localStorage.getItem("echomate_attempts") || "[]");
    attempts.push({ problemId, solved, timestamp: Date.now() });
    localStorage.setItem("echomate_attempts", JSON.stringify(attempts.slice(-200)));
  } catch {}
}

export function getCodingStats(): CodingStatsData {
  try {
    const runs = JSON.parse(localStorage.getItem("echomate_runs") || "[]");
    const attempts = JSON.parse(localStorage.getItem("echomate_attempts") || "[]");

    const acceptedRuns = runs.filter((r: any) => r.status === "accepted").length;
    const wrongAnswers = runs.filter((r: any) => r.status === "wrong_answer").length;
    const runtimeErrors = runs.filter((r: any) => ["runtime_error", "compile_error", "time_limit"].includes(r.status)).length;

    const byLanguage: Record<string, number> = {};
    runs.forEach((r: any) => {
      if (r.language) byLanguage[r.language] = (byLanguage[r.language] || 0) + 1;
    });

    const solved = attempts.filter((a: any) => a.solved).length;

    return {
      totalProblems: attempts.length,
      solved,
      attempted: attempts.length - solved,
      totalRuns: runs.length,
      acceptedRuns,
      wrongAnswers,
      runtimeErrors,
      totalTimeSpentMs: 0,
      streak: 0,
      lastActiveDate: runs.length > 0 ? new Date(runs[runs.length - 1].timestamp).toISOString().split("T")[0] : "",
      byDifficulty: { easy: 0, medium: 0, hard: 0 },
      byLanguage,
      recentActivity: [],
    };
  } catch {
    return {
      totalProblems: 0, solved: 0, attempted: 0, totalRuns: 0,
      acceptedRuns: 0, wrongAnswers: 0, runtimeErrors: 0,
      totalTimeSpentMs: 0, streak: 0, lastActiveDate: "",
      byDifficulty: { easy: 0, medium: 0, hard: 0 },
      byLanguage: {}, recentActivity: [],
    };
  }
}
