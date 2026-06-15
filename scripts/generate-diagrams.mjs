#!/usr/bin/env node
/**
 * Extracts all ```mermaid code blocks from markdown files,
 * renders each to SVG using mmdc (@mermaid-js/mermaid-cli),
 * saves SVGs to docs/diagrams/, and rewrites the markdown
 * to use ![](docs/diagrams/name.svg) image tags.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIAGRAMS_DIR = join(ROOT, "docs", "diagrams");
const MMDC = join(ROOT, "app", "node_modules", ".bin", "mmdc");

// Mermaid config for dark theme with good contrast
const MERMAID_CONFIG = {
  theme: "dark",
  themeVariables: {
    background: "#0d1117",
    primaryColor: "#1f2937",
    primaryTextColor: "#e5e7eb",
    primaryBorderColor: "#6366f1",
    lineColor: "#818cf8",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "14px",
    nodeBorder: "#6366f1",
    clusterBkg: "#1e293b",
    clusterBorder: "#4f46e5",
    edgeLabelBackground: "#1e293b",
    noteTextColor: "#e5e7eb",
    noteBkgColor: "#1e293b",
    noteBorderColor: "#6366f1",
    actorTextColor: "#e5e7eb",
    actorBkg: "#1f2937",
    actorBorder: "#6366f1",
    signalColor: "#e5e7eb",
    signalTextColor: "#e5e7eb",
    labelBoxBkgColor: "#1f2937",
    labelBoxBorderColor: "#6366f1",
    labelTextColor: "#e5e7eb",
    loopTextColor: "#e5e7eb",
    activationBorderColor: "#818cf8",
    activationBkgColor: "#312e81",
    sequenceNumberColor: "#e5e7eb",
  },
};

const CONFIG_PATH = join(DIAGRAMS_DIR, "mermaid-config.json");

if (!existsSync(DIAGRAMS_DIR)) {
  mkdirSync(DIAGRAMS_DIR, { recursive: true });
}

writeFileSync(CONFIG_PATH, JSON.stringify(MERMAID_CONFIG, null, 2));

const FILES = ["README.md", "WORKFLOW.md", "SETUP.md"];

let totalGenerated = 0;

for (const file of FILES) {
  const filePath = join(ROOT, file);
  if (!existsSync(filePath)) {
    console.log(`⚠ ${file} not found, skipping`);
    continue;
  }

  let content = readFileSync(filePath, "utf-8");
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  let diagramIndex = 0;
  const replacements = [];

  while ((match = mermaidRegex.exec(content)) !== null) {
    diagramIndex++;
    const chart = match[1].trim();
    const prefix = file.replace(".md", "").toLowerCase();
    const name = `${prefix}-${String(diagramIndex).padStart(2, "0")}`;
    const mmdPath = join(DIAGRAMS_DIR, `${name}.mmd`);
    const svgPath = join(DIAGRAMS_DIR, `${name}.svg`);

    writeFileSync(mmdPath, chart);

    try {
      execSync(
        `"${MMDC}" -i "${mmdPath}" -o "${svgPath}" -c "${CONFIG_PATH}" -b transparent --width 1200`,
        { stdio: "pipe", timeout: 30000 }
      );
      console.log(`✓ ${name}.svg generated`);
      totalGenerated++;

      // Replace the mermaid block with an image reference
      replacements.push({
        original: match[0],
        replacement: `![${name}](docs/diagrams/${name}.svg)`,
      });
    } catch (err) {
      console.error(`✗ ${name} failed: ${err.message}`);
      // Leave the mermaid block as-is if generation fails
    }
  }

  // Apply replacements in reverse order to preserve offsets
  for (const r of replacements.reverse()) {
    content = content.replace(r.original, r.replacement);
  }

  writeFileSync(filePath, content);
  console.log(`→ ${file} updated (${replacements.length} diagrams replaced)`);
}

console.log(`\nDone! ${totalGenerated} SVG diagrams generated in docs/diagrams/`);
