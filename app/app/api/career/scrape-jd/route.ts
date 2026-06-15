import { NextRequest, NextResponse } from "next/server";
import TurndownService from "turndown";

type ApiResponse = { choices?: { message?: { content?: string } }[] };

/**
 * Scrape a job description from a URL (LinkedIn, Greenhouse, Lever, generic)
 * Then use AI to extract structured data from the scraped content
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Step 1: Try specialized extractors for known platforms
    let textContent = "";

    // Microsoft Careers — SPA, need to try their API
    if (url.includes("careers.microsoft.com") || url.includes("microsoft.com/careers")) {
      const jobIdMatch = url.match(/(\d{10,})/);
      if (jobIdMatch) {
        const jobId = jobIdMatch[1];
        // Try Microsoft's search endpoint
        try {
          const msRes = await fetch(`https://careers.microsoft.com/professionals/us/en/job/${jobId}`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml",
            },
            redirect: "follow",
          });
          if (msRes.ok) {
            const msHtml = await msRes.text();
            // Extract LD+JSON structured data if present
            const ldJsonMatch = msHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
            if (ldJsonMatch) {
              try {
                const ldData = JSON.parse(ldJsonMatch[1]);
                if (ldData.description || ldData.title) {
                  textContent = `Job Title: ${ldData.title || ""}\nCompany: ${ldData.hiringOrganization?.name || "Microsoft"}\nLocation: ${ldData.jobLocation?.address?.addressLocality || ""}\nDescription: ${ldData.description || ""}\nQualifications: ${ldData.qualifications || ""}`;
                }
              } catch { /* continue to generic parsing */ }
            }
            if (!textContent) {
              // Try to extract from HTML body
              const cleanHtml = msHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
              const turndown = new TurndownService({ headingStyle: "atx" });
              try { textContent = turndown.turndown(cleanHtml); } catch {
                textContent = cleanHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
              }
            }
          }
        } catch { /* fall through to generic fetch */ }
      }

      // If MS page gave us mostly config junk, provide helpful fallback
      if (!textContent || textContent.length < 200) {
        return NextResponse.json({
          error: "Microsoft Careers uses a JavaScript-rendered page. Please copy the job description text from the page and paste it directly into the text area.",
          rawText: "",
          company: "Microsoft",
          role: "",
          requiredSkills: [],
          preferredSkills: [],
          keywords: [],
          responsibilities: [],
        });
      }
    }

    // LinkedIn Jobs — try the actual page
    if (url.includes("linkedin.com/jobs") && !textContent) {
      try {
        const liRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept": "text/html",
          },
          redirect: "follow",
        });
        if (liRes.ok) {
          const liHtml = await liRes.text();
          // LinkedIn often includes structured data for bots
          const ldJsonMatch = liHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
          if (ldJsonMatch) {
            try {
              const ldData = JSON.parse(ldJsonMatch[1]);
              textContent = `Job Title: ${ldData.title || ""}\nCompany: ${ldData.hiringOrganization?.name || ""}\nLocation: ${ldData.jobLocation?.address?.addressLocality || ""}\nDescription: ${ldData.description || ""}`;
            } catch { /* continue */ }
          }
          if (!textContent) {
            const turndown = new TurndownService({ headingStyle: "atx" });
            const clean = liHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
            try { textContent = turndown.turndown(clean); } catch {
              textContent = clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
            }
          }
        }
      } catch { /* fall through */ }
    }

    // Step 2: Generic fetch for all other sites (Greenhouse, Lever, Workday, etc.)
    if (!textContent) {
      let html = "";
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          redirect: "follow",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
      } catch (fetchErr) {
        return NextResponse.json({ error: `Failed to fetch URL: ${fetchErr instanceof Error ? fetchErr.message : "Network error"}` }, { status: 400 });
      }

      // Check for LD+JSON structured data first (most reliable)
      const ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
      if (ldJsonMatch) {
        try {
          const ldData = JSON.parse(ldJsonMatch[1]);
          if (ldData.description || ldData["@type"] === "JobPosting") {
            textContent = `Job Title: ${ldData.title || ""}\nCompany: ${ldData.hiringOrganization?.name || ""}\nLocation: ${ldData.jobLocation?.address?.addressLocality || ""}, ${ldData.jobLocation?.address?.addressCountry || ""}\nDescription: ${ldData.description || ""}\nQualifications: ${ldData.qualifications || ldData.experienceRequirements || ""}`;
          }
        } catch { /* continue to HTML parsing */ }
      }

      if (!textContent) {
        // Remove script, style, nav, footer elements
        const cleanHtml = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "");

        const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
        try {
          textContent = turndown.turndown(cleanHtml);
        } catch {
          textContent = cleanHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
      }
    }

    // Trim to reasonable size for AI processing
    const trimmedContent = textContent.slice(0, 12000);

    // If content is too short (likely a SPA with no server-rendered content), return what we have
    if (trimmedContent.length < 100) {
      return NextResponse.json({
        error: "This page appears to be a JavaScript-rendered app. The content couldn't be extracted via scraping. Try copying the job description text manually and pasting it directly.",
        rawText: trimmedContent || "",
        company: url.includes("microsoft") ? "Microsoft" : "",
        role: "",
      });
    }

    // If content is suspiciously long (likely includes lots of config/nav), truncate more aggressively
    const finalContent = trimmedContent.length > 8000 ? trimmedContent.slice(0, 8000) : trimmedContent;

    // Step 3: Use AI to extract structured JD from the scraped content
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
      modelId = "meta/llama-3.3-70b-instruct";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    } else if (openRouterKey) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = openRouterKey;
      modelId = "meta-llama/llama-3.1-70b-instruct:free";
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://echomate.app", "X-Title": "EchoMate Career" };
    } else {
      // No AI key — return raw text
      return NextResponse.json({ rawText: finalContent, company: "", role: "" });
    }

    const systemPrompt = `You extract job descriptions from web page content. Return ONLY valid JSON:
{
  "rawText": "The full job description text (responsibilities, requirements, etc.)",
  "company": "Company name",
  "role": "Job title",
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1"],
  "keywords": ["keyword1", "keyword2"],
  "responsibilities": ["resp1", "resp2"],
  "location": "Location if mentioned",
  "experience": "Years of experience required"
}

RULES:
- Extract ONLY factual information from the page
- If a field isn't found, use empty string or empty array
- requiredSkills = explicitly listed as required/must-have
- preferredSkills = nice-to-have/preferred
- keywords = technical terms, tools, frameworks mentioned
- Return ONLY JSON, no markdown fences`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract the job description from this web page content:\n\n${finalContent}` },
        ],
        max_tokens: 3000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      // Fallback: return raw text
      return NextResponse.json({ rawText: finalContent, company: "Unknown", role: "Unknown" });
    }

    const data = (await response.json()) as ApiResponse;
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { rawText: finalContent, company: "Unknown", role: "Unknown", requiredSkills: [], preferredSkills: [], keywords: [], responsibilities: [] };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Scrape JD error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scrape job URL" },
      { status: 500 }
    );
  }
}
