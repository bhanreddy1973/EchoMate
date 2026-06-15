import type { AppCategory } from "@/types/career";

// Loaded at module init — no fetch, bundled via Next.js static import
// Source: devicons/devicon@master (578 skills) + manual extensions
import TAXONOMY from "@/data/skills_taxonomy.json";

type TaxonomyData = {
  version: string;
  total: number;
  all: string[];
  aliases: Record<string, string>;
  categories: Record<string, { label: string; skills: string[] }>;
  displayNames: Record<string, string>;
};

const tx = TAXONOMY as TaxonomyData;

// ─── Normalise ─────────────────────────────────────────────────────────────
// Converts any skill string ("React.js", "c++", "node") → canonical id ("react", "cplusplus", "nodejs")
export function normalizeSkill(raw: string): string {
  const key = raw.toLowerCase().trim().replace(/[.\s]+/g, "");
  return tx.aliases[key] ?? tx.aliases[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

// Human-readable display name for a canonical id
export function displayName(canonical: string): string {
  return tx.displayNames[canonical] ?? canonical;
}

// ─── Category detection ────────────────────────────────────────────────────
// Scores each category by how many skills from keywords/role match its skill list
export function detectCategory(keywords: string[], role: string): AppCategory {
  const tokens = [...keywords, role].map((k) => normalizeSkill(k));
  const tokenSet = new Set(tokens);

  let best: AppCategory = "other";
  let bestScore = 0;

  const categoryMap: Record<string, AppCategory> = {
    frontend: "frontend",
    backend: "backend",
    fullstack: "fullstack",
    "ml-ai": "ml-ai",
    data: "data",
    devops: "devops",
    mobile: "mobile",
    security: "security",
  };

  for (const [catId, catData] of Object.entries(tx.categories)) {
    const score = catData.skills.filter((s) => tokenSet.has(s)).length;
    if (score > bestScore) {
      bestScore = score;
      best = categoryMap[catId] ?? "other";
    }
  }

  // Fallback: simple keyword scan on raw text for categories not well-represented
  if (bestScore === 0) {
    const text = [...keywords, role].join(" ").toLowerCase();
    if (/product.?manager|pm\b|roadmap|user.?research/.test(text)) return "product";
    if (/design|figma|ux|ui.?ux|illustrator/.test(text)) return "design";
    if (/fullstack|full.?stack/.test(text)) return "fullstack";
  }

  return best;
}

// ─── Skill matching ────────────────────────────────────────────────────────
// Given two sets of raw skill strings, returns { matched, missing, extra }
export function matchSkills(
  resumeSkills: string[],
  jdSkills: string[]
): { matched: string[]; missing: string[]; extra: string[] } {
  const resumeNorm = new Map(resumeSkills.map((s) => [normalizeSkill(s), s]));
  const jdNorm = new Map(jdSkills.map((s) => [normalizeSkill(s), s]));

  const matched: string[] = [];
  const missing: string[] = [];

  for (const [norm, original] of jdNorm) {
    if (resumeNorm.has(norm)) {
      matched.push(original);
    } else {
      missing.push(original);
    }
  }

  const extra = [...resumeNorm.keys()]
    .filter((n) => !jdNorm.has(n))
    .map((n) => resumeNorm.get(n)!);

  return { matched, missing, extra };
}

// ─── Extract skills from free text ────────────────────────────────────────
// Scans arbitrary text and returns canonical skill ids that appear in it
export function extractSkillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const skill of tx.all) {
    // Match the canonical name and any display name variant
    const disp = (tx.displayNames[skill] ?? skill).toLowerCase();
    if (lower.includes(skill.toLowerCase()) || lower.includes(disp)) {
      found.add(skill);
    }
  }

  // Also check aliases
  for (const [alias, canonical] of Object.entries(tx.aliases)) {
    if (alias.length > 2 && lower.includes(alias)) {
      found.add(canonical);
    }
  }

  return [...found];
}

// ─── Category metadata ─────────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(tx.categories).map(([id, cat]) => [id, cat.label])
);

export const SKILL_COUNT = tx.total;

// Skills by category (canonical ids)
export function getSkillsForCategory(category: AppCategory): string[] {
  return tx.categories[category]?.skills ?? [];
}
