import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "career_sessions");
const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");
const TRACKER_PATH = path.join(DATA_DIR, "tracker.json");
const HISTORY_PATH = path.join(DATA_DIR, "resume_history.json");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJSON(filePath: string, fallback: unknown) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJSON(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Save the .tex file to a category folder and return the path
async function saveResumeFile(category: string, filename: string, latex: string): Promise<string> {
  const categoryDir = path.join(RESUMES_DIR, category);
  await ensureDir(categoryDir);
  const filePath = path.join(categoryDir, filename);
  await fs.writeFile(filePath, latex);
  return filePath;
}

// GET — fetch all applications or resume history, or list category folders
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type") || "applications";

    if (type === "history") {
      const history = await readJSON(HISTORY_PATH, []);
      return NextResponse.json({ history });
    }

    if (type === "categories") {
      // List all categories with their resume counts
      await ensureDir(RESUMES_DIR);
      const entries = await fs.readdir(RESUMES_DIR, { withFileTypes: true });
      const categories: { name: string; count: number; files: string[] }[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const categoryPath = path.join(RESUMES_DIR, entry.name);
          const files = await fs.readdir(categoryPath);
          const texFiles = files.filter((f) => f.endsWith(".tex"));
          categories.push({ name: entry.name, count: texFiles.length, files: texFiles });
        }
      }
      return NextResponse.json({ categories });
    }

    if (type === "resume-file") {
      // Read a specific resume file
      const category = req.nextUrl.searchParams.get("category") || "";
      const filename = req.nextUrl.searchParams.get("filename") || "";
      if (!category || !filename) {
        return NextResponse.json({ error: "category and filename required" }, { status: 400 });
      }
      const filePath = path.join(RESUMES_DIR, category, filename);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        return NextResponse.json({ content, filePath });
      } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    const applications = await readJSON(TRACKER_PATH, []);
    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Tracker GET error:", error);
    return NextResponse.json({ applications: [] });
  }
}

// POST — add new application or resume history entry
export async function POST(req: NextRequest) {
  try {
    const { type, entry } = await req.json();

    if (type === "history") {
      // Save the .tex file to the category folder
      const category = entry.category || "other";
      const filename = entry.filename || `resume_${Date.now()}.tex`;
      let filePath = "";

      if (entry.latex) {
        filePath = await saveResumeFile(category, filename, entry.latex);
      }

      // Save to history index (without the full latex to keep the JSON small)
      const historyEntry = {
        ...entry,
        filePath,
        // Keep latex in history for quick preview, but cap at 20KB
        latex: (entry.latex || "").slice(0, 20000),
      };

      const history = await readJSON(HISTORY_PATH, []);
      history.unshift(historyEntry);
      if (history.length > 100) history.length = 100;
      await writeJSON(HISTORY_PATH, history);
      return NextResponse.json({ success: true, filePath, history });
    }

    const applications = await readJSON(TRACKER_PATH, []);
    applications.unshift(entry);
    await writeJSON(TRACKER_PATH, applications);
    return NextResponse.json({ success: true, applications });
  } catch (error) {
    console.error("Tracker POST error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

// PUT — update an application or history entry
export async function PUT(req: NextRequest) {
  try {
    const { type, entry } = await req.json();

    if (type === "history") {
      const history = await readJSON(HISTORY_PATH, []);
      const idx = history.findIndex((h: { id: string }) => h.id === entry.id);
      if (idx >= 0) history[idx] = { ...history[idx], ...entry };
      await writeJSON(HISTORY_PATH, history);
      return NextResponse.json({ success: true });
    }

    const applications = await readJSON(TRACKER_PATH, []);
    const idx = applications.findIndex((a: { id: string }) => a.id === entry.id);
    if (idx >= 0) {
      applications[idx] = { ...applications[idx], ...entry, lastUpdated: new Date().toISOString() };
    }
    await writeJSON(TRACKER_PATH, applications);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tracker PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE — remove an application or history entry (also deletes the .tex file)
export async function DELETE(req: NextRequest) {
  try {
    const { id, type } = await req.json();

    if (type === "history") {
      const history = await readJSON(HISTORY_PATH, []);
      const entry = history.find((h: { id: string }) => h.id === id);
      // Delete the actual .tex file if it exists
      if (entry?.filePath) {
        try { await fs.unlink(entry.filePath); } catch { /* ok if already gone */ }
      }
      const filtered = history.filter((h: { id: string }) => h.id !== id);
      await writeJSON(HISTORY_PATH, filtered);
      return NextResponse.json({ success: true });
    }

    const applications = await readJSON(TRACKER_PATH, []);
    const filtered = applications.filter((a: { id: string }) => a.id !== id);
    await writeJSON(TRACKER_PATH, filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tracker DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
