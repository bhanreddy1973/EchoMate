import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

/**
 * Import a .tex or .md resume file and parse it into structured JSON
 * Uses regex-based parsing for speed and reliability (no AI API needed)
 */

function parseLatexResume(content: string) {
  const resume = {
    contact: { name: "", email: "", phone: "", linkedin: "", github: "", website: "", location: "" },
    summary: "",
    experiences: [] as { id: string; company: string; title: string; location: string; startDate: string; endDate: string; current: boolean; bullets: string[]; technologies: string[]; impact?: string }[],
    education: [] as { id: string; institution: string; degree: string; field: string; startDate: string; endDate: string; gpa?: string; highlights: string[] }[],
    skills: [] as string[],
    projects: [] as { id: string; name: string; description: string; technologies: string[]; url?: string; highlights: string[] }[],
    certifications: [] as { id: string; name: string; issuer: string; date: string; url?: string }[],
  };

  // Extract name from heading
  const nameMatch = content.match(/\\(?:Huge|LARGE|huge|Large)\s*(?:\\scshape\s*)?([A-Z][A-Z\s]+)/);
  if (nameMatch) resume.contact.name = nameMatch[1].trim();

  // Extract email
  const emailMatch = content.match(/(?:mailto:|\\faEnvelope[*]?\s*\\?\s*(?:underline\{)?)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) resume.contact.email = emailMatch[1];

  // Extract phone
  const phoneMatch = content.match(/(?:\\faPhone[*]?\s*)?(\+?\d[\d\s\-()]{7,})/);
  if (phoneMatch) resume.contact.phone = phoneMatch[1].trim();

  // Extract LinkedIn
  const linkedinMatch = content.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  if (linkedinMatch) resume.contact.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;

  // Extract GitHub
  const githubMatch = content.match(/github\.com\/([a-zA-Z0-9_-]+)/);
  if (githubMatch) resume.contact.github = `github.com/${githubMatch[1]}`;

  // Extract location
  const locationMatch = content.match(/\\faMapMarker[*]?\s*~?\s*([^~\\]+)/);
  if (locationMatch) resume.contact.location = locationMatch[1].trim();

  // Extract summary
  const summaryMatch = content.match(/\\section\{(?:Summary|Professional Summary|About)\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
  if (summaryMatch) {
    resume.summary = cleanLatex(summaryMatch[1]).trim().slice(0, 500);
  }

  // Extract experiences using resumeSubheading pattern
  const expSection = content.match(/\\section\{(?:Experience|Work Experience|Professional Experience)\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
  if (expSection) {
    const subheadings = expSection[1].split(/\\resumeSubheading/);
    for (let i = 1; i < subheadings.length; i++) {
      const block = subheadings[i];
      // Extract 4 params: {company}{date}{title}{location} or {title}{date}{company}{location}
      const params = extractBracketParams(block);
      const bullets = extractBullets(block);
      const techs = extractTechnologies(block);

      if (params.length >= 2) {
        resume.experiences.push({
          id: `exp-${uuidv4().slice(0, 8)}`,
          company: cleanLatex(params[0] || ""),
          title: cleanLatex(params[2] || params[0] || ""),
          location: cleanLatex(params[3] || ""),
          startDate: extractStartDate(params[1] || ""),
          endDate: extractEndDate(params[1] || ""),
          current: (params[1] || "").toLowerCase().includes("present"),
          bullets,
          technologies: techs,
        });
      }
    }
  }

  // Extract education
  const eduSection = content.match(/\\section\{Education\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
  if (eduSection) {
    const subheadings = eduSection[1].split(/\\resumeSubheading/);
    for (let i = 1; i < subheadings.length; i++) {
      const block = subheadings[i];
      const params = extractBracketParams(block);
      if (params.length >= 2) {
        resume.education.push({
          id: `edu-${uuidv4().slice(0, 8)}`,
          institution: cleanLatex(params[0] || ""),
          degree: cleanLatex(params[2] || ""),
          field: cleanLatex(params[2] || ""),
          startDate: extractStartDate(params[1] || ""),
          endDate: extractEndDate(params[1] || ""),
          highlights: extractBullets(block),
        });
      }
    }
  }

  // Extract skills
  const skillSection = content.match(/\\section\{(?:Technical Skills|Skills|Core Competencies)\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
  if (skillSection) {
    const skillText = skillSection[1];
    // Extract from \textbf{Category:} items pattern
    const categoryPattern = /\\textbf\{[^}]*\}[:\s]*([^\n\\]*(?:\\\\)?)/g;
    let catMatch;
    const allSkills: string[] = [];
    while ((catMatch = categoryPattern.exec(skillText)) !== null) {
      const items = catMatch[1].replace(/\\\\/g, "").split(/[,|·]/).map(s => cleanLatex(s).trim()).filter(s => s.length > 1 && s.length < 50);
      allSkills.push(...items);
    }
    // Fallback: try general extraction
    if (allSkills.length === 0) {
      const cleaned = cleanLatex(skillText);
      const skills = cleaned.split(/[,|·•\n]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 50 && !s.includes("itemize") && !s.includes("label"));
      allSkills.push(...skills);
    }
    resume.skills = [...new Set(allSkills)];
  }

  // Extract projects
  const projSection = content.match(/\\section\{(?:Projects|Personal Projects|Key Projects)\}([\s\S]*?)(?=\\section|\\end\{document\})/i);
  if (projSection) {
    const projBlocks = projSection[1].split(/\\resumeProjectHeading|\\resumeSubheading/);
    for (let i = 1; i < projBlocks.length; i++) {
      const block = projBlocks[i];
      const params = extractBracketParams(block);
      const bullets = extractBullets(block);
      const techs = extractTechnologies(block);

      if (params.length >= 1) {
        resume.projects.push({
          id: `proj-${uuidv4().slice(0, 8)}`,
          name: cleanLatex(params[0] || "").replace(/\\textbf\{([^}]*)\}/, "$1"),
          description: bullets[0] || "",
          technologies: techs,
          highlights: bullets,
        });
      }
    }
  }

  return resume;
}

function parseMarkdownResume(content: string) {
  const resume = {
    contact: { name: "", email: "", phone: "", linkedin: "", github: "", website: "", location: "" },
    summary: "",
    experiences: [] as { id: string; company: string; title: string; location: string; startDate: string; endDate: string; current: boolean; bullets: string[]; technologies: string[] }[],
    education: [] as { id: string; institution: string; degree: string; field: string; startDate: string; endDate: string; highlights: string[] }[],
    skills: [] as string[],
    projects: [] as { id: string; name: string; description: string; technologies: string[]; highlights: string[] }[],
    certifications: [] as { id: string; name: string; issuer: string; date: string }[],
  };

  // Extract name from first H1
  const nameMatch = content.match(/^#\s+(.+)/m);
  if (nameMatch) resume.contact.name = nameMatch[1].trim();

  // Extract email
  const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) resume.contact.email = emailMatch[1];

  // Extract skills from bullet lists under Skills heading
  const skillMatch = content.match(/##?\s*(?:Skills|Technical Skills)([\s\S]*?)(?=##|$)/i);
  if (skillMatch) {
    const skills = skillMatch[1].split(/[,\n•\-*]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 50);
    resume.skills = [...new Set(skills)];
  }

  return resume;
}

// Helper functions
function extractBracketParams(text: string): string[] {
  const params: string[] = [];
  const regex = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;
  let count = 0;
  while ((match = regex.exec(text)) !== null && count < 6) {
    params.push(match[1]);
    count++;
  }
  return params;
}

function extractBullets(block: string): string[] {
  const bullets: string[] = [];
  const regex = /\\resumeItem\{([\s\S]*?)\}(?=\s*\\resumeItem|\s*\\resumeItemListEnd|\s*$)/g;
  let match;
  while ((match = regex.exec(block)) !== null) {
    const clean = cleanLatex(match[1]).trim();
    if (clean.length > 5) bullets.push(clean);
  }
  // Also try \item pattern
  if (bullets.length === 0) {
    const itemRegex = /\\item\s*([\s\S]*?)(?=\\item|\\end\{|$)/g;
    while ((match = itemRegex.exec(block)) !== null) {
      const clean = cleanLatex(match[1]).trim();
      if (clean.length > 5) bullets.push(clean);
    }
  }
  return bullets;
}

function extractTechnologies(block: string): string[] {
  // Look for tech keywords in textbf, emph, or explicit tech line
  const techMatch = block.match(/(?:Technologies?|Tech Stack|Tools)[:\s]*([^\n\\]+)/i);
  if (techMatch) {
    return techMatch[1].split(/[,|·]/).map(s => cleanLatex(s).trim()).filter(Boolean);
  }
  return [];
}

function cleanLatex(text: string): string {
  return text
    .replace(/\\textbf\{([^}]*)\}/g, "$1")
    .replace(/\\textit\{([^}]*)\}/g, "$1")
    .replace(/\\emph\{([^}]*)\}/g, "$1")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\small\b/g, "")
    .replace(/\\normalsize\b/g, "")
    .replace(/\\vspace\{[^}]*\}/g, "")
    .replace(/\\hspace\{[^}]*\}/g, "")
    .replace(/\\[a-zA-Z]+\*?\s*/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStartDate(dateStr: string): string {
  const match = dateStr.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4})/i);
  return match ? match[1].trim() : "";
}

function extractEndDate(dateStr: string): string {
  if (dateStr.toLowerCase().includes("present")) return "Present";
  const parts = dateStr.split(/[-–—]/);
  if (parts.length >= 2) {
    const match = parts[1].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4}|Present)/i);
    return match ? match[1].trim() : "";
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const isLatex = file.name.endsWith(".tex");

    let masterResume;
    if (isLatex) {
      masterResume = parseLatexResume(content);
    } else {
      masterResume = parseMarkdownResume(content);
    }

    // Also save it as the master resume
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const resumePath = path.join(process.cwd(), "data", "resume", "master_resume.json");
    await fs.mkdir(path.dirname(resumePath), { recursive: true });
    await fs.writeFile(resumePath, JSON.stringify(masterResume, null, 2));

    return NextResponse.json({ masterResume });
  } catch (error) {
    console.error("Career import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
