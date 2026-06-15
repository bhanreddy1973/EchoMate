import { NextRequest, NextResponse } from "next/server";
import { extractSkillsFromText, normalizeSkill, displayName } from "@/lib/skillsTaxonomy";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

interface SkillMatch {
  skill: string;
  source: string;
  confidence: number;
  evidenceSnippet: string;
}

interface SkillGap {
  skill: string;
  importance: "critical" | "important" | "nice-to-have";
  bridgeable: boolean;
  suggestion: string;
}

interface FramingSuggestion {
  id: string;
  experienceId: string;
  originalBullet: string;
  suggestedBullet: string;
  reason: string;
  status: "pending" | "accepted" | "rejected" | "edited";
  editedText?: string;
}

interface FitAnalysis {
  matchingSkills?: SkillMatch[];
  missingSkills?: SkillGap[];
  suggestions?: FramingSuggestion[];
}

// Build a requirement→evidence mapping string for the prompt
function buildRequirementMapping(
  requiredSkills: string[],
  preferredSkills: string[],
  responsibilities: string[],
  fitAnalysis: FitAnalysis | undefined,
  confirmedSuggestions: FramingSuggestion[],
  rejectedSuggestions: FramingSuggestion[]
): string {
  const lines: string[] = [];

  // Map each required skill to candidate evidence
  if (requiredSkills.length > 0) {
    lines.push("### REQUIRED SKILLS → CANDIDATE EVIDENCE:");
    for (const skill of requiredSkills) {
      const matchNorm = normalizeSkill(skill);
      const match = fitAnalysis?.matchingSkills?.find(
        (m) => normalizeSkill(m.skill) === matchNorm || m.skill.toLowerCase() === skill.toLowerCase()
      );
      if (match) {
        lines.push(`  ✓ ${skill}: CONFIRMED — "${match.evidenceSnippet}" (source: ${match.source})`);
      } else {
        lines.push(`  ✗ ${skill}: NOT FOUND IN RESUME — DO NOT FABRICATE THIS SKILL`);
      }
    }
    lines.push("");
  }

  // List preferred skills with evidence
  if (preferredSkills.length > 0) {
    lines.push("### PREFERRED SKILLS → CANDIDATE EVIDENCE:");
    for (const skill of preferredSkills) {
      const matchNorm = normalizeSkill(skill);
      const match = fitAnalysis?.matchingSkills?.find(
        (m) => normalizeSkill(m.skill) === matchNorm || m.skill.toLowerCase() === skill.toLowerCase()
      );
      if (match) {
        lines.push(`  ✓ ${skill}: CONFIRMED — "${match.evidenceSnippet}"`);
      } else {
        lines.push(`  — ${skill}: not confirmed`);
      }
    }
    lines.push("");
  }

  // List JD responsibilities
  if (responsibilities.length > 0) {
    lines.push("### JD RESPONSIBILITIES (mirror this language in tailored bullets):");
    responsibilities.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    lines.push("");
  }

  // Confirmed suggestion rewrites — must be used EXACTLY
  if (confirmedSuggestions.length > 0) {
    lines.push("### CONFIRMED BULLET REWRITES — USE EXACTLY AS WRITTEN:");
    for (const s of confirmedSuggestions) {
      const finalText = s.editedText || s.suggestedBullet;
      lines.push(`  Experience ID: ${s.experienceId}`);
      lines.push(`  REPLACE: "${s.originalBullet}"`);
      lines.push(`  WITH:    "${finalText}"`);
      lines.push(`  Reason: ${s.reason}`);
      lines.push("");
    }
  }

  // Rejected suggestions — keep original
  if (rejectedSuggestions.length > 0) {
    lines.push("### REJECTED REWRITES — USE ORIGINAL BULLETS FOR THESE:");
    for (const s of rejectedSuggestions) {
      lines.push(`  Experience ID: ${s.experienceId} → Keep original: "${s.originalBullet}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildSystemPrompt(): string {
  return `You are an expert LaTeX resume generator specializing in ATS-optimized resumes.

ABSOLUTE RULES — NEVER VIOLATE:
1. Use ONLY candidate data provided — NEVER fabricate skills, experience, achievements, or companies
2. Apply CONFIRMED BULLET REWRITES word-for-word — copy the exact text, do not paraphrase
3. For REJECTED rewrites: keep the original bullet, do not use the suggested version
4. Never add a skill, tool, or technology not present in the candidate's data
5. If a JD requirement has no candidate evidence, do not add it — it is a real gap
6. Use standard LaTeX packages only: geometry, enumitem, hyperref, titlesec, fontenc, inputenc
7. No graphics, images, multicol, or custom fonts — pure text layout for ATS parsing
8. The output must compile with pdflatex without errors

QUALITY REQUIREMENTS:
- Mirror JD language in bullets where candidate has real evidence (use exact phrases from JD where applicable)
- Lead every bullet with a strong action verb (Engineered, Designed, Built, Optimized, Led, Reduced, Increased)
- Include quantifiable metrics from candidate data wherever present (%, $, ms, users, scale)
- Order experiences to put most JD-relevant experience first
- Skills section: list ONLY skills that appear in both JD requirements AND candidate data
- Summary/objective (if included): directly address the target role and company

OUTPUT: Return ONLY the complete .tex file content. No markdown fences, no commentary, no explanation.`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      masterResume,
      parsedJd,
      fitAnalysis,
      confirmedSuggestions,
      rejectedSuggestions,
      atsKeywords,
      model,
    } = await req.json() as {
      masterResume: Record<string, unknown>;
      parsedJd: Record<string, unknown>;
      fitAnalysis?: FitAnalysis;
      confirmedSuggestions?: FramingSuggestion[];
      rejectedSuggestions?: FramingSuggestion[];
      atsKeywords?: string[];
      model?: string;
    };

    if (!masterResume || !parsedJd) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const nvidiaKey = process.env.NVIDIA_NIM_API_KEY;
    const nvidiaIntegrateKey = process.env.NVIDIA_INTEGRATE_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    let apiUrl: string;
    let apiKey: string;
    let modelId: string;
    let headers: Record<string, string>;

    if (nvidiaKey || nvidiaIntegrateKey) {
      apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      apiKey = nvidiaKey || nvidiaIntegrateKey || "";
      modelId = model || "meta/llama-3.3-70b-instruct";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    } else if (openRouterKey) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = openRouterKey;
      modelId = "meta-llama/llama-3.1-70b-instruct:free";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://echomate.app",
        "X-Title": "EchoMate Career",
      };
    } else {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    // Build merged keyword set from all sources
    const jdText = (parsedJd.rawText as string) ||
      [parsedJd.role, ...(parsedJd.requiredSkills as string[] || []), ...(parsedJd.keywords as string[] || [])].join(" ");
    const taxonomyIds = extractSkillsFromText(jdText);
    const taxonomyKeywords = taxonomyIds.map((id) => displayName(id));
    const mergedKeywords = [
      ...new Set([
        ...(atsKeywords || []),
        ...taxonomyKeywords,
        ...(parsedJd.requiredSkills as string[] || []),
        ...(parsedJd.preferredSkills as string[] || []),
      ]),
    ];

    const confirmedList: FramingSuggestion[] = confirmedSuggestions || [];
    const rejectedList: FramingSuggestion[] = rejectedSuggestions || [];

    // Build the structured requirement→evidence mapping
    const requirementMapping = buildRequirementMapping(
      parsedJd.requiredSkills as string[] || [],
      parsedJd.preferredSkills as string[] || [],
      parsedJd.responsibilities as string[] || [],
      fitAnalysis,
      confirmedList,
      rejectedList
    );

    const userMessage = `## TARGET ROLE: ${parsedJd.role} at ${parsedJd.company}

## ATS KEYWORDS TO INCORPORATE (only where genuinely evidenced):
${mergedKeywords.join(", ")}

${requirementMapping}

## CANDIDATE MASTER RESUME DATA:
${JSON.stringify(masterResume, null, 2)}

---
INSTRUCTIONS:
1. Generate a complete, tailored .tex resume for the role above
2. Follow every CONFIRMED BULLET REWRITE exactly — do not paraphrase
3. Skip all REJECTED rewrites and use the original bullet text
4. For required skills marked ✓ CONFIRMED: weave them prominently into relevant bullets
5. For required skills marked ✗ NOT FOUND: do not add them — they are genuine gaps
6. Mirror JD language from responsibilities in bullet points where evidence exists
7. Skills section: only list skills present in BOTH JD requirements AND candidate data

Generate the complete .tex file now:`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userMessage },
        ],
        max_tokens: 5000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = (await response.json()) as ApiResponse;
    let latex = data.choices?.[0]?.message?.content || "";

    // Clean up any markdown fences
    latex = latex.replace(/```latex\n?/g, "").replace(/```tex\n?/g, "").replace(/```\n?/g, "").trim();

    // Validate confirmed suggestions actually appear in the output
    const missedSuggestions: string[] = [];
    for (const s of confirmedList) {
      const finalText = (s.editedText || s.suggestedBullet).slice(0, 40).toLowerCase();
      if (finalText && !latex.toLowerCase().includes(finalText)) {
        missedSuggestions.push(s.id);
      }
    }

    // ATS score: count how many required/preferred skills appear in the output
    const requiredSkills = parsedJd.requiredSkills as string[] || [];
    const confirmedSkills = fitAnalysis?.matchingSkills?.map((m) => m.skill) || [];
    const skillsToScore = [...new Set([...confirmedSkills, ...requiredSkills])];
    const keywordsFound = skillsToScore.filter((kw: string) =>
      latex.toLowerCase().includes(kw.toLowerCase())
    ).length;
    const atsScore = Math.min(97, Math.round((keywordsFound / Math.max(skillsToScore.length, 1)) * 85 + 10));

    return NextResponse.json({
      latex,
      atsScore,
      keywordsFound,
      totalKeywords: skillsToScore.length,
      missedSuggestions: missedSuggestions.length > 0 ? missedSuggestions : undefined,
    });
  } catch (error) {
    console.error("Career generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
