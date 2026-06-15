import { NextRequest, NextResponse } from "next/server";
import { extractSkillsFromText, normalizeSkill, displayName } from "@/lib/skillsTaxonomy";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

function buildSystemPrompt(taxonomySkills: string[]): string {
  const skillHint = taxonomySkills.length
    ? `\n\nTAXONOMY PRE-MATCH: The following skills were detected in the JD by static analysis — include these in parsedJd.requiredSkills and check them against the resume:\n${taxonomySkills.join(", ")}`
    : "";
  return buildBaseSystemPrompt() + skillHint;
}

function buildBaseSystemPrompt(): string {
  return `You are an expert career analyst and resume advisor. You analyze job descriptions against a candidate's resume to determine fit.

ABSOLUTE RULES — VIOLATION IS UNACCEPTABLE:
1. NEVER fabricate, invent, or add experience the user does not have
2. NEVER add skills or keywords not evidenced in user's data
3. Every suggestion MUST cite experienceId from the provided data
4. If there's a gap, state it as a gap — do NOT paper over it
5. "Reframing" means REPHRASING existing work, not INVENTING new work

Your response MUST be valid JSON with this exact structure:
{
  "analysis": {
    "overallScore": <0-100>,
    "atsScore": <0-100>,
    "matchingSkills": [{"skill": "", "source": "experienceId or skillsList", "confidence": 0.0-1.0, "evidenceSnippet": ""}],
    "missingSkills": [{"skill": "", "importance": "critical|important|nice-to-have", "bridgeable": true/false, "suggestion": ""}],
    "suggestions": [{"id": "sug-1", "experienceId": "MUST match an experience id", "originalBullet": "", "suggestedBullet": "", "reason": "", "status": "pending"}],
    "strengthBadges": ["badge1"],
    "riskBadges": ["risk1"]
  },
  "parsedJd": {
    "rawText": "",
    "company": "",
    "role": "",
    "requiredSkills": [],
    "preferredSkills": [],
    "keywords": [],
    "responsibilities": []
  }
}

Return ONLY the JSON, no markdown fences, no extra text.`;
}

export async function POST(req: NextRequest) {
  try {
    const { jobDescription, masterResume, model, tier } = await req.json();

    if (!jobDescription || !masterResume) {
      return NextResponse.json({ error: "Missing jobDescription or masterResume" }, { status: 400 });
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
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://echomate.app", "X-Title": "EchoMate Career" };
    } else {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    // Pre-extract skills using the 578-skill taxonomy before sending to AI
    const taxonomySkillIds = extractSkillsFromText(jobDescription);
    const taxonomySkillLabels = taxonomySkillIds.map((id) => displayName(id));

    const userMessage = `## Job Description:\n${jobDescription}\n\n## Candidate Resume Data (JSON):\n${JSON.stringify(masterResume, null, 2)}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: buildSystemPrompt(taxonomySkillLabels) },
          { role: "user", content: userMessage },
        ],
        max_tokens: 4096,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      // Retry with fallback
      if (apiUrl.includes("nvidia.com") && openRouterKey) {
        const fallbackRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "HTTP-Referer": "https://echomate.app", "X-Title": "EchoMate Career" },
          body: JSON.stringify({
            model: "meta-llama/llama-3.1-70b-instruct:free",
            messages: [
              { role: "system", content: buildSystemPrompt(taxonomySkillLabels) },
              { role: "user", content: userMessage },
            ],
            max_tokens: 4096,
            temperature: 0.4,
          }),
        });
        if (fallbackRes.ok) {
          const data = (await fallbackRes.json()) as ApiResponse;
          const content = data.choices?.[0]?.message?.content || "";
          const parsed = JSON.parse(content);
          return NextResponse.json(parsed);
        }
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = (await response.json()) as ApiResponse;
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse the JSON response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, return a basic structure
      parsed = {
        analysis: {
          overallScore: 50,
          atsScore: 50,
          matchingSkills: [],
          missingSkills: [],
          suggestions: [],
          strengthBadges: ["Resume analyzed"],
          riskBadges: ["Parsing incomplete"],
        },
        parsedJd: {
          rawText: jobDescription,
          company: "Unknown",
          role: "Unknown",
          requiredSkills: [],
          preferredSkills: [],
          keywords: [],
          responsibilities: [],
        },
      };
    }

    // Post-processing 1: validate suggestion experienceIds
    if (parsed.analysis?.suggestions && masterResume.experiences) {
      const validIds = new Set([
        ...masterResume.experiences.map((e: { id: string }) => e.id),
        ...masterResume.projects.map((p: { id: string }) => p.id),
      ]);
      parsed.analysis.suggestions = parsed.analysis.suggestions.filter(
        (s: { experienceId: string }) => validIds.has(s.experienceId)
      );
    }

    // Post-processing 2: merge taxonomy-detected skills into parsedJd.requiredSkills
    // (de-duplicate by canonical id so "React" and "react.js" don't appear twice)
    if (parsed.parsedJd && taxonomySkillIds.length > 0) {
      const existingNorm = new Set(
        (parsed.parsedJd.requiredSkills || []).map((s: string) => normalizeSkill(s))
      );
      const toAdd = taxonomySkillIds
        .filter((id) => !existingNorm.has(id))
        .map((id) => displayName(id));
      parsed.parsedJd.requiredSkills = [...(parsed.parsedJd.requiredSkills || []), ...toAdd];
      // Also surface in keywords
      parsed.parsedJd.keywords = [
        ...new Set([...(parsed.parsedJd.keywords || []), ...taxonomySkillLabels]),
      ];
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Career analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
