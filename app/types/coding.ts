// ─── Coding Workspace Types ─────────────────────────────────────────────────

export type CodingLanguage = "python" | "javascript" | "typescript" | "java" | "cpp" | "go" | "rust" | "csharp";

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export type ProblemSource = "leetcode" | "neetcode" | "manual";

export type SessionStatus = "draft" | "running" | "solved" | "revisit";

export type RunStatus = "accepted" | "wrong_answer" | "runtime_error" | "compile_error" | "time_limit" | "memory_limit" | "pending" | "processing";

export type CoachAction =
  | "explain_problem"
  | "walkthrough_examples"
  | "validate_approach"
  | "give_hint"
  | "debug_code"
  | "generate_edge_cases"
  | "analyze_complexity"
  | "optimize_approach"
  | "dry_run"
  | "visualize_flow"
  | "show_solution";

export type ModelProvider = "nvidia" | "openai" | "gemini" | "openrouter";

export type ModelTier = "auto" | "fast" | "technical" | "reasoning";

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  tier: ModelTier;
  description: string;
  configured: boolean;
}

export interface CodingProblem {
  id: string;
  source: ProblemSource;
  sourceUrl: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  statementMarkdown: string;
  examples: ProblemExample[];
  constraints: string[];
  tags: string[];
  starterCode: Record<CodingLanguage, string>;
  hints?: string[];
  similarProblems?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface CodingSession {
  id: string;
  problemId: string;
  language: CodingLanguage;
  status: SessionStatus;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  timeSpentSeconds: number;
  currentCode: string;
  notes: string;
}

export interface RunResult {
  id: string;
  sessionId: string;
  status: RunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string;
  memory: string;
  stdin: string;
  createdAt: string;
  testResults?: TestCaseResult[];
}

export interface TestCaseResult {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  status: RunStatus;
  time: string;
  memory: string;
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  action?: CoachAction;
  content: string;
  model?: string;
  createdAt: string;
}

export interface TopicScore {
  topic: string;
  attempts: number;
  solved: number;
  failedRuns: number;
  hintsUsed: number;
  avgTimeSeconds: number;
  weaknessScore: number;
  lastPracticedAt: string;
}

// Judge0 language ID mapping
export const JUDGE0_LANGUAGE_MAP: Record<CodingLanguage, number> = {
  python: 71,      // Python 3
  javascript: 63,  // JavaScript (Node.js)
  typescript: 74,  // TypeScript
  java: 62,        // Java
  cpp: 54,         // C++ (GCC)
  go: 60,          // Go
  rust: 73,        // Rust
  csharp: 51,      // C#
};

export const LANGUAGE_DISPLAY_NAMES: Record<CodingLanguage, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
  rust: "Rust",
  csharp: "C#",
};

export const LANGUAGE_MONACO_MAP: Record<CodingLanguage, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
  go: "go",
  rust: "rust",
  csharp: "csharp",
};

export const DEFAULT_STARTER_CODE: Record<CodingLanguage, string> = {
  python: `class Solution:\n    def solve(self):\n        # Write your solution here\n        pass\n`,
  javascript: `/**\n * @param {void}\n * @return {void}\n */\nvar solve = function() {\n    // Write your solution here\n};\n`,
  typescript: `function solve(): void {\n    // Write your solution here\n}\n`,
  java: `class Solution {\n    public void solve() {\n        // Write your solution here\n    }\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        // Write your solution here\n    }\n};\n`,
  go: `package main\n\nimport \"fmt\"\n\nfunc solve() {\n    // Write your solution here\n    fmt.Println(\"Hello\")\n}\n`,
  rust: `fn solve() {\n    // Write your solution here\n}\n\nfn main() {\n    solve();\n}\n`,
  csharp: `using System;\n\npublic class Solution {\n    public void Solve() {\n        // Write your solution here\n    }\n}\n`,
};

export const COACH_ACTIONS: { id: CoachAction; label: string; description: string }[] = [
  { id: "explain_problem", label: "Explain Problem", description: "Break down the problem statement clearly" },
  { id: "walkthrough_examples", label: "Walkthrough Examples", description: "Step through each example with explanation" },
  { id: "validate_approach", label: "Validate Approach", description: "Check if your current approach is correct" },
  { id: "give_hint", label: "Give a Hint", description: "Get a nudge in the right direction" },
  { id: "debug_code", label: "Debug My Code", description: "Find issues in your current code" },
  { id: "generate_edge_cases", label: "Edge Cases", description: "Generate tricky test cases" },
  { id: "analyze_complexity", label: "Complexity", description: "Analyze time and space complexity" },
  { id: "optimize_approach", label: "Optimize", description: "Suggest optimizations" },
  { id: "dry_run", label: "Dry Run", description: "Trace through code step by step" },
  { id: "visualize_flow", label: "Visualize", description: "Show algorithm flow visually" },
  { id: "show_solution", label: "Show Solution", description: "Reveal a complete solution" },
];
