import { NextRequest, NextResponse } from "next/server";
import { extractSkillsFromText, displayName } from "@/lib/skillsTaxonomy";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

function buildSystemPrompt(taxonomyKeywords: string[]): string {
  const kwHint = taxonomyKeywords.length
    ? `\n\nTAXONOMY ATS KEYWORDS: Weave these in naturally where evidenced by the candidate's actual experience:\n${taxonomyKeywords.join(", ")}`
    : "";
  return `You are an expert LaTeX resume generator. Create ATS-optimized resumes.

RULES:
1. Use ONLY the provided candidate data — NEVER fabricate experience
2. Apply confirmed suggestions (reframed bullets) exactly as provided
3. Skip rejected suggestions entirely
4. Include ATS keywords naturally where they fit existing experience
5. Use standard LaTeX with no custom packages beyond geometry, enumitem, hyperref, titlesec
6. No graphics, images, or columns — pure text for ATS parsing
7. Standard fonts only (Computer Modern is fine)

Output ONLY the complete .tex file content. No markdown fences, no explanation.${kwHint}`;
}

export async function POST(req: NextRequest) {
  try {
    const { masterResume, parsedJd, confirmedSuggestions, rejectedSuggestions, atsKeywords, model } = await req.json();

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
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://echomate.app", "X-Title": "EchoMate Career" };
    } else {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    // Augment ATS keywords with taxonomy-extracted skills from the JD
    const jdText = parsedJd.rawText || [parsedJd.role, ...(parsedJd.requiredSkills || []), ...(parsedJd.keywords || [])].join(" ");
    const taxonomyIds = extractSkillsFromText(jdText);
    const taxonomyKeywords = taxonomyIds.map((id) => displayName(id));
    const mergedKeywords = [...new Set([...(atsKeywords || []), ...taxonomyKeywords])];

    const userMessage = `## Target Role: ${parsedJd.role} at ${parsedJd.company}

## ATS Keywords to incorporate: ${mergedKeywords.join(", ")}

## Confirmed Suggestions (use these reframed bullets):
${JSON.stringify(confirmedSuggestions, null, 2)}

## Rejected Suggestions (do NOT use these):
${JSON.stringify(rejectedSuggestions?.map((s: { id: string }) => s.id) ?? [], null, 2)}

## Master Resume Data:
${JSON.stringify(masterResume, null, 2)}

Generate the complete .tex file now.`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: buildSystemPrompt(taxonomyKeywords) },
          { role: "user", content: userMessage },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = (await response.json()) as ApiResponse;
    let latex = data.choices?.[0]?.message?.content || "";

    // Clean up any markdown fences
    latex = latex.replace(/```latex\n?/g, "").replace(/```\n?/g, "").trim();

    // Simple ATS score calculation
    const keywordsFound = mergedKeywords.filter((kw: string) =>
      latex.toLowerCase().includes(kw.toLowerCase())
    ).length;
    const atsScore = Math.min(95, Math.round((keywordsFound / Math.max(mergedKeywords.length, 1)) * 85 + 10));

    return NextResponse.json({ latex, atsScore });
  } catch (error) {
    console.error("Career generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
