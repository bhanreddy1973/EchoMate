import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DOCS_ROOT = join(process.cwd(), "..");

const ALLOWED = new Set(["WORKFLOW.md", "SETUP.md", "README.md"]);

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");

  if (!file || !ALLOWED.has(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = join(DOCS_ROOT, file);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = readFileSync(filePath, "utf-8");
  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
