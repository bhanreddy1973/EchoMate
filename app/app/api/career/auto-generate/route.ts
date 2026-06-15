import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { extractSkillsFromText, normalizeSkill, displayName } from "@/lib/skillsTaxonomy";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

// Directories to scan for resume/work files
const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const RESUME_DATA_DIR = path.join(process.cwd(), "data", "resume");

interface FileContent {
  filename: string;
  path: string;
  content: string;
  type: "tex" | "md";
  score: number;
}

async function scanFiles(): Promise<Omit<FileContent, "score">[]> {
  const files: Omit<FileContent, "score">[] = [];
  const seen = new Set<string>();

  async function walkDir(dir: string, depth = 0): Promise<void> {
    if (depth > 3) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (seen.has(fullPath)) continue;

        if (entry.isDirectory()) {
          const skip = ["node_modules", ".next", ".venv", ".git", "__pycache__", "app"];
          if (skip.includes(entry.name)) continue;
          await walkDir(fullPath, depth + 1);
          continue;
        }

        if (!entry.name.endsWith(".tex") && !entry.name.endsWith(".md")) continue;
        const lowerName = entry.name.toLowerCase();
        if (lowerName.includes("readme") && !lowerName.includes("resume")) continue;

        seen.add(fullPath);
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          if (content.length > 100) {
            files.push({
              filename: entry.name,
              path: fullPath,
              content: content.slice(0, 6000),
              type: entry.name.endsWith(".tex") ? "tex" : "md",
            });
          }
        } catch { /* skip unreadable files */ }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walkDir(PROJECT_ROOT);
  await walkDir(RESUME_DATA_DIR, 0);
  return files;
}

function scoreFileRelevance(
  file: Omit<FileContent, "score">,
  keywords: string[],
  role: string,
  company: string
): number {
  const lower = (file.content + " " + file.filename).toLowerCase();
  let score = 0;

  const fnLower = file.filename.toLowerCase();
  if (fnLower.includes("resume")) score += 20;
  if (fnLower.includes(role.split(" ")[0]?.toLowerCase() || "xxx")) score += 15;
  if (fnLower.includes(company.toLowerCase())) score += 25;
  if (fnLower.includes("work") || fnLower.includes("project")) score += 10;
  if (fnLower.includes("skill")) score += 8;
  if (file.type === "tex" && fnLower.includes("resume")) score += 30;
  if (fnLower.includes("documentation") || fnLower.includes("implementation")) score += 12;

  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) score += 3;
  }

  const roleWords = role.toLowerCase().split(/\s+/);
  for (const word of roleWords) {
    if (word.length > 2 && lower.includes(word)) score += 5;
  }

  return score;
}

// Extract a quick candidate skill inventory from file contents using the taxonomy
function extractCandidateSkillsFromFiles(files: FileContent[]): string[] {
  const combined = files.map((f) => f.content).join("\n");
  return extractSkillsFromText(combined);
}

// Build explicit requirement→evidence mapping
function buildRequirementMapping(
  requiredSkills: string[],
  preferredSkills: string[],
  responsibilities: string[],
  candidateSkillIds: string[]
): string {
  const candidateNorm = new Set(candidateSkillIds);
  const lines: string[] = [];

  lines.push("=== JD REQUIREMENTS → CANDIDATE EVIDENCE ===");
  lines.push("");

  if (requiredSkills.length > 0) {
    lines.push("REQUIRED SKILLS:");
    for (const skill of requiredSkills) {
      const norm = normalizeSkill(skill);
      const found = candidateNorm.has(norm);
      if (found) {
        lines.push(`  ✓ ${skill}: PRESENT in candidate files — include prominently`);
      } else {
        lines.push(`  ✗ ${skill}: NOT FOUND — do NOT add this; mark as a gap`);
      }
    }
    lines.push("");
  }

  if (preferredSkills.length > 0) {
    lines.push("PREFERRED SKILLS:");
    for (const skill of preferredSkills) {
      const norm = normalizeSkill(skill);
      const found = candidateNorm.has(norm);
      lines.push(`  ${found ? "✓" : "—"} ${skill}: ${found ? "present" : "not confirmed"}`);
    }
    lines.push("");
  }

  if (responsibilities.length > 0) {
    lines.push("JD RESPONSIBILITIES — mirror this language in tailored bullets:");
    responsibilities.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    lines.push("");
  }

  const confirmedCount = requiredSkills.filter((s) => candidateNorm.has(normalizeSkill(s))).length;
  const matchPct = requiredSkills.length > 0
    ? Math.round((confirmedCount / requiredSkills.length) * 100)
    : 0;
  lines.push(`Coverage: ${confirmedCount}/${requiredSkills.length} required skills confirmed (${matchPct}%)`);
  lines.push("");

  return lines.join("\n");
}

const GENERATION_MODELS = [
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B", provider: "nvidia" },
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "nvidia" },
  { id: "mistralai/mistral-small-3.1-24b-instruct", label: "Mistral Small 24B", provider: "nvidia" },
];
const OPENROUTER_FALLBACK = {
  id: "meta-llama/llama-3.1-70b-instruct:free",
  label: "Llama 3.1 70B (free)",
  provider: "openrouter",
};

function buildSystemPrompt(): string {
  return `You are an expert ATS resume generator. You receive a job description with explicit skill mappings and the candidate's source files. Your job is to generate a COMPLETE, TAILORED LaTeX resume.

ABSOLUTE RULES — NEVER VIOLATE:
1. Use ONLY information found in the provided candidate files — NEVER fabricate experience, skills, projects, or achievements
2. Only include skills marked ✓ PRESENT in the requirement mapping — never add ✗ NOT FOUND skills
3. Mirror JD language precisely in bullet points where the candidate genuinely has that experience
4. Keep all dates, company names, job titles, degrees exactly as they appear in the source files
5. "Reframing" = rephrasing real experience with stronger, JD-relevant language. Not inventing.
6. Use standard LaTeX packages only: geometry, enumitem, hyperref, titlesec, fontenc, inputenc
7. No graphics, images, multicol, or custom fonts — pure text for ATS parsing
8. Output must compile with pdflatex without errors

QUALITY REQUIREMENTS:
- Order sections so most JD-relevant experience appears first
- Lead every bullet with a strong action verb (Engineered, Architected, Built, Optimized, Led, Reduced, Deployed)
- Include quantifiable metrics from the source files wherever available (%, $, ms, users, scale)
- Skills section: list ONLY skills confirmed in both JD AND candidate files
- If a similar role .tex file exists in the candidate's files, match that LaTeX template structure
- Each bullet must address at least one JD responsibility or required skill

OUTPUT: Return ONLY the complete .tex file content. No markdown, no fences, no explanations.`;
}

function buildUserMessage(
  jdData: Record<string, unknown>,
  jobDescription: string,
  requirementMapping: string,
  fileContext: string
): string {
  return `## TARGET ROLE: ${jdData.role || "Unknown"} at ${jdData.company || "Unknown"}

## FULL JD TEXT:
${((jdData.rawText as string) || jobDescription || "").slice(0, 2500)}

## SKILL REQUIREMENT ANALYSIS:
${requirementMapping}

## CANDIDATE SOURCE FILES (ranked by relevance — use these as the ONLY source of truth):
${fileContext}

---
GENERATION INSTRUCTIONS:
1. Build the resume exclusively from content in the candidate files above
2. For every ✓ PRESENT required skill: make sure it appears in relevant bullet points
3. For every ✗ NOT FOUND required skill: do not add it — it is a real gap
4. Mirror the exact language from JD Responsibilities in the bullets where evidence exists
5. Use the LaTeX template structure from the highest-relevance .tex file
6. Order experiences so the most JD-relevant appears first

Generate the complete tailored .tex resume now:`;
}

async function callModel(
  modelId: string,
  provider: string,
  messages: { role: string; content: string }[],
  nvidiaKey: string,
  openRouterKey: string
): Promise<string> {
  const isNvidia = provider === "nvidia";
  const apiUrl = isNvidia
    ? "https://integrate.api.nvidia.com/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const apiKey = isNvidia ? nvidiaKey : openRouterKey;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(provider === "openrouter" ? { "HTTP-Referer": "https://echomate.app", "X-Title": "EchoMate Career" } : {}),
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: 6000,
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`${modelId} API error: ${res.status}`);
  const data = (await res.json()) as ApiResponse;
  let latex = data.choices?.[0]?.message?.content || "";
  latex = latex.replace(/```latex\n?/g, "").replace(/```tex\n?/g, "").replace(/```\n?/g, "").trim();
  return latex;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobDescription, parsedJd, uploadedFiles, preferredModel } = body as {
      jobDescription?: string;
      parsedJd?: Record<string, unknown>;
      uploadedFiles?: { filename: string; content: string; type: string }[];
      preferredModel?: string;
    };

    if (!jobDescription && !parsedJd) {
      return NextResponse.json({ error: "Job description data is required" }, { status: 400 });
    }

    const jdData: Record<string, unknown> = parsedJd || {
      rawText: jobDescription,
      role: "",
      company: "",
      keywords: [],
      requiredSkills: [],
      preferredSkills: [],
      responsibilities: [],
    };

    // Build full keyword set from all JD sources
    const jdFullText = (jdData.rawText as string) || jobDescription || "";
    const taxonomyIds = extractSkillsFromText(jdFullText);
    const taxonomyLabels = taxonomyIds.map((id) => displayName(id));

    const allKeywords = [
      ...new Set([
        ...((jdData.keywords as string[]) || []),
        ...((jdData.requiredSkills as string[]) || []),
        ...((jdData.preferredSkills as string[]) || []),
        ...taxonomyLabels,
      ]),
    ];

    const nvidiaKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_INTEGRATE_API_KEY || "";
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";

    if (!nvidiaKey && !openRouterKey) {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    // Step 1: Collect files (uploaded + local scan)
    const localFiles = await scanFiles();
    const uploadedAsFileContent: Omit<FileContent, "score">[] = (uploadedFiles || []).map((f) => ({
      filename: f.filename,
      path: `[uploaded]/${f.filename}`,
      content: f.content,
      type: (f.type === "tex" || f.type === "md") ? f.type : "md",
    }));

    const scoredUploaded: FileContent[] = uploadedAsFileContent.map((f) => ({
      ...f,
      score: scoreFileRelevance(f, allKeywords, (jdData.role as string) || "", (jdData.company as string) || "") + 100,
    }));

    const scoredLocal: FileContent[] = localFiles.map((f) => ({
      ...f,
      score: scoreFileRelevance(f, allKeywords, (jdData.role as string) || "", (jdData.company as string) || ""),
    }));

    const allScored = [...scoredUploaded, ...scoredLocal].sort((a, b) => b.score - a.score);
    const topFiles = allScored.slice(0, 8);

    if (topFiles.length === 0) {
      return NextResponse.json(
        { error: "No resume files found. Please upload your .tex or .md resume files." },
        { status: 404 }
      );
    }

    // Step 2: Extract candidate skills from the scanned files using the taxonomy
    const candidateSkillIds = extractCandidateSkillsFromFiles(topFiles);

    // Step 3: Build explicit requirement→evidence mapping
    const requirementMapping = buildRequirementMapping(
      (jdData.requiredSkills as string[]) || [],
      (jdData.preferredSkills as string[]) || [],
      (jdData.responsibilities as string[]) || [],
      candidateSkillIds
    );

    // Step 4: Build file context string — uploaded files get priority label
    const fileContext = topFiles
      .map((f) => {
        const label = f.path.startsWith("[uploaded]")
          ? `[UPLOADED - PRIMARY SOURCE] ${f.filename}`
          : `${f.filename} (relevance score: ${f.score})`;
        return `--- FILE: ${label} ---\n${f.content.slice(0, 4000)}\n`;
      })
      .join("\n\n");

    const messages = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserMessage(jdData, jobDescription || "", requirementMapping, fileContext) },
    ];

    // Step 5: Run models
    let modelsToRun = [...GENERATION_MODELS];
    if (preferredModel) {
      const preferred = modelsToRun.find((m) => m.id === preferredModel);
      if (preferred) {
        modelsToRun = [preferred, ...modelsToRun.filter((m) => m.id !== preferredModel)];
      }
    }

    const availableModels = nvidiaKey ? modelsToRun.slice(0, 3) : [OPENROUTER_FALLBACK];

    const results = await Promise.allSettled(
      availableModels.map((m) =>
        callModel(m.id, m.provider ?? "nvidia", messages, nvidiaKey, openRouterKey)
          .then((latex) => ({ model: m.id, modelLabel: m.label, latex }))
      )
    );

    const modelOutputs = results
      .filter(
        (r): r is PromiseFulfilledResult<{ model: string; modelLabel: string; latex: string }> =>
          r.status === "fulfilled"
      )
      .map(({ value }) => {
        // Score based on required skills (confirmed ones only) appearing in the output
        const requiredSkills = (jdData.requiredSkills as string[]) || [];
        const confirmedRequired = requiredSkills.filter((s) =>
          candidateSkillIds.includes(normalizeSkill(s))
        );
        const scoreSet = [...new Set([...confirmedRequired, ...taxonomyLabels])];
        const found = scoreSet.filter((kw) =>
          value.latex.toLowerCase().includes(kw.toLowerCase())
        ).length;
        const atsScore = Math.min(97, Math.round((found / Math.max(scoreSet.length, 1)) * 85 + 10));
        return { ...value, atsScore };
      });

    if (modelOutputs.length === 0) {
      throw new Error("All models failed to generate. Check your API keys.");
    }

    modelOutputs.sort((a, b) => b.atsScore - a.atsScore);

    return NextResponse.json({
      latex: modelOutputs[0].latex,
      atsScore: modelOutputs[0].atsScore,
      modelOutputs,
      candidateSkillsDetected: candidateSkillIds.map(displayName),
      requirementMapping,
      filesUsed: topFiles.map((f) => ({
        filename: f.filename,
        score: f.score,
        type: f.type,
        uploaded: f.path.startsWith("[uploaded]"),
      })),
      totalFilesScanned: localFiles.length + uploadedAsFileContent.length,
      role: jdData.role,
      company: jdData.company,
    });
  } catch (error) {
    console.error("Auto-generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auto-generation failed" },
      { status: 500 }
    );
  }
}
