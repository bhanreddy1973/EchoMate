import { NextRequest, NextResponse } from "next/server";

// Judge0 language ID mapping
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  cpp: 54,
  go: 60,
  rust: 73,
  csharp: 51,
};

// Judge0 status ID mapping
const JUDGE0_STATUS_MAP: Record<number, string> = {
  1: "processing",
  2: "processing",
  3: "accepted",
  4: "wrong_answer",
  5: "time_limit",
  6: "compile_error",
  7: "runtime_error",
  8: "runtime_error",
  9: "runtime_error",
  10: "runtime_error",
  11: "runtime_error",
  12: "runtime_error",
  13: "runtime_error",
  14: "runtime_error",
};

// ─── Prepare code for execution ─────────────────────────────────────────────
// Handles: comment-to-code extraction, duplicate prevention, main() injection
function prepareCode(code: string, language: string): string {
  if (language === "cpp") {
    // If user already has main(), don't touch anything
    if (code.match(/\bint\s+main\s*\(/)) return code;

    // Check if actual data structure definitions exist as real code (not Solution class)
    const realStructExists = code.match(/^\s*(struct|class)\s+(ListNode|TreeNode|Node)\s*[:{]/m);

    let preamble = "";
    let body = code;

    // Only extract from comments if no real definition exists
    if (!realStructExists) {
      const commentBlockRegex = /\/\*\*[\s\S]*?\*\//g;
      const commentBlocks = code.match(commentBlockRegex) || [];

      for (const block of commentBlocks) {
        const lines = block.split("\n");
        const structLines: string[] = [];
        let inStruct = false;
        let braces = 0;

        for (const line of lines) {
          const cleaned = line.replace(/^\s*\/?\*+\s?/, "").replace(/\*\/\s*$/, "").trim();
          if (!cleaned) continue;
          if (cleaned.toLowerCase().startsWith("definition for")) continue;

          if (cleaned.match(/^(struct|class)\s+\w+/) || inStruct) {
            inStruct = true;
            structLines.push(cleaned);
            braces += (cleaned.match(/{/g) || []).length;
            braces -= (cleaned.match(/}/g) || []).length;
            if (braces <= 0 && structLines.length > 1) inStruct = false;
          }
        }

        if (structLines.length > 0) {
          preamble += structLines.join("\n") + "\n\n";
          body = body.replace(block, "");
        }
      }
    }

    // Add includes if missing
    let result = "";
    if (!code.includes("#include")) {
      result += "#include <bits/stdc++.h>\nusing namespace std;\n\n";
    }
    result += preamble + body.trim();

    // Add a simple main() so it compiles
    result += `\n\nint main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout << "Compiled and ran successfully." << endl;
    return 0;
}
`;
    return result;
  }

  if (language === "java") {
    if (code.match(/public\s+static\s+void\s+main/)) return code;

    let preamble = "";
    let body = code;

    if (!code.match(/^\s*(public\s+)?class\s+(ListNode|TreeNode)\b/m)) {
      const commentBlockRegex = /\/\*\*[\s\S]*?\*\//g;
      const commentBlocks = code.match(commentBlockRegex) || [];

      for (const block of commentBlocks) {
        const lines = block.split("\n");
        const classLines: string[] = [];
        let inClass = false;
        let braces = 0;

        for (const line of lines) {
          const cleaned = line.replace(/^\s*\/?\*+\s?/, "").replace(/\*\/\s*$/, "").trim();
          if (!cleaned) continue;
          if (cleaned.toLowerCase().startsWith("definition for")) continue;

          if (cleaned.match(/^(public\s+)?class\s+\w+/) || inClass) {
            inClass = true;
            classLines.push(cleaned);
            braces += (cleaned.match(/{/g) || []).length;
            braces -= (cleaned.match(/}/g) || []).length;
            if (braces <= 0 && classLines.length > 1) inClass = false;
          }
        }

        if (classLines.length > 0) {
          preamble += classLines.join("\n") + "\n\n";
          body = body.replace(block, "");
        }
      }
    }

    return `${preamble}${body.trim()}

class Main {
    public static void main(String[] args) {
        System.out.println("Compiled and ran successfully.");
    }
}
`;
  }

  if (language === "python") {
    if (!code.match(/^[^#\n]*\b(print|input)\b/m) && !code.includes("if __name__")) {
      return code + `\n\nprint("Code loaded successfully.")\n`;
    }
  }

  if (language === "javascript" || language === "typescript") {
    if (!code.match(/\bconsole\.(log|error)\b/) && !code.includes("process.stdout")) {
      return code + `\n\nconsole.log("Code loaded successfully.");\n`;
    }
  }

  return code;
}

type TestCaseInput = {
  input?: string;
  expectedOutput?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

// ─── Execute code via Judge0 ────────────────────────────────────────────────
async function executeCode(code: string, languageId: number, stdin: string) {
  const baseUrl = process.env.JUDGE0_BASE_URL || "https://ce.judge0.com";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const rapidApiKey = process.env.JUDGE0_API_KEY;
  const rapidApiHost = process.env.JUDGE0_HOST;
  const authToken = process.env.JUDGE0_AUTH_TOKEN;

  if (rapidApiKey) {
    headers["X-RapidAPI-Key"] = rapidApiKey;
    if (rapidApiHost) headers["X-RapidAPI-Host"] = rapidApiHost;
  }

  if (authToken) {
    headers["X-Auth-Token"] = authToken;
  }

  const submitRes = await fetch(
    `${baseUrl}/submissions?base64_encoded=true&wait=true&fields=*`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_code: Buffer.from(code).toString("base64"),
        language_id: languageId,
        stdin: stdin ? Buffer.from(stdin).toString("base64") : "",
        cpu_time_limit: "5.0",
        memory_limit: 256000,
      }),
    }
  );

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`Judge0 submission failed: ${submitRes.status} - ${errText.slice(0, 200)}`);
  }

  return await submitRes.json();
}

function decodeBase64(s: string | null): string {
  if (!s) return "";
  try { return Buffer.from(s, "base64").toString("utf-8"); } catch { return s; }
}

// ─── Main handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { code, language, stdin, testCases } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (!language || !JUDGE0_LANGUAGE_MAP[language]) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }

    const preparedCode = prepareCode(code, language);
    const languageId = JUDGE0_LANGUAGE_MAP[language];

    if (Array.isArray(testCases) && testCases.length > 0) {
      const results = [];
      for (const testCase of testCases as TestCaseInput[]) {
        const result = await executeCode(preparedCode, languageId, testCase.input || "");
        const statusId = result.status?.id || 13;
        const mappedStatus = JUDGE0_STATUS_MAP[statusId] || "runtime_error";
        const actualOutput = decodeBase64(result.stdout).trim();
        const expectedOutput = (testCase.expectedOutput || "").trim();

        const passed = mappedStatus === "accepted" && actualOutput === expectedOutput;
        // If code ran successfully but output doesn't match, status should be "wrong_answer"
        const effectiveStatus = mappedStatus === "accepted" && !passed ? "wrong_answer" : mappedStatus;

        results.push({
          input: testCase.input || "",
          expectedOutput,
          actualOutput,
          passed,
          status: effectiveStatus,
          time: result.time || "0",
          memory: result.memory ? String(result.memory) : "0",
          stderr: decodeBase64(result.stderr),
          compile_output: decodeBase64(result.compile_output),
        });
      }

      const failed = results.find((r) => !r.passed);
      return NextResponse.json({
        status: failed ? failed.status : "accepted",
        stdout: results.map((r, i) => `Case ${i + 1}: ${r.actualOutput || "(no output)"}`).join("\n"),
        stderr: results.map((r) => r.stderr).filter(Boolean).join("\n"),
        compile_output: results.map((r) => r.compile_output).filter(Boolean).join("\n"),
        time: results[0]?.time || "0",
        memory: results[0]?.memory || "0",
        testResults: results,
      });
    }

    const result = await executeCode(preparedCode, languageId, stdin || "");

    const statusId = result.status?.id || 13;
    const mappedStatus = JUDGE0_STATUS_MAP[statusId] || "runtime_error";

    return NextResponse.json({
      status: mappedStatus,
      stdout: decodeBase64(result.stdout),
      stderr: decodeBase64(result.stderr),
      compile_output: decodeBase64(result.compile_output),
      time: result.time || "0",
      memory: result.memory ? String(result.memory) : "0",
    });
  } catch (error: unknown) {
    console.error("Run code error:", error);
    return NextResponse.json(
      {
        status: "runtime_error",
        stdout: "",
        stderr: getErrorMessage(error, "Failed to execute code"),
        compile_output: "",
        time: "0",
        memory: "0",
      },
      { status: 200 }
    );
  }
}
