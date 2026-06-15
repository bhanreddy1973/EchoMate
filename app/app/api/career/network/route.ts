import { NextRequest, NextResponse } from "next/server";

type ContactResult = {
  id: string;
  name: string;
  title: string;
  company: string;
  profileUrl: string;
  source: string;
  connectionType: "recruiter" | "hiring-manager" | "team-member" | "referral";
  activityLevel: "active" | "moderate" | "unknown";
  avatar?: string;
  location?: string;
  bio?: string;
};

// ─── GitHub API ─────────────────────────────────────────────────────────────
// Completely free. Finds real engineers who list the company in their profile.
async function searchGitHub(company: string, role: string): Promise<ContactResult[]> {
  const token = process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "EchoMate-Career/1.0",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Search by company field — returns real profiles
  const query = encodeURIComponent(`type:user company:"${company}"`);
  const res = await fetch(
    `https://api.github.com/search/users?q=${query}&per_page=10&sort=joined&order=desc`,
    { headers }
  );

  if (!res.ok) return [];

  const data = await res.json();
  const items: Record<string, unknown>[] = data.items || [];

  // Fetch detailed profiles (up to 6 to stay within rate limits)
  const detailed = await Promise.allSettled(
    items.slice(0, 6).map(async (u) => {
      const r = await fetch(`https://api.github.com/users/${u.login}`, { headers });
      if (!r.ok) return null;
      return r.json();
    })
  );

  const results: ContactResult[] = [];
  for (const res of detailed) {
    if (res.status !== "fulfilled" || !res.value) continue;
    const u = res.value as Record<string, unknown>;
    if (!u.name) continue; // Skip profiles with no real name

    const bio = ((u.bio as string) || "").toLowerCase();
    const titleFromBio = extractTitleFromBio(bio);
    const connectionType = inferConnectionType(titleFromBio, bio);

    results.push({
      id: `gh-${u.login}`,
      name: u.name as string,
      title: titleFromBio || (u.company as string) || "Engineer",
      company: company,
      profileUrl: (u.html_url as string) || `https://github.com/${u.login}`,
      source: "github",
      connectionType,
      activityLevel: (u.public_repos as number) > 5 ? "active" : "moderate",
      avatar: u.avatar_url as string,
      location: u.location as string,
      bio: (u.bio as string) || "",
    });
  }

  return results;
}

function extractTitleFromBio(bio: string): string {
  const patterns = [
    /(?:^|\s)(senior|staff|principal|lead|junior|sr\.?|jr\.?)\s+(?:software|frontend|backend|fullstack|ml|data|platform|devops)?\s*engineer/i,
    /(?:^|\s)(software|frontend|backend|fullstack|ml|ai|data|platform|devops)\s+engineer/i,
    /(?:^|\s)(engineering|product|technical|hr|talent)\s+manager/i,
    /(?:^|\s)(recruiter|talent acquisition|hiring|tech lead|architect)/i,
  ];
  for (const p of patterns) {
    const m = bio.match(p);
    if (m) return m[0].trim().replace(/^[,\s|•-]+/, "").trim();
  }
  return "";
}

function inferConnectionType(title: string, bio: string): ContactResult["connectionType"] {
  const text = (title + " " + bio).toLowerCase();
  if (/recruiter|talent acquisition|hr|hiring|people partner/.test(text)) return "recruiter";
  if (/engineering manager|em\b|tech lead|vp eng|director/.test(text)) return "hiring-manager";
  if (/senior|staff|principal|lead/.test(text)) return "team-member";
  return "team-member";
}

// ─── Google Custom Search API ────────────────────────────────────────────────
// 100 free queries/day. Needs GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID env vars
// OR keys passed from UI connectors panel.
async function searchGoogleCSE(
  company: string,
  role: string,
  apiKey: string,
  cseId: string
): Promise<ContactResult[]> {
  const queries = [
    `site:linkedin.com/in "${company}" "recruiter" OR "talent acquisition"`,
    `site:linkedin.com/in "${company}" "${role}" "hiring manager" OR "engineering manager"`,
  ];

  const results: ContactResult[] = [];

  for (const query of queries) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=5`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const data = await res.json();
    const items: Record<string, unknown>[] = data.items || [];

    for (const item of items) {
      const link = (item.link as string) || "";
      const title = (item.title as string) || "";
      const snippet = (item.snippet as string) || "";

      // Extract name from LinkedIn title format: "Name - Title at Company | LinkedIn"
      const nameMatch = title.match(/^([^-|]+)/);
      const titleMatch = title.match(/-\s*([^|]+)/);
      const name = nameMatch ? nameMatch[1].trim() : "";
      const jobTitle = titleMatch ? titleMatch[1].trim() : "";

      if (!name || name.length < 3) continue;

      const connectionType = inferConnectionType(jobTitle, snippet);

      results.push({
        id: `gcs-${Buffer.from(link).toString("base64").slice(0, 12)}`,
        name,
        title: jobTitle || "Professional",
        company,
        profileUrl: link,
        source: "google-cse",
        connectionType,
        activityLevel: "unknown",
        bio: snippet,
      });
    }
  }

  return results;
}

// ─── Tavily Search API ───────────────────────────────────────────────────────
// 1000 free queries/month. AI-powered, returns structured results.
// Needs TAVILY_API_KEY env var OR passed from UI.
async function searchTavily(
  company: string,
  role: string,
  apiKey: string
): Promise<ContactResult[]> {
  const query = `recruiters and hiring managers at ${company} for ${role} positions LinkedIn profiles`;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 8,
      include_domains: ["linkedin.com"],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const results: ContactResult[] = [];

  for (const item of (data.results || []) as Record<string, unknown>[]) {
    const url = (item.url as string) || "";
    const title = (item.title as string) || "";
    const content = (item.content as string) || "";

    if (!url.includes("linkedin.com/in/")) continue;

    const nameMatch = title.match(/^([^-|]+)/);
    const titleMatch = title.match(/-\s*([^|]+)/);
    const name = nameMatch ? nameMatch[1].trim() : "";
    const jobTitle = titleMatch ? titleMatch[1].trim() : "";

    if (!name || name.length < 3) continue;

    results.push({
      id: `tav-${Buffer.from(url).toString("base64").slice(0, 12)}`,
      name,
      title: jobTitle || "Professional",
      company,
      profileUrl: url,
      source: "tavily",
      connectionType: inferConnectionType(jobTitle, content),
      activityLevel: "unknown",
      bio: content.slice(0, 200),
    });
  }

  return results;
}

// ─── LLM Fallback ────────────────────────────────────────────────────────────
// Used only when no real search API is available.
// Clearly labelled as "AI-suggested" so user knows it's not verified.
async function llmFallback(company: string, role: string): Promise<ContactResult[]> {
  const nvidiaKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_INTEGRATE_API_KEY || "";
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  if (!nvidiaKey && !openRouterKey) return [];

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

  const systemPrompt = `You are a networking assistant. Generate REALISTIC (but unverified) networking contact suggestions.
IMPORTANT: These are AI-suggested names, not real verified profiles. Always set source to "ai-suggested".

Return ONLY a JSON array:
[{"id":"ai-1","name":"Full Name","title":"Job Title","company":"${company}","profileUrl":"https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(company + " " + role)}","source":"ai-suggested","connectionType":"recruiter|hiring-manager|team-member","activityLevel":"unknown"}]

Return 4-6 contacts. Use realistic names and titles for a ${company}-scale company. No markdown.`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Find contacts at "${company}" for a "${role}" role.` },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const content = (data.choices?.[0]?.message?.content || "[]")
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const contacts = JSON.parse(content);
    return Array.isArray(contacts) ? contacts : [];
  } catch {
    return [];
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { company, role, department, connectors = [] } = await req.json() as {
      company: string;
      role?: string;
      department?: string;
      connectors?: { type: string; apiKey?: string; extraConfig?: Record<string, string> }[];
    };

    if (!company) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    const targetRole = role || "Software Engineer";

    // Resolve API keys: UI-entered keys take priority, then env vars
    const getKey = (type: string) =>
      connectors.find((c) => c.type === type)?.apiKey || "";
    const getExtra = (type: string, field: string) =>
      connectors.find((c) => c.type === type)?.extraConfig?.[field] || "";

    const googleCseKey = getKey("google-cse") || process.env.GOOGLE_CSE_API_KEY || "";
    const googleCseId = getExtra("google-cse", "cseId") || process.env.GOOGLE_CSE_ID || "";
    const tavilyKey = getKey("perplexity") || process.env.TAVILY_API_KEY || "";

    // Run all available sources in parallel
    const [githubResults, googleResults, tavilyResults] = await Promise.allSettled([
      searchGitHub(company, targetRole),
      googleCseKey && googleCseId
        ? searchGoogleCSE(company, targetRole, googleCseKey, googleCseId)
        : Promise.resolve([]),
      tavilyKey
        ? searchTavily(company, targetRole, tavilyKey)
        : Promise.resolve([]),
    ]);

    const realContacts: ContactResult[] = [
      ...(githubResults.status === "fulfilled" ? githubResults.value : []),
      ...(googleResults.status === "fulfilled" ? googleResults.value : []),
      ...(tavilyResults.status === "fulfilled" ? tavilyResults.value : []),
    ];

    // Deduplicate by name (case-insensitive)
    const seen = new Set<string>();
    const dedupedContacts = realContacts.filter((c) => {
      const key = c.name.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // If no real results, fall back to LLM with clear labelling
    const finalContacts =
      dedupedContacts.length > 0
        ? dedupedContacts
        : await llmFallback(company, targetRole);

    // Generate Google Dork queries for manual use
    const dorkQueries = [
      `site:linkedin.com/in "${company}" "recruiter" OR "talent acquisition"`,
      `site:linkedin.com/in "${company}" "${targetRole}" "hiring manager"`,
      `site:linkedin.com/in "${company}" "engineering manager" OR "tech lead"`,
      `"${company}" careers referral program hiring`,
    ];

    const sourcesUsed = [
      "github",
      ...(googleCseKey && googleCseId ? ["google-cse"] : []),
      ...(tavilyKey ? ["tavily"] : []),
      ...(dedupedContacts.length === 0 ? ["ai-suggested"] : []),
    ];

    return NextResponse.json({
      contacts: finalContacts,
      sourcesUsed,
      searchStrategies: {
        googleDorkQueries: dorkQueries,
        linkedinSearchUrls: [
          `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company + " recruiter " + targetRole)}&origin=GLOBAL_SEARCH_HEADER`,
        ],
        perplexityQuery: `Who are the active recruiters and hiring managers at ${company} for ${targetRole} roles?`,
      },
    });
  } catch (error) {
    console.error("Career network error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
