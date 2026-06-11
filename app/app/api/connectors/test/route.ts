import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface TestResult {
  valid: boolean;
  user?: { name: string; email?: string; avatar?: string; extra?: string };
  error?: string;
}

async function testGitHub(token: string): Promise<TestResult> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${token}`, "User-Agent": "EchoMate/1.0" },
  });
  if (!res.ok) return { valid: false, error: `GitHub: ${res.status} ${res.statusText}` };
  const d = await res.json();
  return { valid: true, user: { name: d.name || d.login, email: d.email ?? undefined, avatar: d.avatar_url, extra: `@${d.login}` } };
}

async function testNotion(token: string): Promise<TestResult> {
  const res = await fetch("https://api.notion.com/v1/users/me", {
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
  });
  if (!res.ok) return { valid: false, error: `Notion: ${res.status} ${res.statusText}` };
  const d = await res.json();
  const name = d.name || d.person?.email || "Notion User";
  return { valid: true, user: { name, email: d.person?.email } };
}

async function testSlack(token: string): Promise<TestResult> {
  const res = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const d = await res.json();
  if (!d.ok) return { valid: false, error: `Slack: ${d.error}` };
  return { valid: true, user: { name: d.user, extra: d.team } };
}

async function testGoogle(token: string): Promise<TestResult> {
  const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!res.ok) return { valid: false, error: "Google: invalid or expired token" };
  const d = await res.json();
  if (d.error_description) return { valid: false, error: `Google: ${d.error_description}` };
  return { valid: true, user: { name: d.email, email: d.email, extra: d.scope?.split(" ").length + " scopes" } };
}

async function testCustom(url: string, token?: string): Promise<TestResult> {
  if (!url) return { valid: true, user: { name: "Custom connector saved" } };
  const headers: Record<string, string> = { "User-Agent": "EchoMate/1.0" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers });
  if (!res.ok) return { valid: false, error: `${res.status} ${res.statusText}` };
  return { valid: true, user: { name: "Connected", extra: url } };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, token, url } = body as { provider: string; token?: string; url?: string };

    if (!provider) return NextResponse.json({ valid: false, error: "Missing provider" }, { status: 400 });

    let result: TestResult;
    switch (provider) {
      case "github":
        if (!token) return NextResponse.json({ valid: false, error: "Token required" });
        result = await testGitHub(token);
        break;
      case "notion":
        if (!token) return NextResponse.json({ valid: false, error: "Token required" });
        result = await testNotion(token);
        break;
      case "slack":
        if (!token) return NextResponse.json({ valid: false, error: "Token required" });
        result = await testSlack(token);
        break;
      case "google":
      case "gmail":
      case "calendar":
        if (!token) return NextResponse.json({ valid: false, error: "Access token required" });
        result = await testGoogle(token);
        break;
      default:
        result = await testCustom(url ?? "", token);
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ valid: false, error: msg }, { status: 500 });
  }
}
