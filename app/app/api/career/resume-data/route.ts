import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const RESUME_PATH = path.join(process.cwd(), "data", "resume", "master_resume.json");

const DEFAULT_RESUME = {
  contact: { name: "", email: "", phone: "", linkedin: "", github: "", website: "", location: "" },
  summary: "",
  experiences: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
};

async function ensureDir() {
  const dir = path.dirname(RESUME_PATH);
  await fs.mkdir(dir, { recursive: true });
}

export async function GET() {
  try {
    await ensureDir();
    let resume;
    try {
      const raw = await fs.readFile(RESUME_PATH, "utf-8");
      resume = JSON.parse(raw);
    } catch {
      resume = DEFAULT_RESUME;
      await fs.writeFile(RESUME_PATH, JSON.stringify(resume, null, 2));
    }
    return NextResponse.json({ resume });
  } catch (error) {
    console.error("Resume-data GET error:", error);
    return NextResponse.json({ resume: DEFAULT_RESUME });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDir();
    const { resume } = await req.json();
    await fs.writeFile(RESUME_PATH, JSON.stringify(resume, null, 2));
    return NextResponse.json({ success: true, resume });
  } catch (error) {
    console.error("Resume-data POST error:", error);
    return NextResponse.json({ error: "Failed to create resume" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureDir();
    const { resume } = await req.json();
    await fs.writeFile(RESUME_PATH, JSON.stringify(resume, null, 2));
    return NextResponse.json({ success: true, resume });
  } catch (error) {
    console.error("Resume-data PUT error:", error);
    return NextResponse.json({ error: "Failed to update resume" }, { status: 500 });
  }
}
