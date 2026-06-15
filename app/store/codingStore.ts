import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import {
  CodingProblem,
  CodingSession,
  CodingLanguage,
  RunResult,
  RunStatus,
  TestCaseResult,
  CoachMessage,
  CoachAction,
  AIModel,
  ModelTier,
  DEFAULT_STARTER_CODE,
} from "@/types/coding";
import { recordRun, recordProblemAttempt } from "@/lib/codingStats";

type ApiTestResult = {
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  passed?: boolean;
  status?: string;
  time?: string;
  memory?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

interface CodingStore {
  // Problem state
  currentProblem: CodingProblem | null;
  problemLoading: boolean;
  problemError: string | null;

  // Session state
  currentSession: CodingSession | null;
  selectedLanguage: CodingLanguage;
  code: string;

  // Runner state
  runResults: RunResult[];
  isRunning: boolean;
  customInput: string;
  testResults: TestCaseResult[];

  // Coach state
  coachMessages: CoachMessage[];
  coachLoading: boolean;
  coachOpen: boolean;

  // Model state
  selectedModel: string;
  selectedTier: ModelTier;
  availableModels: AIModel[];

  // UI state
  activeTab: "problem" | "code" | "results" | "coach";
  urlInput: string;

  // Actions
  setUrlInput: (url: string) => void;
  importProblem: (url: string) => Promise<void>;
  setProblem: (problem: CodingProblem) => void;
  setSelectedLanguage: (lang: CodingLanguage) => void;
  setCode: (code: string) => void;
  setCustomInput: (input: string) => void;
  runCode: () => Promise<void>;
  runTestCases: () => Promise<void>;
  sendCoachMessage: (action: CoachAction) => Promise<void>;
  sendCoachFreeText: (text: string) => Promise<void>;
  toggleCoach: () => void;
  setActiveTab: (tab: "problem" | "code" | "results" | "coach") => void;
  setSelectedModel: (model: string) => void;
  setSelectedTier: (tier: ModelTier) => void;
  resetWorkspace: () => void;
  startSession: () => void;
}

export const useCodingStore = create<CodingStore>((set, get) => ({
  // Initial state
  currentProblem: null,
  problemLoading: false,
  problemError: null,
  currentSession: null,
  selectedLanguage: "python",
  code: DEFAULT_STARTER_CODE.python,
  runResults: [],
  isRunning: false,
  customInput: "",
  testResults: [],
  coachMessages: [],
  coachLoading: false,
  coachOpen: false,
  selectedModel: "meta/llama-3.3-70b-instruct",
  selectedTier: "auto",
  availableModels: [
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
    { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "nvidia", tier: "technical", description: "Newest Llama — excellent code gen", configured: true },
    { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6", provider: "nvidia", tier: "technical", description: "Strong coding and analysis", configured: true },
    { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B", provider: "nvidia", tier: "technical", description: "Meta's latest — 128K context", configured: true },
    // ─── Fast (verified ✅) ───
    { id: "bytedance/seed-oss-36b-instruct", name: "Seed 36B", provider: "nvidia", tier: "fast", description: "ByteDance's fast + smart model", configured: true },
    { id: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron Nano 30B", provider: "nvidia", tier: "fast", description: "Fast with good quality", configured: true },
    { id: "z-ai/glm-5.1", name: "GLM 5.1", provider: "nvidia", tier: "fast", description: "Versatile and quick", configured: true },
    { id: "stepfun-ai/step-3.5-flash", name: "Step 3.5 Flash", provider: "nvidia", tier: "fast", description: "Ultra fast responses", configured: true },
    { id: "nvidia/nvidia-nemotron-nano-9b-v2", name: "Nemotron Nano 9B", provider: "nvidia", tier: "fast", description: "Fast and capable", configured: true },
    { id: "meta/llama-3.2-3b-instruct", name: "Llama 3.2 3B", provider: "nvidia", tier: "fast", description: "Instant — smallest and fastest", configured: true },
    { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", provider: "nvidia", tier: "fast", description: "Quick and reliable", configured: true },
  ],
  activeTab: "problem",
  urlInput: "",

  // Actions
  setUrlInput: (url) => set({ urlInput: url }),

  importProblem: async (url: string) => {
    set({ problemLoading: true, problemError: null });
    try {
      const res = await fetch("/api/coding/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import problem");
      }
      const data = await res.json();
      const problem: CodingProblem = data.problem;
      set({
        currentProblem: problem,
        problemLoading: false,
        code: problem.starterCode[get().selectedLanguage] || DEFAULT_STARTER_CODE[get().selectedLanguage],
      });
      get().startSession();
      // Track stats
      try { recordProblemAttempt(problem.id, false); } catch {}
    } catch (err: unknown) {
      set({ problemLoading: false, problemError: getErrorMessage(err, "Failed to import problem") });
    }
  },

  setProblem: (problem) => {
    set({
      currentProblem: problem,
      code: problem.starterCode[get().selectedLanguage] || DEFAULT_STARTER_CODE[get().selectedLanguage],
    });
    get().startSession();
  },

  setSelectedLanguage: (lang) => {
    const { currentProblem } = get();
    const starterCode = currentProblem?.starterCode[lang] || DEFAULT_STARTER_CODE[lang];
    set({ selectedLanguage: lang, code: starterCode });
  },

  setCode: (code) => set({ code }),

  setCustomInput: (input) => set({ customInput: input }),

  runCode: async () => {
    const { code, selectedLanguage, customInput, currentSession, currentProblem } = get();
    set({ isRunning: true });
    try {
      // Build test cases from problem examples if no custom input is provided
      const testCases =
        !customInput && currentProblem?.examples && currentProblem.examples.length > 0
          ? currentProblem.examples.map((ex) => ({
              input: ex.input,
              expectedOutput: ex.output.trim(),
            }))
          : undefined;

      const res = await fetch("/api/coding/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
          stdin: customInput || undefined,
          testCases,
          sessionId: currentSession?.id,
        }),
      });
      const data = await res.json();

      // Map API test results to typed TestCaseResult[]
      const mappedTestResults: TestCaseResult[] = ((data.testResults || []) as ApiTestResult[]).map((tr) => ({
        id: uuidv4(),
        input: tr.input || "",
        expectedOutput: tr.expectedOutput || "",
        actualOutput: tr.actualOutput || "",
        passed: Boolean(tr.passed),
        status: (tr.status || "runtime_error") as RunStatus,
        time: tr.time || "0",
        memory: tr.memory || "0",
      }));

      const result: RunResult = {
        id: uuidv4(),
        sessionId: currentSession?.id || "",
        status: (data.status || "runtime_error") as RunStatus,
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        compileOutput: data.compile_output || "",
        time: data.time || "0",
        memory: data.memory || "0",
        stdin: customInput,
        createdAt: new Date().toISOString(),
        testResults: mappedTestResults.length > 0 ? mappedTestResults : undefined,
      };
      set((s) => ({
        runResults: [result, ...s.runResults],
        isRunning: false,
        testResults: mappedTestResults.length > 0 ? mappedTestResults : s.testResults,
      }));
      // Track stats
      try { recordRun(currentSession?.id || "", result.status, "0"); } catch {}
    } catch (err: unknown) {
      const result: RunResult = {
        id: uuidv4(),
        sessionId: currentSession?.id || "",
        status: "runtime_error",
        stdout: "",
        stderr: getErrorMessage(err, "Failed to execute code"),
        compileOutput: "",
        time: "0",
        memory: "0",
        stdin: customInput,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ runResults: [result, ...s.runResults], isRunning: false }));
    }
  },

  runTestCases: async () => {
    const { code, selectedLanguage, currentSession, currentProblem } = get();
    if (!currentProblem?.examples || currentProblem.examples.length === 0) return;

    // Skip test cases that can't be auto-run (class design problems, fallback text)
    const validExamples = currentProblem.examples.filter((ex) => {
      const input = ex.input.toLowerCase();
      if (input.includes("see problem description")) return false;
      if (input === "" || ex.output === "") return false;
      // Detect class design problems: input starts with ["ClassName", "method1", ...]
      if (ex.input.trim().startsWith("[\"") && ex.input.includes("\",")) return false;
      return true;
    });

    if (validExamples.length === 0) {
      // Can't auto-run — this is a class design problem
      set({
        testResults: currentProblem.examples.map((ex, i) => ({
          id: `info-${i}`,
          input: ex.input.slice(0, 200),
          expectedOutput: ex.output.slice(0, 200),
          actualOutput: "Class design problem — use Run button to compile. Add your own test code at the bottom.",
          passed: false,
          status: "pending" as any,
          time: "0",
          memory: "0",
        })),
      });
      return;
    }

    set({ isRunning: true, testResults: [] });
    try {
      const testCases = validExamples.map((ex) => ({
        input: ex.input,
        expectedOutput: ex.output.trim(),
      }));

      const res = await fetch("/api/coding/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
          testCases,
          sessionId: currentSession?.id,
        }),
      });
      const data = await res.json();

      const mappedTestResults: TestCaseResult[] = ((data.testResults || []) as ApiTestResult[]).map((tr) => ({
        id: uuidv4(),
        input: tr.input || "",
        expectedOutput: tr.expectedOutput || "",
        actualOutput: tr.actualOutput || "",
        passed: Boolean(tr.passed),
        status: (tr.status || "runtime_error") as RunStatus,
        time: tr.time || "0",
        memory: tr.memory || "0",
      }));

      const result: RunResult = {
        id: uuidv4(),
        sessionId: currentSession?.id || "",
        status: (data.status || "runtime_error") as RunStatus,
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        compileOutput: data.compile_output || "",
        time: data.time || "0",
        memory: data.memory || "0",
        stdin: "",
        createdAt: new Date().toISOString(),
        testResults: mappedTestResults.length > 0 ? mappedTestResults : undefined,
      };

      set((s) => ({
        runResults: [result, ...s.runResults],
        isRunning: false,
        testResults: mappedTestResults,
      }));
    } catch (err: unknown) {
      const result: RunResult = {
        id: uuidv4(),
        sessionId: currentSession?.id || "",
        status: "runtime_error",
        stdout: "",
        stderr: getErrorMessage(err, "Failed to execute code"),
        compileOutput: "",
        time: "0",
        memory: "0",
        stdin: "",
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ runResults: [result, ...s.runResults], isRunning: false }));
    }
  },

  sendCoachMessage: async (action: CoachAction) => {
    const { currentProblem, code, selectedLanguage, runResults, selectedModel, selectedTier } = get();
    const userMsg: CoachMessage = {
      id: uuidv4(),
      role: "user",
      action,
      content: `[${action.replace(/_/g, " ")}]`,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ coachMessages: [...s.coachMessages, userMsg], coachLoading: true, coachOpen: true }));

    try {
      const res = await fetch("/api/coding/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          problem: currentProblem,
          code,
          language: selectedLanguage,
          lastResult: runResults[0] || null,
          model: selectedModel,
          tier: selectedTier,
        }),
      });
      const data = await res.json();
      const assistantMsg: CoachMessage = {
        id: uuidv4(),
        role: "assistant",
        action,
        content: data.response || "Sorry, I couldn't generate a response.",
        model: data.model,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ coachMessages: [...s.coachMessages, assistantMsg], coachLoading: false }));
    } catch {
      const errMsg: CoachMessage = {
        id: uuidv4(),
        role: "assistant",
        content: "Failed to reach the AI coach. Is the backend running?",
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ coachMessages: [...s.coachMessages, errMsg], coachLoading: false }));
    }
  },

  sendCoachFreeText: async (text: string) => {
    const { currentProblem, code, selectedLanguage, runResults, selectedModel, selectedTier } = get();
    const userMsg: CoachMessage = {
      id: uuidv4(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ coachMessages: [...s.coachMessages, userMsg], coachLoading: true, coachOpen: true }));

    try {
      const res = await fetch("/api/coding/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "free_text",
          message: text,
          problem: currentProblem,
          code,
          language: selectedLanguage,
          lastResult: runResults[0] || null,
          model: selectedModel,
          tier: selectedTier,
        }),
      });
      const data = await res.json();
      const assistantMsg: CoachMessage = {
        id: uuidv4(),
        role: "assistant",
        content: data.response || "Sorry, I couldn't generate a response.",
        model: data.model,
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ coachMessages: [...s.coachMessages, assistantMsg], coachLoading: false }));
    } catch {
      const errMsg: CoachMessage = {
        id: uuidv4(),
        role: "assistant",
        content: "Failed to reach the AI coach.",
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ coachMessages: [...s.coachMessages, errMsg], coachLoading: false }));
    }
  },

  toggleCoach: () => set((s) => ({ coachOpen: !s.coachOpen })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  setSelectedTier: (tier) => {
    const { availableModels } = get();
    // Auto-select the first configured model matching this tier
    const matchingModel = availableModels.find((m) => m.tier === tier && m.configured);
    if (matchingModel) {
      set({ selectedTier: tier, selectedModel: matchingModel.id });
    } else {
      set({ selectedTier: tier });
    }
  },

  startSession: () => {
    const { currentProblem, selectedLanguage, code } = get();
    if (!currentProblem) return;
    const session: CodingSession = {
      id: uuidv4(),
      problemId: currentProblem.id,
      language: selectedLanguage,
      status: "draft",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeSpentSeconds: 0,
      currentCode: code,
      notes: "",
    };
    set({ currentSession: session });
  },

  resetWorkspace: () => set({
    currentProblem: null,
    problemLoading: false,
    problemError: null,
    currentSession: null,
    code: DEFAULT_STARTER_CODE[get().selectedLanguage],
    runResults: [],
    testResults: [],
    coachMessages: [],
    coachOpen: false,
    urlInput: "",
    activeTab: "problem",
  }),
}));

// Sync coding context to backend for voice agent access
// Debounced to avoid flooding the API
let _syncTimeout: ReturnType<typeof setTimeout> | null = null;

function syncCodingContextToVoiceAgent() {
  if (_syncTimeout) clearTimeout(_syncTimeout);
  _syncTimeout = setTimeout(() => {
    const state = useCodingStore.getState();
    const payload = {
      currentProblem: state.currentProblem ? {
        title: state.currentProblem.title,
        difficulty: state.currentProblem.difficulty,
        tags: state.currentProblem.tags,
        statementMarkdown: state.currentProblem.statementMarkdown?.slice(0, 800),
      } : null,
      code: state.code?.slice(0, 1500) || "",
      language: state.selectedLanguage,
      runResults: state.runResults.slice(0, 3).map((r) => ({
        status: r.status,
        time: r.time,
        testResults: r.testResults?.map((t) => ({ passed: t.passed, status: t.status })),
      })),
    };
    fetch("/api/coding/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => { /* silent — voice agent sync is optional */ });
  }, 2000);
}

// Subscribe to store changes and sync coding context
useCodingStore.subscribe((state, prevState) => {
  if (
    state.currentProblem !== prevState.currentProblem ||
    state.code !== prevState.code ||
    state.runResults !== prevState.runResults
  ) {
    syncCodingContextToVoiceAgent();
  }
});
