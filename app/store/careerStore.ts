import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  MasterResume,
  JobDescription,
  FitAnalysis,
  FramingSuggestion,
  ContactResult,
  ColdEmailDraft,
  CareerSession,
  MCPTool,
  CareerConnector,
  JobResult,
  JobSearchResult,
  YoeLevel,
} from "@/types/career";

import { detectCategory, extractSkillsFromText } from "@/lib/skillsTaxonomy";
export { extractSkillsFromText };

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface CareerStore {
  // Resume state
  masterResume: MasterResume | null;
  resumeLoading: boolean;
  resumeError: string | null;

  // JD state
  jdInput: string;
  jdUrl: string;
  parsedJd: JobDescription | null;

  // Analysis state
  fitAnalysis: FitAnalysis | null;
  analyzing: boolean;
  analyzeError: string | null;

  // Generation state
  generatedLatex: string;
  generating: boolean;
  atsScore: number;

  // Network state
  contacts: ContactResult[];
  networkLoading: boolean;
  networkError: string | null;
  companyInput: string;
  roleInput: string;
  departmentInput: string;

  // Email state
  emailDrafts: ColdEmailDraft[];
  emailGenerating: boolean;

  // Job search state
  jobRoleInput: string;
  jobLocationInput: string;
  yoeLevel: YoeLevel;
  jobResults: JobResult[];
  jobBoardLinks: { platform: string; url: string; label: string }[];
  jobInsights: string;
  jobTopCompanies: string[];
  jobSearchLoading: boolean;
  jobSearchError: string | null;

  // Model state
  selectedModel: string;
  selectedTier: string;

  // UI state
  activePanel: "jd" | "analysis" | "resume" | "network" | "form" | "tracker" | "history";
  activeAnalysisTab: "overview" | "skills" | "experience" | "suggestions";

  // Session
  currentSession: CareerSession | null;

  // Connectors & MCP Tools
  connectors: CareerConnector[];
  mcpTools: MCPTool[];

  // Actions
  setJdInput: (text: string) => void;
  setJdUrl: (url: string) => void;
  setCompanyInput: (text: string) => void;
  setRoleInput: (text: string) => void;
  setDepartmentInput: (text: string) => void;
  setJobRoleInput: (text: string) => void;
  setJobLocationInput: (text: string) => void;
  setYoeLevel: (level: YoeLevel) => void;
  searchJobs: () => Promise<void>;
  setActivePanel: (panel: "jd" | "analysis" | "resume" | "network" | "form" | "tracker" | "history") => void;
  setActiveAnalysisTab: (tab: "overview" | "skills" | "experience" | "suggestions") => void;
  setGeneratedLatex: (latex: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedTier: (tier: string) => void;

  // Connector/MCP actions
  toggleConnector: (id: string) => void;
  setConnectorApiKey: (id: string, key: string) => void;
  setConnectorExtraConfig: (id: string, config: Record<string, string>) => void;
  toggleMCPTool: (id: string) => void;

  // URL scraping
  jdUrlLoading: boolean;
  scrapeJdUrl: (url: string) => Promise<void>;

  // Uploaded resume files (session)
  uploadedFiles: { filename: string; content: string; type: "tex" | "md" }[];
  addUploadedFile: (file: { filename: string; content: string; type: "tex" | "md" }) => void;
  removeUploadedFile: (filename: string) => void;

  // Auto-generate from files
  autoGenerating: boolean;
  filesUsed: { filename: string; score: number; type: string }[];
  totalFilesScanned: number;
  autoGenerateFromJd: () => Promise<void>;

  // Multi-model outputs
  modelOutputs: { model: string; modelLabel: string; latex: string; atsScore: number }[];
  selectedOutputIndex: number;
  setSelectedOutputIndex: (i: number) => void;

  // Async actions
  loadResume: () => Promise<void>;
  saveResume: (resume: MasterResume) => Promise<void>;
  importResumeFile: (file: File) => Promise<void>;
  analyzeJd: () => Promise<void>;
  updateSuggestion: (id: string, status: FramingSuggestion["status"], editedText?: string) => void;
  generateResume: () => Promise<void>;
  searchContacts: () => Promise<void>;
  generateEmail: (contactId: string, tone: ColdEmailDraft["tone"], purpose: ColdEmailDraft["purpose"]) => Promise<void>;
  addToTracker: (overrides?: Partial<import("@/types/career").ApplicationEntry>) => Promise<void>;
  resetSession: () => void;
}

const DEFAULT_CONNECTORS: CareerConnector[] = [
  { id: "github", name: "GitHub (Free)", type: "custom", enabled: true, status: "connected", description: "Real engineer profiles — no key needed, 60 req/hr free" },
  { id: "google-cse", name: "Google Custom Search", type: "google-cse", enabled: false, status: "disconnected", description: "Real LinkedIn profiles via Google — 100 free/day" },
  { id: "perplexity", name: "Tavily Search", type: "perplexity", enabled: false, status: "disconnected", description: "AI web search for hiring contacts — 1000 free/month" },
  { id: "serpapi", name: "SerpAPI", type: "serpapi", enabled: false, status: "disconnected", description: "Google search results API — 100 free/month" },
];

const DEFAULT_MCP_TOOLS: MCPTool[] = [
  { id: "resume-parser", name: "Resume Parser", description: "Parse .tex/.md into structured data", server: "career", enabled: true },
  { id: "jd-analyzer", name: "JD Analyzer", description: "Extract skills & requirements from job descriptions", server: "career", enabled: true },
  { id: "ats-scorer", name: "ATS Scorer", description: "Score resume against ATS criteria", server: "career", enabled: true },
  { id: "contact-finder", name: "Contact Finder", description: "Multi-source recruiter/hiring manager search", server: "career", enabled: true },
  { id: "email-drafter", name: "Email Drafter", description: "Generate personalized outreach messages", server: "career", enabled: true },
  { id: "latex-generator", name: "LaTeX Generator", description: "Generate ATS-optimized LaTeX resumes", server: "career", enabled: true },
];

export const useCareerStore = create<CareerStore>()(persist((set, get) => ({
  // Initial state
  masterResume: null,
  resumeLoading: false,
  resumeError: null,
  jdInput: "",
  jdUrl: "",
  parsedJd: null,
  fitAnalysis: null,
  analyzing: false,
  analyzeError: null,
  generatedLatex: "",
  generating: false,
  atsScore: 0,
  contacts: [],
  networkLoading: false,
  networkError: null,
  companyInput: "",
  roleInput: "",
  departmentInput: "",
  emailDrafts: [],
  emailGenerating: false,
  selectedModel: "meta/llama-3.3-70b-instruct",
  selectedTier: "auto",
  activePanel: "jd",
  activeAnalysisTab: "overview",
  currentSession: null,
  connectors: DEFAULT_CONNECTORS,
  mcpTools: DEFAULT_MCP_TOOLS,
  uploadedFiles: [],
  jdUrlLoading: false,
  jobRoleInput: "",
  jobLocationInput: "",
  yoeLevel: "mid",
  jobResults: [],
  jobBoardLinks: [],
  jobInsights: "",
  jobTopCompanies: [],
  jobSearchLoading: false,
  jobSearchError: null,
  autoGenerating: false,
  filesUsed: [],
  totalFilesScanned: 0,
  modelOutputs: [],
  selectedOutputIndex: 0,

  // Simple setters
  setJdInput: (text) => set({ jdInput: text }),
  setJdUrl: (url) => set({ jdUrl: url }),
  setCompanyInput: (text) => set({ companyInput: text }),
  setRoleInput: (text) => set({ roleInput: text }),
  setDepartmentInput: (text) => set({ departmentInput: text }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setActiveAnalysisTab: (tab) => set({ activeAnalysisTab: tab }),
  setGeneratedLatex: (latex) => set({ generatedLatex: latex }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedTier: (tier) => set({ selectedTier: tier }),

  // Job search setters
  setJobRoleInput: (text) => set({ jobRoleInput: text }),
  setJobLocationInput: (text) => set({ jobLocationInput: text }),
  setYoeLevel: (level) => set({ yoeLevel: level }),

  // Search jobs
  searchJobs: async () => {
    const { jobRoleInput, jobLocationInput, yoeLevel } = get();
    if (!jobRoleInput.trim()) return;
    set({ jobSearchLoading: true, jobSearchError: null, jobResults: [], jobBoardLinks: [], jobInsights: "" });
    try {
      const res = await fetch("/api/career/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: jobRoleInput.trim(), location: jobLocationInput.trim(), yoeLevel }),
      });
      if (!res.ok) throw new Error("Job search failed");
      const data = (await res.json()) as JobSearchResult;
      if ("error" in data) throw new Error((data as unknown as { error: string }).error);
      set({
        jobResults: data.jobs || [],
        jobBoardLinks: data.jobBoardLinks || [],
        jobInsights: data.insights || "",
        jobTopCompanies: data.topCompanies || [],
        jobSearchLoading: false,
      });
    } catch (error) {
      set({ jobSearchLoading: false, jobSearchError: getErrorMessage(error, "Job search failed") });
    }
  },

  // Uploaded files actions
  addUploadedFile: (file) => set((state) => ({
    uploadedFiles: [...state.uploadedFiles.filter((f) => f.filename !== file.filename), file],
  })),
  removeUploadedFile: (filename) => set((state) => ({
    uploadedFiles: state.uploadedFiles.filter((f) => f.filename !== filename),
  })),

  // Multi-model selection
  setSelectedOutputIndex: (i) => set({ selectedOutputIndex: i }),

  // Connector/MCP actions
  toggleConnector: (id) => set((state) => ({
    connectors: state.connectors.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled, status: !c.enabled ? "connected" : "disconnected" } : c
    ),
  })),
  setConnectorApiKey: (id, key) => set((state) => ({
    connectors: state.connectors.map((c) =>
      c.id === id ? { ...c, apiKey: key, status: key ? "connected" : "disconnected", enabled: !!key } : c
    ),
  })),
  setConnectorExtraConfig: (id, config) => set((state) => ({
    connectors: state.connectors.map((c) =>
      c.id === id ? { ...c, extraConfig: { ...c.extraConfig, ...config } } : c
    ),
  })),
  toggleMCPTool: (id) => set((state) => ({
    mcpTools: state.mcpTools.map((t) =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    ),
  })),

  // Scrape JD from URL
  scrapeJdUrl: async (url) => {
    set({ jdUrlLoading: true, jdUrl: url });
    try {
      const res = await fetch("/api/career/scrape-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to scrape URL");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Set the JD text and parsed data — also sync network inputs
      set({
        jdInput: data.rawText || "",
        parsedJd: data,
        jdUrlLoading: false,
        companyInput: data.company || get().companyInput,
        roleInput: data.role || get().roleInput,
      });
    } catch (error) {
      set({ jdUrlLoading: false, analyzeError: getErrorMessage(error, "Failed to scrape job URL") });
    }
  },

  // Auto-generate resume from local files + uploaded files, using multiple models
  autoGenerateFromJd: async () => {
    const { jdInput, parsedJd, uploadedFiles, selectedModel } = get();
    if (!jdInput && !parsedJd) return;

    set({ autoGenerating: true, generating: true, modelOutputs: [], analyzeError: null });
    try {
      const res = await fetch("/api/career/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jdInput,
          parsedJd,
          uploadedFiles,
          preferredModel: selectedModel,
        }),
      });
      if (!res.ok) throw new Error("Auto-generation failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const outputs = (data.modelOutputs as { model: string; modelLabel: string; latex: string; atsScore: number }[]) || [];
      const best = outputs[0] || { latex: data.latex || "", atsScore: data.atsScore || 0 };

      set({
        generatedLatex: best.latex,
        atsScore: best.atsScore,
        modelOutputs: outputs,
        selectedOutputIndex: 0,
        filesUsed: data.filesUsed || [],
        totalFilesScanned: data.totalFilesScanned || 0,
        autoGenerating: false,
        generating: false,
        activePanel: "resume",
      });

      // Save to resume history
      try {
        // Auto-detect category from role/keywords
        const roleL = (data.role || parsedJd?.role || "").toLowerCase();
        const kwL = (parsedJd?.keywords || parsedJd?.requiredSkills || []).join(" ").toLowerCase();
        const combined = roleL + " " + kwL;
        let category = "sde";
        if (combined.match(/\b(ml|machine learning|ai|deep learning|nlp|llm|computer vision|data scien)\b/)) category = "ml-ai";
        else if (combined.match(/\b(frontend|react|vue|angular|ui|ux)\b/) && !combined.match(/full.?stack/)) category = "frontend";
        else if (combined.match(/\b(backend|server|api|microservice|distributed)\b/) && !combined.match(/full.?stack/)) category = "backend";
        else if (combined.match(/\b(full.?stack|mern|mean)\b/)) category = "fullstack";
        else if (combined.match(/\b(data engineer|etl|pipeline|spark|airflow|kafka)\b/)) category = "data-engineer";
        else if (combined.match(/\b(devops|sre|cloud|infrastructure|kubernetes|docker|aws|gcp|azure)\b/)) category = "devops-cloud";
        else if (combined.match(/\b(mobile|ios|android|flutter|react native)\b/)) category = "mobile";
        else if (combined.match(/\b(research|phd|publish|paper)\b/)) category = "research";
        else if (combined.match(/\b(security|pentest|cyber|infosec)\b/)) category = "security";
        else if (combined.match(/\b(product|pm|product manager)\b/)) category = "product";

        const company = (data.company || parsedJd?.company || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const roleSlug = (data.role || parsedJd?.role || "sde").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
        const filename = `resume_${company}_${roleSlug}.tex`;

        const historyEntry = {
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          company: data.company || parsedJd?.company || "Unknown",
          role: data.role || parsedJd?.role || "Unknown",
          category,
          filename,
          filePath: "", // will be set by the API
          atsScore: best.atsScore || 0,
          keywords: parsedJd?.keywords || parsedJd?.requiredSkills || [],
          filesUsed: (data.filesUsed || []).map((f: { filename: string }) => f.filename),
          latex: best.latex,
        };
        await fetch("/api/career/tracker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "history", entry: historyEntry }),
        });
      } catch { /* non-critical */ }
    } catch (error) {
      set({ autoGenerating: false, generating: false, analyzeError: getErrorMessage(error, "Auto-generation failed") });
    }
  },

  // Load resume from API
  loadResume: async () => {
    set({ resumeLoading: true, resumeError: null });
    try {
      const res = await fetch("/api/career/resume-data");
      if (!res.ok) throw new Error("Failed to load resume");
      const data = await res.json();
      set({ masterResume: data.resume, resumeLoading: false });
    } catch (error) {
      set({ resumeError: getErrorMessage(error, "Failed to load resume"), resumeLoading: false });
    }
  },

  // Save resume
  saveResume: async (resume) => {
    set({ resumeLoading: true, resumeError: null });
    try {
      const res = await fetch("/api/career/resume-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      if (!res.ok) throw new Error("Failed to save resume");
      set({ masterResume: resume, resumeLoading: false });
    } catch (error) {
      set({ resumeError: getErrorMessage(error, "Failed to save resume"), resumeLoading: false });
    }
  },

  // Import resume file
  importResumeFile: async (file) => {
    set({ resumeLoading: true, resumeError: null });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/career/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to import resume");
      const data = await res.json();
      set({ masterResume: data.masterResume, resumeLoading: false, activePanel: "jd" });
    } catch (error) {
      set({ resumeError: getErrorMessage(error, "Failed to import resume"), resumeLoading: false });
    }
  },

  // Analyze JD
  analyzeJd: async () => {
    const { jdInput, masterResume, selectedModel, selectedTier } = get();
    if (!jdInput.trim() || !masterResume) return;

    set({ analyzing: true, analyzeError: null });
    try {
      const res = await fetch("/api/career/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jdInput,
          masterResume,
          model: selectedModel,
          tier: selectedTier,
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      set({
        fitAnalysis: data.analysis,
        parsedJd: data.parsedJd,
        analyzing: false,
        activePanel: "analysis",
        // Auto-sync network panel
        companyInput: data.parsedJd?.company || get().companyInput,
        roleInput: data.parsedJd?.role || get().roleInput,
        currentSession: {
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          jd: data.parsedJd,
          fitAnalysis: data.analysis,
          generatedLatex: null,
          contacts: [],
          emailDrafts: [],
          status: "analyzing",
        },
      });
    } catch (error) {
      set({ analyzeError: getErrorMessage(error, "Analysis failed"), analyzing: false });
    }
  },

  // Update suggestion status
  updateSuggestion: (id, status, editedText) => {
    const { fitAnalysis } = get();
    if (!fitAnalysis) return;
    set({
      fitAnalysis: {
        ...fitAnalysis,
        suggestions: fitAnalysis.suggestions.map((s) =>
          s.id === id ? { ...s, status, editedText: editedText ?? s.editedText } : s
        ),
      },
    });
  },

  // Generate tailored resume
  generateResume: async () => {
    const { masterResume, parsedJd, fitAnalysis, selectedModel, selectedTier } = get();
    if (!masterResume || !parsedJd || !fitAnalysis) return;

    const confirmed = fitAnalysis.suggestions.filter((s) => s.status === "accepted" || s.status === "edited");
    const rejected = fitAnalysis.suggestions.filter((s) => s.status === "rejected");

    set({ generating: true });
    try {
      const res = await fetch("/api/career/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterResume,
          parsedJd,
          confirmedSuggestions: confirmed,
          rejectedSuggestions: rejected,
          atsKeywords: parsedJd.keywords,
          model: selectedModel,
          tier: selectedTier,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      set({
        generatedLatex: data.latex,
        atsScore: data.atsScore,
        generating: false,
        activePanel: "resume",
      });
    } catch (error) {
      set({ generating: false });
      console.error("Generate error:", getErrorMessage(error, "Unknown"));
    }
  },

  // Search contacts
  searchContacts: async () => {
    const { companyInput, roleInput, departmentInput, selectedModel, selectedTier, connectors } = get();
    if (!companyInput.trim()) return;

    // Pass enabled connector keys + extra config so the route can use real APIs
    const activeConnectors = connectors
      .filter((c) => c.enabled && (c.apiKey || c.type === "custom"))
      .map((c) => ({ type: c.type, apiKey: c.apiKey, extraConfig: c.extraConfig }));

    set({ networkLoading: true, networkError: null });
    try {
      const res = await fetch("/api/career/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyInput,
          role: roleInput,
          department: departmentInput,
          model: selectedModel,
          tier: selectedTier,
          connectors: activeConnectors,
        }),
      });
      if (!res.ok) throw new Error("Contact search failed");
      const data = await res.json();
      set({ contacts: data.contacts, networkLoading: false });
    } catch (error) {
      set({ networkError: getErrorMessage(error, "Search failed"), networkLoading: false });
    }
  },

  // Generate email
  generateEmail: async (contactId, tone, purpose) => {
    const { contacts, masterResume, parsedJd, fitAnalysis, selectedModel, selectedTier } = get();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    // Build rich user context from actual resume data
    const userName = masterResume?.contact?.name || "";
    const topSkills = fitAnalysis?.matchingSkills?.slice(0, 6).map(s => s.skill) || masterResume?.skills?.slice(0, 6) || [];
    const topExperience = masterResume?.experiences?.slice(0, 2).map(e =>
      `${e.title} at ${e.company} (${e.startDate}–${e.endDate || "present"}): ${e.bullets?.[0] || e.impact || ""}`
    ) || [];
    const missingSkills = fitAnalysis?.missingSkills?.filter(s => s.bridgeable).slice(0, 3).map(s => s.skill) || [];

    const richContext = [
      userName ? `My name is ${userName}.` : "",
      masterResume?.summary ? `About me: ${masterResume.summary}` : "",
      topSkills.length ? `Key skills: ${topSkills.join(", ")}` : "",
      topExperience.length ? `Recent work:\n${topExperience.join("\n")}` : "",
      parsedJd?.role ? `I'm interested in the ${parsedJd.role} role at ${parsedJd.company}.` : "",
      parsedJd?.requiredSkills?.length ? `The role requires: ${parsedJd.requiredSkills.slice(0, 8).join(", ")}` : "",
      missingSkills.length ? `I'm actively building: ${missingSkills.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    set({ emailGenerating: true });
    try {
      const res = await fetch("/api/career/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          purpose,
          tone,
          userContext: richContext,
          userName,
          targetRole: parsedJd?.role ?? "",
          targetCompany: parsedJd?.company ?? contact.company,
          topSkills,
          model: selectedModel,
          tier: selectedTier,
        }),
      });
      if (!res.ok) throw new Error("Email generation failed");
      const data = await res.json();
      const draft: ColdEmailDraft = {
        id: uuidv4(),
        contactId,
        subject: data.subject,
        body: data.body,
        tone,
        purpose,
        contactName: contact.name,
      };
      set((state) => ({ emailDrafts: [...state.emailDrafts, draft], emailGenerating: false }));
    } catch (error) {
      set({ emailGenerating: false });
      console.error("Email error:", getErrorMessage(error, "Unknown"));
    }
  },

  // Auto-add current generated resume to tracker
  addToTracker: async (overrides = {}) => {
    const { parsedJd, atsScore, fitAnalysis } = get();
    const company = overrides.company || parsedJd?.company || "";
    const role = overrides.role || parsedJd?.role || "";
    if (!company && !role) return;

    const { v4: uuid } = await import("uuid");
    const keywords = [...(parsedJd?.keywords || []), ...(parsedJd?.requiredSkills || [])];
    const category = detectCategory(keywords, role);
    const entry = {
      id: uuid(),
      company,
      role,
      location: "",
      jobUrl: "",
      resumeLink: "",
      status: "applied" as const,
      appliedDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      atsScore,
      keywords,
      matchingSkills: fitAnalysis?.matchingSkills.map((m) => m.skill) || [],
      missingSkills: fitAnalysis?.missingSkills.map((m) => m.skill) || [],
      platform: "linkedin",
      isReferral: false,
      category,
      notes: `Resume auto-generated on ${new Date().toLocaleDateString()}`,
      ...overrides,
    };

    await fetch("/api/career/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "application", entry }),
    });
  },

  // Reset
  resetSession: () => set({
    jdInput: "",
    jdUrl: "",
    parsedJd: null,
    fitAnalysis: null,
    generatedLatex: "",
    generating: false,
    autoGenerating: false,
    atsScore: 0,
    contacts: [],
    emailDrafts: [],
    filesUsed: [],
    totalFilesScanned: 0,
    modelOutputs: [],
    selectedOutputIndex: 0,
    analyzeError: null,
    networkError: null,
    currentSession: null,
    activePanel: "jd",
  }),
}), {
  name: "echomate:career-connectors",
  // Only persist connectors and mcpTools — not transient UI/search state
  partialize: (state) => ({
    connectors: state.connectors,
    mcpTools: state.mcpTools,
  }),
}));
