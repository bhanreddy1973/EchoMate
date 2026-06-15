// ─── Career Types ──────────────────────────────────────────────────────────

// Core resume data
export interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
  technologies: string[];
  impact?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  highlights: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  highlights: string[];
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface MasterResume {
  contact: ContactInfo;
  summary?: string;
  experiences: WorkExperience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications: Certification[];
}

// Job Description
export interface JobDescription {
  rawText: string;
  company: string;
  role: string;
  requiredSkills: string[];
  preferredSkills: string[];
  keywords: string[];
  responsibilities: string[];
}

// Analysis
export interface SkillMatch {
  skill: string;
  source: string;
  confidence: number;
  evidenceSnippet: string;
}

export interface SkillGap {
  skill: string;
  importance: "critical" | "important" | "nice-to-have";
  bridgeable: boolean;
  suggestion: string;
}

export interface FramingSuggestion {
  id: string;
  experienceId: string;
  originalBullet: string;
  suggestedBullet: string;
  reason: string;
  status: "pending" | "accepted" | "rejected" | "edited";
  editedText?: string;
}

export interface FitAnalysis {
  overallScore: number;
  atsScore: number;
  matchingSkills: SkillMatch[];
  missingSkills: SkillGap[];
  suggestions: FramingSuggestion[];
  strengthBadges: string[];
  riskBadges: string[];
}

// Network
export interface ContactResult {
  id: string;
  name: string;
  title: string;
  company: string;
  profileUrl: string;
  source: "google" | "perplexity" | "linkedin" | "custom-search" | "github" | "google-cse" | "tavily" | "ai-suggested";
  connectionType: "recruiter" | "hiring-manager" | "team-member" | "referral";
  activityLevel?: "active" | "moderate" | "unknown";
  avatar?: string;
  location?: string;
  bio?: string;
}

export interface ColdEmailDraft {
  id: string;
  contactId: string;
  subject: string;
  body: string;
  tone: "professional" | "casual" | "enthusiastic";
  purpose: "referral" | "cold-outreach" | "follow-up" | "informational";
  contactName: string;
}

export interface SearchStrategy {
  googleDorkQueries: string[];
  linkedinSearchUrls: string[];
  perplexityQuery: string;
}

// Job Search
export type YoeLevel = "intern" | "fresher" | "junior" | "mid" | "senior" | "staff";

export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "full-time" | "part-time" | "contract" | "internship" | "remote";
  level: string;
  description: string;
  skills: string[];
  applyUrl: string;
  source: string;
  postedAt?: string;
}

export interface JobSearchResult {
  jobs: JobResult[];
  jobBoardLinks: { platform: string; url: string; label: string }[];
  insights: string;
  topCompanies: string[];
  searchQueries: string[];
}

// Session
export interface CareerSession {
  id: string;
  createdAt: string;
  jd: JobDescription | null;
  fitAnalysis: FitAnalysis | null;
  generatedLatex: string | null;
  contacts: ContactResult[];
  emailDrafts: ColdEmailDraft[];
  status: "idle" | "analyzing" | "reviewed" | "generated" | "networking";
}

// Connectors & MCP Tools for Career
export interface MCPTool {
  id: string;
  name: string;
  description: string;
  server: string;
  enabled: boolean;
  icon?: string;
}

export interface CareerConnector {
  id: string;
  name: string;
  type: "serpapi" | "google-cse" | "perplexity" | "linkedin" | "custom";
  apiKey?: string;
  extraConfig?: Record<string, string>; // e.g. { cseId: "..." } for Google CSE
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  description: string;
}

// ─── Application Tracking ────────────────────────────────────────────────────

export type ApplicationStatus =
  | "bookmarked"
  | "applied"
  | "referred"
  | "oa-received"
  | "interview-scheduled"
  | "interviewing"
  | "offer"
  | "rejected"
  | "ghosted"
  | "withdrawn";

export interface ReferralInfo {
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  relationship: string; // "friend", "ex-colleague", "cold-outreach", etc.
  notes?: string;
}

export type AppCategory =
  | "frontend" | "backend" | "fullstack" | "ml-ai" | "data"
  | "devops" | "mobile" | "security" | "product" | "design" | "other";

export interface ApplicationEntry {
  id: string;
  company: string;
  role: string;
  location: string;
  jobUrl: string;
  resumeLink: string; // PDF/Drive link or local .tex filename
  status: ApplicationStatus;
  appliedDate: string; // ISO date
  lastUpdated: string;
  atsScore: number;
  keywords: string[]; // JD keywords
  matchingSkills: string[]; // Skills that matched
  missingSkills: string[]; // Skills gap
  platform: string; // "linkedin", "company-site", "referral", etc.
  isReferral: boolean;
  referral?: ReferralInfo;
  salary?: string;
  notes: string;
  followUpDate?: string;
  interviewRounds?: string[]; // ["OA", "Phone Screen", "Onsite Round 1"]
  responseTime?: number; // days to first response
  category?: AppCategory; // job category
}

// Resume categories for organization
export type ResumeCategory =
  | "frontend"
  | "backend"
  | "fullstack"
  | "sde"
  | "ml-ai"
  | "data-engineer"
  | "devops-cloud"
  | "mobile"
  | "security"
  | "product"
  | "research"
  | "other";

export const RESUME_CATEGORIES: { id: ResumeCategory; label: string; color: string }[] = [
  { id: "sde", label: "SDE / General", color: "#60a5fa" },
  { id: "ml-ai", label: "ML / AI", color: "#a78bfa" },
  { id: "backend", label: "Backend", color: "#34d399" },
  { id: "frontend", label: "Frontend", color: "#fb923c" },
  { id: "fullstack", label: "Full Stack", color: "#f472b6" },
  { id: "data-engineer", label: "Data Engineer", color: "#fbbf24" },
  { id: "devops-cloud", label: "DevOps / Cloud", color: "#38bdf8" },
  { id: "mobile", label: "Mobile", color: "#e879f9" },
  { id: "research", label: "Research", color: "#94a3b8" },
  { id: "security", label: "Security", color: "#f87171" },
  { id: "product", label: "Product", color: "#10b981" },
  { id: "other", label: "Other", color: "#6b7280" },
];

// History of generated resumes
export interface ResumeHistory {
  id: string;
  createdAt: string;
  company: string;
  role: string;
  category: ResumeCategory;
  filename: string;
  filePath: string; // actual stored path on disk
  atsScore: number;
  keywords: string[];
  filesUsed: string[];
  latex: string; // stored content
}
