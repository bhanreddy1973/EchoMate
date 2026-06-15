import { NextRequest, NextResponse } from "next/server";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

function buildSystemPrompt(): string {
  return `You are an expert career networking assistant. Write highly personalized cold outreach messages that reference the sender's ACTUAL work and skills.

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "body": "Full email/message body",
  "followUp": "Suggested follow-up message after 1 week",
  "tips": ["tip1", "tip2"]
}

RULES:
1. Use the sender's REAL name, skills, and experience provided — never use placeholders like [Your Name]
2. Reference 1-2 specific skills or achievements from their background that are RELEVANT to this company/role
3. Keep body under 150 words — concise and human, not corporate
4. Make the ask specific: referral, 15-min chat, or introductory call
5. Match the tone (professional/casual/enthusiastic)
6. No flattery, no "I hope this finds you well", no buzzwords
7. Return ONLY JSON, no markdown fences`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      contact, purpose, tone, userContext, userName,
      targetRole, targetCompany, topSkills, model,
    } = await req.json();

    if (!contact) {
      return NextResponse.json({ error: "Contact is required" }, { status: 400 });
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

    const purposeText = {
      referral: "ask for a referral for the role",
      "cold-outreach": "introduce myself and express interest in opportunities",
      "follow-up": "follow up on a previous conversation",
      informational: "request a 15-minute informational chat about the team",
    }[purpose as string] || "reach out professionally";

    const userMessage = `Write a ${tone || "professional"} message to reach out to ${contact.name} (${contact.title} at ${contact.company}).

SENDER INFO (use this — do not use placeholders):
${userContext || "Software engineer looking for new opportunities"}

GOAL: ${purposeText}
TARGET ROLE: ${targetRole || "Software Engineer"} at ${targetCompany || contact.company}
${topSkills?.length ? `SENDER'S RELEVANT SKILLS: ${(topSkills as string[]).join(", ")}` : ""}

CONTACT TYPE: ${contact.connectionType} — tailor the ask accordingly.
${contact.connectionType === "recruiter" ? "→ Ask about open roles or referral process." : ""}
${contact.connectionType === "hiring-manager" ? "→ Express interest in their team, mention specific skill alignment." : ""}
${contact.connectionType === "team-member" ? "→ Ask for an informational chat about the team/culture." : ""}

Write the message now. Use the sender's real name and mention 1-2 specific things from their background.`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.65,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = (await response.json()) as ApiResponse;
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        subject: `${targetRole || "Engineer"} opportunity — ${userName || "quick intro"}`,
        body: content || "Could not generate message. Please try again.",
        followUp: `Hi ${contact.name}, just following up on my previous message. Would love to connect!`,
        tips: ["Personalize further before sending", "Check LinkedIn profile for common connections"],
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Career email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email generation failed" },
      { status: 500 }
    );
  }
}
