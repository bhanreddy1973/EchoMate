import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { extractSkillsFromText, displayName } from "@/lib/skillsTaxonomy";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

/**
 * Auto-generate a tailored resume by:
 * 1. Scanning local .tex and .md files for relevant content
 * 2. Using AI to match the best content to the JD
 * 3. Generating a complete .tex file
 */

// Directories to scan for resume/work files
// - Project root (parent of app/): contains docs/, data/, echomate/ etc.
// - app/data/resume/: explicitly included since the app/ dir is otherwise skipped
const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const RESUME_DATA_DIR = path.join(process.cwd(), "data", "resume");

interface FileContent {
  filename: string;
  path: string;
  content: string;
  type: "tex" | "md";
}

async function scanFiles(): Promise<FileContent[]> {
  const files: FileContent[] = [];
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

  // Scan project root (skipping app/ directory)
  await walkDir(PROJECT_ROOT);
  // Explicitly scan app/data/resume/ which is skipped by the root scan
  await walkDir(RESUME_DATA_DIR, 0);
  return files;
}

function scoreFileRelevance(file: FileContent, keywords: string[], role: string, company: string): number {
  const lower = (file.content + " " + file.filename).toLowerCase();
  let score = 0;

  // Filename relevance
  const fnLower = file.filename.toLowerCase();
  if (fnLower.includes("resume")) score += 20;
  if (fnLower.includes(role.split(" ")[0]?.toLowerCase() || "xxx")) score += 15;
  if (fnLower.includes(company.toLowerCase())) score += 25;
  if (fnLower.includes("work") || fnLower.includes("project")) score += 10;
  if (fnLower.includes("skill")) score += 8;

  // Content keyword matching
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) score += 3;
  }

  // Role-specific keywords
  const roleWords = role.toLowerCase().split(/\s+/);
  for (const word of roleWords) {
    if (word.length > 2 && lower.includes(word)) score += 5;
  }

  // Tex files with resume in name are most relevant
  if (file.type === "tex" && fnLower.includes("resume")) score += 30;

  // Work documentation files are highly relevant
  if (fnLower.includes("documentation") || fnLower.includes("implementation")) score += 12;

  return score;
}

// Models to use for multi-output generation (highest quality first)
const GENERATION_MODELS = [
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B", provider: "nvidia" },
  { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "nvidia" },
  { id: "mistralai/mistral-small-3.1-24b-instruct", label: "Mistral Small 24B", provider: "nvidia" },
];
const OPENROUTER_FALLBACK = { id: "meta-llama/llama-3.1-70b-instruct:free", label: "Llama 3.1 70B (free)", provider: "openrouter" };

function buildSystemPrompt(): string {
  return `You are an expert ATS resume generator. Given a job description and the candidate's existing resume/work files, generate a COMPLETE, TAILORED .tex resume.

ABSOLUTE RULES:
1. Use ONLY information found in the provided files — NEVER fabricate experience, skills, projects, or achievements
2. Select the most relevant 3-4 experiences and 2-3 projects for this specific role
3. Include ATS-friendly keywords from the JD naturally in bullet points where they genuinely apply
4. Use the EXACT same LaTeX template structure as the candidate's existing .tex files
5. Keep the candidate's actual contact info, education, dates — NEVER change facts
6. Reframe existing bullets to highlight relevance to the target role (rephrase, do not invent)
7. If a .tex resume file exists for a similar role, use it as the primary template

OUTPUT: Return ONLY the complete .tex file content. No explanations, no markdown fences, no commentary.
The output must compile with pdflatex without errors.`;
}

function buildUserMessage(jdData: Record<string, unknown>, jobDescription: string, fileContext: string): string {
  return `## Target Job Description:
Company: ${jdData.company || "Unknown"}
Role: ${jdData.role || "Unknown"}
Required Skills: ${((jdData.requiredSkills as string[]) || []).join(", ")}
Preferred Skills: ${((jdData.preferredSkills as string[]) || []).join(", ")}
Keywords: ${((jdData.keywords as string[]) || []).join(", ")}
Responsibilities: ${((jdData.responsibilities as string[]) || []).join("; ")}

Full JD text:
${((jdData.rawText as string) || jobDescription || "").slice(0, 3000)}

## Candidate's Files (ranked by relevance to this JD):
${fileContext}

Generate the complete tailored .tex resume now. Use the template style from the highest-scored .tex file. Include ONLY real data from the files above.`;
}

async function callModel(
  modelId: string,
  provider: string,
  messages: { role: string; content: string }[],
  nvidiaKey: string,
  openRouterKey: string,
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
      temperature: 0.3,
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

    const jdData = parsedJd || { rawText: jobDescription, role: "", company: "", keywords: [], requiredSkills: [], preferredSkills: [] };

    // Augment keywords with taxonomy-extracted skills from JD text
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

    // Step 1: Combine uploaded files (highest priority) with scanned local files
    const localFiles = await scanFiles();
    const uploadedAsFileContent: FileContent[] = (uploadedFiles || []).map((f) => ({
      filename: f.filename,
      path: `[uploaded]/${f.filename}`,
      content: f.content,
      type: (f.type === "tex" || f.type === "md") ? f.type : "md",
    }));

    // Give uploaded files a high base score so they're always in the top context
    const scoredUploaded = uploadedAsFileContent.map((f) => ({
      ...f,
      score: scoreFileRelevance(f, allKeywords, (jdData.role as string) || "", (jdData.company as string) || "") + 100,
    }));

    const scoredLocal = localFiles.map((f) => ({
      ...f,
      score: scoreFileRelevance(f, allKeywords, (jdData.role as string) || "", (jdData.company as string) || ""),
    }));

    const allScored = [...scoredUploaded, ...scoredLocal].sort((a, b) => b.score - a.score);
    const topFiles = allScored.slice(0, 8);

    if (topFiles.length === 0) {
      return NextResponse.json({ error: "No resume files found. Please upload your .tex or .md resume files." }, { status: 404 });
    }

    // Build file context — uploaded files get a [UPLOADED - PRIMARY SOURCE] marker
    const fileContext = topFiles.map((f) => {
      const label = f.path.startsWith("[uploaded]") ? `[UPLOADED - PRIMARY SOURCE] ${f.filename}` : `${f.filename} (relevance: ${f.score})`;
      return `--- FILE: ${label} ---\n${f.content.slice(0, 4000)}\n`;
    }).join("\n\n");

    const messages = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserMessage(jdData, jobDescription || "", fileContext) },
    ];

    // Step 2: Determine which models to run
    // If preferredModel is set, put it first; always run 2-3 models for comparison
    let modelsToRun = [...GENERATION_MODELS];
    if (preferredModel) {
      const preferred = modelsToRun.find((m) => m.id === preferredModel);
      if (preferred) {
        modelsToRun = [preferred, ...modelsToRun.filter((m) => m.id !== preferredModel)];
      }
    }

    // Only use models we have keys for
    const availableModels = nvidiaKey
      ? modelsToRun.slice(0, 3) // all 3 NVIDIA models
      : [OPENROUTER_FALLBACK]; // fallback

    // Step 3: Generate with all models in parallel
    const results = await Promise.allSettled(
      availableModels.map((m) =>
        callModel(m.id, m.provider ?? "nvidia", messages, nvidiaKey, openRouterKey)
          .then((latex) => ({ model: m.id, modelLabel: m.label, latex }))
      )
    );

    const modelOutputs = results
      .filter((r): r is PromiseFulfilledResult<{ model: string; modelLabel: string; latex: string }> => r.status === "fulfilled")
      .map(({ value }) => {
        const keywordsFound = allKeywords.filter((kw) =>
          value.latex.toLowerCase().includes(kw.toLowerCase())
        ).length;
        const atsScore = Math.min(95, Math.round((keywordsFound / Math.max(allKeywords.length, 1)) * 85 + 10));
        return { ...value, atsScore };
      });

    if (modelOutputs.length === 0) {
      throw new Error("All models failed to generate. Check your API keys.");
    }

    // Sort by ATS score descending — best output first
    modelOutputs.sort((a, b) => b.atsScore - a.atsScore);

    return NextResponse.json({
      latex: modelOutputs[0].latex,
      atsScore: modelOutputs[0].atsScore,
      modelOutputs,
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
