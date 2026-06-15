import { NextRequest, NextResponse } from "next/server";
import { YoeLevel, JobSearchResult } from "@/types/career";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

const YOE_LABELS: Record<YoeLevel, string> = {
  intern: "Internship / Co-op",
  fresher: "Entry Level (0–1 year)",
  junior: "Junior (1–3 years)",
  mid: "Mid-Level (3–6 years)",
  senior: "Senior (6–10 years)",
  staff: "Staff / Principal (10+ years)",
};

// LinkedIn experience filter values
const LINKEDIN_EXP: Record<YoeLevel, string> = {
  intern: "1",
  fresher: "2",
  junior: "2,3",
  mid: "4",
  senior: "4,5",
  staff: "5,6",
};

// Indeed experience labels
const INDEED_EXP: Record<YoeLevel, string> = {
  intern: "internship",
  fresher: "entry_level",
  junior: "entry_level",
  mid: "mid_level",
  senior: "senior_level",
  staff: "senior_level",
};

function buildJobBoardLinks(role: string, location: string, yoeLevel: YoeLevel) {
  const encodedRole = encodeURIComponent(role);
  const encodedLoc = encodeURIComponent(location || "");
  const linkedinExp = LINKEDIN_EXP[yoeLevel];
  const indeedExp = INDEED_EXP[yoeLevel];

  const links = [
    {
      platform: "LinkedIn",
      label: `LinkedIn Jobs — ${role}`,
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodedRole}${encodedLoc ? `&location=${encodedLoc}` : ""}&f_E=${linkedinExp}&sortBy=DD`,
    },
    {
      platform: "Indeed",
      label: `Indeed — ${role}`,
      url: `https://www.indeed.com/jobs?q=${encodedRole}&explvl=${indeedExp}${encodedLoc ? `&l=${encodedLoc}` : ""}`,
    },
    {
      platform: "Glassdoor",
      label: `Glassdoor — ${role}`,
      url: `https://www.glassdoor.com/Job/jobs.htm?suggestChosen=false&clickSource=searchBtn&typedKeyword=${encodedRole}${encodedLoc ? `&locT=C&locKeyword=${encodedLoc}` : ""}`,
    },
    {
      platform: "Wellfound",
      label: `Wellfound (Startups) — ${role}`,
      url: `https://wellfound.com/jobs?q=${encodedRole}${encodedLoc ? `&l=${encodedLoc}` : ""}`,
    },
    {
      platform: "Naukri",
      label: `Naukri — ${role}`,
      url: `https://www.naukri.com/${role.toLowerCase().replace(/\s+/g, "-")}-jobs${encodedLoc ? `?location=${encodedLoc}` : ""}`,
    },
    {
      platform: "Google Jobs",
      label: `Google Jobs — ${role}`,
      url: `https://www.google.com/search?q=${encodedRole}+${yoeLevel === "intern" ? "internship" : "jobs"}${encodedLoc ? `+${encodedLoc}` : ""}&ibp=htl;jobs`,
    },
  ];

  return links;
}

function buildSystemPrompt(): string {
  return `You are a job market intelligence assistant. Given a role and experience level, generate realistic job search results.

Return ONLY valid JSON in this exact shape:
{
  "jobs": [
    {
      "id": "job-1",
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, Country or Remote",
      "type": "full-time|part-time|contract|internship|remote",
      "level": "experience level label",
      "description": "2-3 sentence job description snippet",
      "skills": ["skill1", "skill2", "skill3"],
      "applyUrl": "https://www.linkedin.com/jobs/search/?keywords=...",
      "source": "LinkedIn",
      "postedAt": "2d ago"
    }
  ],
  "insights": "2-3 sentence market insight about this role and level",
  "topCompanies": ["Company1", "Company2", "Company3", "Company4", "Company5"]
}

RULES:
- Generate 6-8 realistic job listings
- Use well-known real companies (Google, Microsoft, Amazon, startups, etc.)
- Match job type and responsibilities to the experience level
- skills array: 3-5 relevant tech skills
- applyUrl: generate a LinkedIn job search URL for this specific role
- insights: mention hiring trends, salary range, remote availability
- Return ONLY the JSON, no markdown fences`;
}

export async function POST(req: NextRequest) {
  try {
    const { role, location, yoeLevel } = (await req.json()) as {
      role: string;
      location?: string;
      yoeLevel: YoeLevel;
    };

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    const nvidiaKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_INTEGRATE_API_KEY || "";
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";

    if (!nvidiaKey && !openRouterKey) {
      return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
    }

    const isNvidia = !!nvidiaKey;
    const apiUrl = isNvidia
      ? "https://integrate.api.nvidia.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
    const apiKey = isNvidia ? nvidiaKey : openRouterKey;
    const modelId = isNvidia ? "meta/llama-3.3-70b-instruct" : "meta-llama/llama-3.1-70b-instruct:free";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(!isNvidia ? { "HTTP-Referer": "https://echomate.app", "X-Title": "EchoMate Career" } : {}),
    };

    const levelLabel = YOE_LABELS[yoeLevel] || yoeLevel;
    const userMessage = `Find job listings for: "${role}"
Experience Level: ${levelLabel}
${location ? `Preferred Location: ${location}` : "Location: Open / Remote"}

Generate realistic job listings matching this role and experience level. Include a variety of companies (big tech, mid-size, startups). For internship/fresher levels, focus on early-career-friendly companies.`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userMessage },
        ],
        max_tokens: 3000,
        temperature: 0.5,
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = (await res.json()) as ApiResponse;
    const content = data.choices?.[0]?.message?.content || "{}";

    let parsed: { jobs?: unknown[]; insights?: string; topCompanies?: string[] } = {};
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { jobs: [], insights: "", topCompanies: [] };
    }

    const jobs = ((parsed.jobs || []) as Record<string, unknown>[]).map((j, i) => ({
      id: (j.id as string) || `job-${i + 1}`,
      title: (j.title as string) || role,
      company: (j.company as string) || "Unknown",
      location: (j.location as string) || location || "Remote",
      type: (["full-time", "part-time", "contract", "internship", "remote"].includes(j.type as string)
      ? j.type
      : "full-time") as "full-time" | "part-time" | "contract" | "internship" | "remote",
      level: (j.level as string) || levelLabel,
      description: (j.description as string) || "",
      skills: (j.skills as string[]) || [],
      applyUrl: (j.applyUrl as string) || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}`,
      source: (j.source as string) || "LinkedIn",
      postedAt: (j.postedAt as string) || "",
    }));

    const jobBoardLinks = buildJobBoardLinks(role, location || "", yoeLevel);

    const result: JobSearchResult = {
      jobs,
      jobBoardLinks,
      insights: (parsed.insights as string) || "",
      topCompanies: (parsed.topCompanies as string[]) || [],
      searchQueries: [
        `${role} ${levelLabel} jobs${location ? ` ${location}` : ""}`,
        `site:linkedin.com/jobs "${role}" "${levelLabel}"`,
        `"${role}" hiring ${yoeLevel === "intern" ? "intern" : "full-time"}${location ? ` ${location}` : ""}`,
      ],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Job search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job search failed" },
      { status: 500 }
    );
  }
}
