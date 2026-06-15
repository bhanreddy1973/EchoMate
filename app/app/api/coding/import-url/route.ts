import { NextRequest, NextResponse } from "next/server";
import TurndownService from "turndown";

type LeetCodeSnippet = {
  langSlug: string;
  code: string;
};

type LeetCodeTopicTag = {
  name: string;
};

type LeetCodeQuestion = {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  content?: string;
  codeSnippets?: LeetCodeSnippet[];
  topicTags?: LeetCodeTopicTag[];
  hints?: string[];
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

// LeetCode problem slug parser
function parseLeetCodeUrl(url: string): string | null {
  const match = url.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

// NeetCode slug to LeetCode slug mapping for common differences
// NeetCode often shortens problem names
const NEETCODE_TO_LEETCODE: Record<string, string> = {
  "depth-of-binary-tree": "maximum-depth-of-binary-tree",
  "diameter-of-binary-tree": "diameter-of-binary-tree",
  "invert-a-binary-tree": "invert-binary-tree",
  "subtree-of-a-binary-tree": "subtree-of-another-tree",
  "count-good-nodes-in-binary-tree": "count-good-nodes-in-binary-tree",
  "binary-tree-from-preorder-and-inorder-traversal": "construct-binary-tree-from-preorder-and-inorder-traversal",
  "binary-tree-maximum-path-sum": "binary-tree-maximum-path-sum",
  "serialize-and-deserialize-binary-tree": "serialize-and-deserialize-binary-tree",
  "kth-smallest-integer-in-bst": "kth-smallest-element-in-a-bst",
  "minimum-window-substring": "minimum-window-substring",
  "longest-substring-without-duplicates": "longest-substring-without-repeating-characters",
  "anagram-groups": "group-anagrams",
  "string-encode-and-decode": "encode-and-decode-strings",
  "duplicate-integer": "contains-duplicate",
  "is-anagram": "valid-anagram",
  "top-k-frequent-elements": "top-k-frequent-elements",
  "products-of-array-discluding-self": "product-of-array-except-self",
  "longest-consecutive-sequence": "longest-consecutive-sequence",
  "three-integer-sum": "3sum",
  "max-water-container": "container-with-most-water",
  "trapping-rain-water": "trapping-rain-water",
  "buy-and-sell-crypto": "best-time-to-buy-and-sell-stock",
  "longest-repeating-substring-with-replacement": "longest-repeating-character-replacement",
  "minimum-stack": "min-stack",
  "eating-bananas": "koko-eating-bananas",
  "find-minimum-in-rotated-sorted-array": "find-minimum-in-rotated-sorted-array",
  "linked-list-cycle-detection": "linked-list-cycle",
  "find-the-duplicate-number": "find-the-duplicate-number",
  "lru-cache": "lru-cache",
  "reverse-nodes-in-k-group": "reverse-nodes-in-k-group",
  "merge-k-sorted-linked-lists": "merge-k-sorted-lists",
  "car-fleet": "car-fleet",
  "daily-temperatures": "daily-temperatures",
  "evaluate-reverse-polish-notation": "evaluate-reverse-polish-notation",
  "generate-parentheses": "generate-parentheses",
  "largest-rectangle-in-histogram": "largest-rectangle-in-histogram",
  "sliding-window-maximum": "sliding-window-maximum",
  "permutation-in-string": "permutation-in-string",
};

// Try to resolve a NeetCode slug to a LeetCode slug
async function resolveNeetCodeSlug(neetcodeSlug: string): Promise<string> {
  // 1. Check our mapping table
  if (NEETCODE_TO_LEETCODE[neetcodeSlug]) {
    return NEETCODE_TO_LEETCODE[neetcodeSlug];
  }

  // 2. Try the slug directly (many are the same)
  try {
    await fetchLeetCodeProblem(neetcodeSlug);
    return neetcodeSlug;
  } catch {
    // Not found directly, try variations
  }

  // 3. Try common prefix variations
  const prefixes = ["maximum-", "minimum-", ""];
  const suffixes = ["", "-ii", "-iii"];
  
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const variant = prefix + neetcodeSlug + suffix;
      if (variant === neetcodeSlug) continue;
      try {
        await fetchLeetCodeProblem(variant);
        return variant;
      } catch {
        continue;
      }
    }
  }

  // 4. Return original slug as last resort
  return neetcodeSlug;
}

// Fetch problem data from LeetCode GraphQL API
async function fetchLeetCodeProblem(slug: string) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        titleSlug
        difficulty
        content
        exampleTestcases
        topicTags { name slug }
        hints
        codeSnippets { lang langSlug code }
        sampleTestCase
      }
    }
  `;

  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": "https://leetcode.com",
    },
    body: JSON.stringify({
      query,
      variables: { titleSlug: slug },
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode API returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.data?.question) {
    throw new Error("Problem not found on LeetCode");
  }

  return data.data.question;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&times;/g, "×")
    .replace(/&le;/g, "≤")
    .replace(/&ge;/g, "≥")
    .replace(/&ne;/g, "≠");
}

// Convert LeetCode HTML to high-quality markdown instead of lossy regex text.
function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  turndown.addRule("leetcodeSup", {
    filter: ["sup"],
    replacement: (content) => `^${content}`,
  });

  turndown.addRule("leetcodeSub", {
    filter: ["sub"],
    replacement: (content) => `_${content}`,
  });

  turndown.addRule("leetcodePre", {
    filter: ["pre"],
    replacement: (_content, node) => {
      const text = decodeEntities(node.textContent || "").trim();
      return text ? `\n\n\`\`\`text\n${text}\n\`\`\`\n\n` : "";
    },
  });

  return decodeEntities(turndown.turndown(html || ""))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// Parse examples from LeetCode content HTML
function parseExamples(html: string): { input: string; output: string; explanation?: string }[] {
  const examples: { input: string; output: string; explanation?: string }[] = [];

  // Decode HTML entities first
  const decoded = decodeEntities(html);
  // Strip tags but preserve structure
  const cleanHtml = decoded
    .replace(/<strong>/g, "")
    .replace(/<\/strong>/g, "")
    .replace(/<pre>/g, "\n```\n")
    .replace(/<\/pre>/g, "\n```\n")
    .replace(/<p>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  // Split by "Example N:" markers
  const exampleBlocks = cleanHtml.split(/Example\s*\d+\s*:/i).slice(1); // skip text before first example

  for (const block of exampleBlocks) {
    // Find Input and Output within this example block
    const inputMatch = block.match(/Input[:\s]*\n?([\s\S]*?)(?=Output)/i);
    const outputMatch = block.match(/Output[:\s]*\n?([\s\S]*?)(?=Explanation|Example|\n\n\n|Constraints|$)/i);

    if (inputMatch && outputMatch) {
      const input = inputMatch[1].trim().replace(/```/g, "").split("\n").map(l => l.trim()).filter(Boolean).join("\n");
      const output = outputMatch[1].trim().replace(/```/g, "").split("\n").map(l => l.trim()).filter(Boolean).join("\n");
      
      let explanation: string | undefined;
      const explMatch = block.match(/Explanation[:\s]*\n?([\s\S]*?)(?=Example|\n\n\n|$)/i);
      if (explMatch) {
        explanation = explMatch[1].trim().split("\n").map(l => l.trim()).filter(Boolean).join("\n") || undefined;
      }

      if (input && output) {
        examples.push({ input, output, explanation });
      }
    }
  }

  // Fallback: try without "Example N:" markers (some problems don't have them)
  if (examples.length === 0) {
    const pattern = /Input[:\s]+([^\n]+(?:\n[^\nO][^\n]*)*)\s*Output[:\s]+([^\n]+)/gi;
    let match;
    while ((match = pattern.exec(cleanHtml)) !== null) {
      examples.push({
        input: match[1].trim(),
        output: match[2].trim(),
      });
    }
  }

  return examples.length > 0 ? examples : [{ input: "See problem description", output: "See problem description" }];
}

// Parse constraints from content
function parseConstraints(html: string): string[] {
  const constraints: string[] = [];
  const cleanHtml = html.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ");

  const constraintSection = cleanHtml.match(/Constraints?:([\s\S]*?)(?=Follow|$)/i);
  if (constraintSection) {
    const lines = constraintSection[1].split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.length > 2 && !line.startsWith("Example")) {
        constraints.push(line.replace(/^[-•]\s*/, ""));
      }
    }
  }

  return constraints;
}

// Map LeetCode lang slugs to our language IDs
const LANG_MAP: Record<string, string> = {
  python3: "python",
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  "c++": "cpp",
  cpp: "cpp",
  golang: "go",
  go: "go",
  rust: "rust",
  csharp: "csharp",
  "c#": "csharp",
};

// Convert LeetCode starter code to fully compilable code
// LeetCode provides struct/class definitions as comments — we extract and make them real code
function makeCompilable(code: string, language: string): string {
  if (language === "cpp") {
    // Extract struct/class definitions from block comments like:
    // /**
    //  * Definition for singly-linked list.
    //  * struct ListNode {
    //  *     int val;
    //  *     ListNode *next;
    //  *     ListNode() : val(0), next(nullptr) {}
    //  * };
    //  */
    const commentBlockRegex = /\/\*\*[\s\S]*?\*\//g;
    const commentBlocks = code.match(commentBlockRegex) || [];
    
    let preamble = "#include <bits/stdc++.h>\nusing namespace std;\n\n";
    let codeWithoutComments = code;

    for (const block of commentBlocks) {
      // Extract the struct/class code from comment lines
      const lines = block.split("\n");
      const codeLines: string[] = [];
      let foundStruct = false;

      for (const line of lines) {
        // Remove comment markers: " * ", " *", "/**", "*/"
        const cleaned = line.replace(/^\s*\/?\*+\/?/, "").trim();
        if (!cleaned) continue;
        
        // Skip "Definition for..." description lines
        if (cleaned.toLowerCase().startsWith("definition for")) continue;
        
        // If we find struct/class/TreeNode/ListNode definitions, include them
        if (cleaned.match(/^(struct|class)\s+\w+/) || foundStruct) {
          foundStruct = true;
          codeLines.push(cleaned);
          if (cleaned.includes("};")) foundStruct = false;
        }
      }

      if (codeLines.length > 0) {
        preamble += codeLines.join("\n") + "\n\n";
      }
      
      // Remove the comment block from the original code
      codeWithoutComments = codeWithoutComments.replace(block, "");
    }

    return preamble + codeWithoutComments.trim() + "\n";
  }

  if (language === "java") {
    // Java: comment definitions usually define ListNode/TreeNode as inner class
    const commentBlockRegex = /\/\*\*[\s\S]*?\*\//g;
    const commentBlocks = code.match(commentBlockRegex) || [];
    
    let preamble = "";

    for (const block of commentBlocks) {
      const lines = block.split("\n");
      const codeLines: string[] = [];
      let foundClass = false;

      for (const line of lines) {
        const cleaned = line.replace(/^\s*\/?\*+\/?/, "").trim();
        if (!cleaned) continue;
        if (cleaned.toLowerCase().startsWith("definition for")) continue;
        
        if (cleaned.match(/^(public\s+)?class\s+\w+/) || foundClass) {
          foundClass = true;
          codeLines.push(cleaned);
          if (cleaned === "}" || cleaned === "};") foundClass = false;
        }
      }

      if (codeLines.length > 0) {
        preamble += codeLines.join("\n") + "\n\n";
      }
    }

    // Remove comment blocks and prepend definitions
    let result = code.replace(commentBlockRegex, "").trim();
    if (preamble) {
      result = preamble + result;
    }
    return result + "\n";
  }

  // Python, JS, TS — comments don't affect compilation, return as-is
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Determine source and parse slug
    let slug: string | null = null;
    let source: "leetcode" | "neetcode" | "manual" = "manual";

    if (url.includes("leetcode.com")) {
      slug = parseLeetCodeUrl(url);
      source = "leetcode";
    } else if (url.includes("neetcode.io")) {
      const neetcodeMatch = url.match(/neetcode\.io\/problems\/([a-z0-9-]+)/i);
      if (neetcodeMatch) {
        slug = await resolveNeetCodeSlug(neetcodeMatch[1]);
        source = "neetcode";
      }
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Could not parse problem URL. Supported: LeetCode, NeetCode" },
        { status: 400 }
      );
    }

    // Fetch from LeetCode API
    const lcData = await fetchLeetCodeProblem(slug) as LeetCodeQuestion;

    // Build starter code map
    const starterCode: Record<string, string> = {};
    if (lcData.codeSnippets) {
      for (const snippet of lcData.codeSnippets) {
        const langId = LANG_MAP[snippet.langSlug];
        if (langId) {
          starterCode[langId] = makeCompilable(snippet.code, langId);
        }
      }
    }

    // Parse problem data
    const problem = {
      id: `${source}-${slug}`,
      source,
      sourceUrl: url,
      slug,
      title: lcData.title,
      difficulty: lcData.difficulty as "Easy" | "Medium" | "Hard",
      statementMarkdown: htmlToMarkdown(lcData.content || ""),
      examples: parseExamples(lcData.content || ""),
      constraints: parseConstraints(lcData.content || ""),
      tags: (lcData.topicTags || []).map((t) => t.name),
      starterCode,
      hints: lcData.hints || [],
      similarProblems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ problem });
  } catch (error: unknown) {
    console.error("Import URL error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to import problem") },
      { status: 500 }
    );
  }
}
