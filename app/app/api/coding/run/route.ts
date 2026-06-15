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
// For LeetCode-style problems: wraps Solution class with a driver that reads
// stdin, parses inputs, calls the method, and prints output.
function prepareCode(code: string, language: string, stdin?: string): string {
  if (language === "python") {
    // If user already has a driver (print/input/if __name__), don't touch it
    if (code.match(/^[^#\n]*\bprint\s*\(/m) && code.match(/^[^#\n]*\binput\s*\(/m)) {
      return code;
    }
    if (code.includes("if __name__")) {
      return code;
    }

    // Detect Solution class with a method
    const solutionMatch = code.match(/class\s+Solution[\s\S]*?def\s+(\w+)\s*\(\s*self\s*(?:,\s*([^)]*))?\)/);
    if (solutionMatch) {
      const methodName = solutionMatch[1];
      // Generate a universal stdin-parsing driver that handles LeetCode input formats:
      // Format 1: s = "ADOBECODEBANC", t = "ABC"  (one line, named args)
      // Format 2: "ADOBECODEBANC"\n"ABC"  (one value per line)
      // Format 3: [1,2,3]\n5  (JSON values, one per line)
      const driver = `

import sys, json, ast, re

def _parse_value(s):
    """Parse a single value from LeetCode-style input."""
    s = s.strip()
    if not s:
        return s
    try:
        return json.loads(s)
    except (json.JSONDecodeError, ValueError):
        pass
    try:
        return ast.literal_eval(s)
    except (ValueError, SyntaxError):
        pass
    return s

def _parse_leetcode_input(raw):
    """Parse LeetCode test case input into a list of arguments."""
    raw = raw.strip()
    if not raw:
        return []
    
    # Try Format 1: "var = value, var2 = value2" on single/multiple lines
    # Match patterns like: s = "ABC", t = "XYZ" or nums = [1,2,3], target = 5
    assignment_pattern = r'\\w+\\s*=\\s*'
    if re.search(assignment_pattern, raw):
        # Split by comma-separated assignments, handling nested brackets/quotes
        args = []
        # Find all "var = value" patterns
        parts = re.split(r',\\s*(?=\\w+\\s*=)', raw)
        for part in parts:
            part = part.strip()
            eq_match = re.match(r'\\w+\\s*=\\s*(.*)', part, re.DOTALL)
            if eq_match:
                val_str = eq_match.group(1).strip()
                args.append(_parse_value(val_str))
            else:
                args.append(_parse_value(part))
        if args:
            return args
    
    # Try Format 2/3: One value per line
    lines = [l.strip() for l in raw.split('\\n') if l.strip()]
    if len(lines) >= 1:
        return [_parse_value(line) for line in lines]
    
    return [_parse_value(raw)]

def _format_output(result):
    """Format output like LeetCode."""
    if result is None:
        return "null"
    elif isinstance(result, bool):
        return "true" if result else "false"
    elif isinstance(result, str):
        return json.dumps(result)
    elif isinstance(result, (list, tuple)):
        return json.dumps(result)
    elif isinstance(result, dict):
        return json.dumps(result)
    else:
        return str(result)

def _main():
    raw_input = sys.stdin.read()
    args = _parse_leetcode_input(raw_input)
    
    sol = Solution()
    result = sol.${methodName}(*args)
    print(_format_output(result))

_main()
`;
      return code + driver;
    }

    // No Solution class — just add a simple print if nothing outputs
    if (!code.match(/^[^#\n]*\b(print|input)\b/m)) {
      return code + `\n\nprint("Code loaded successfully.")\n`;
    }
    return code;
  }

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

    // Generate a driver main() that reads stdin and calls the Solution method
    // Detect Solution class method signature
    const cppMethodMatch = body.match(/class\s+Solution[\s\S]*?(?:string|int|bool|vector|ListNode|TreeNode|void|long|double|float)\s+(\w+)\s*\(([^)]*)\)/);
    
    if (cppMethodMatch) {
      const methodName = cppMethodMatch[1];
      const paramsStr = cppMethodMatch[2];
      // Parse parameter types
      const params = paramsStr.split(',').map(p => p.trim()).filter(Boolean);
      
      // Build a generic stdin reader that handles LeetCode input format
      result += `

// ─── Auto-generated driver ───
#include <sstream>

// Parse a JSON-like value from a line
string _readLine() {
    string line;
    getline(cin, line);
    // Trim whitespace
    size_t start = line.find_first_not_of(" \\t\\n\\r");
    if (start == string::npos) return "";
    size_t end = line.find_last_not_of(" \\t\\n\\r");
    return line.substr(start, end - start + 1);
}

// Parse "var = value" format or plain value
string _extractValue(const string& s) {
    size_t eq = s.find('=');
    if (eq != string::npos) {
        string val = s.substr(eq + 1);
        size_t start = val.find_first_not_of(" \\t");
        if (start != string::npos) val = val.substr(start);
        return val;
    }
    return s;
}

// Remove surrounding quotes from a string value
string _unquote(const string& s) {
    if (s.size() >= 2 && s.front() == '"' && s.back() == '"')
        return s.substr(1, s.size() - 2);
    return s;
}

// Parse a vector<int> from "[1,2,3]"
vector<int> _parseVecInt(const string& s) {
    vector<int> v;
    string inner = s;
    if (!inner.empty() && inner.front() == '[') inner = inner.substr(1);
    if (!inner.empty() && inner.back() == ']') inner.pop_back();
    stringstream ss(inner);
    string token;
    while (getline(ss, token, ',')) {
        size_t start = token.find_first_not_of(" ");
        if (start != string::npos) {
            v.push_back(stoi(token.substr(start)));
        }
    }
    return v;
}

// Parse vector<string> from ["a","b","c"]
vector<string> _parseVecStr(const string& s) {
    vector<string> v;
    // Simple parser: find quoted strings
    size_t i = 0;
    while (i < s.size()) {
        if (s[i] == '"') {
            size_t j = s.find('"', i + 1);
            if (j != string::npos) {
                v.push_back(s.substr(i + 1, j - i - 1));
                i = j + 1;
            } else break;
        } else i++;
    }
    return v;
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Read all input
    string allInput;
    string line;
    while (getline(cin, line)) {
        if (!allInput.empty()) allInput += "\\n";
        allInput += line;
    }
    
    // Split by assignment pattern "var = value, var2 = value2"
    // or by newlines
    vector<string> args;
    
    // Check if it's "var = val, var2 = val2" format
    if (allInput.find(" = ") != string::npos) {
        // Split by ", varname ="
        string remaining = allInput;
        while (!remaining.empty()) {
            // Find next ", word =" pattern
            size_t nextAssign = string::npos;
            for (size_t i = 1; i < remaining.size(); i++) {
                if (remaining[i] == '=' && i > 1 && remaining[i-1] == ' ') {
                    // Walk back to find comma before this
                    size_t j = i - 2;
                    while (j > 0 && remaining[j] != ',') j--;
                    if (remaining[j] == ',') {
                        nextAssign = j;
                        break;
                    }
                }
            }
            if (nextAssign != string::npos) {
                args.push_back(_extractValue(remaining.substr(0, nextAssign)));
                remaining = remaining.substr(nextAssign + 1);
                size_t start = remaining.find_first_not_of(" ");
                if (start != string::npos) remaining = remaining.substr(start);
            } else {
                args.push_back(_extractValue(remaining));
                break;
            }
        }
    } else {
        // Split by newlines
        stringstream ss(allInput);
        string l;
        while (getline(ss, l)) {
            size_t start = l.find_first_not_of(" \\t\\r");
            if (start != string::npos) {
                args.push_back(l.substr(start));
            }
        }
    }

    Solution sol;
`;

      // Determine return type and generate the call
      const returnTypeMatch = body.match(new RegExp(`(string|int|bool|vector<[^>]+>|vector<vector<[^>]+>>|long\\s*long|double|float|void)\\s+${methodName}\\s*\\(`));
      const returnType = returnTypeMatch ? returnTypeMatch[1].trim() : "string";
      
      // Generate argument parsing based on number of params
      for (let i = 0; i < params.length; i++) {
        const param = params[i].trim();
        if (param.includes("vector<int>") || param.includes("vector<long")) {
          result += `    auto arg${i} = _parseVecInt(args.size() > ${i} ? args[${i}] : "[]");\n`;
        } else if (param.includes("vector<string>")) {
          result += `    auto arg${i} = _parseVecStr(args.size() > ${i} ? args[${i}] : "[]");\n`;
        } else if (param.includes("string")) {
          result += `    string arg${i} = _unquote(args.size() > ${i} ? args[${i}] : "");\n`;
        } else if (param.includes("int") || param.includes("long")) {
          result += `    auto arg${i} = stoi(args.size() > ${i} ? args[${i}] : "0");\n`;
        } else if (param.includes("bool")) {
          result += `    bool arg${i} = (args.size() > ${i} && (args[${i}] == "true" || args[${i}] == "1"));\n`;
        } else if (param.includes("double") || param.includes("float")) {
          result += `    double arg${i} = stod(args.size() > ${i} ? args[${i}] : "0");\n`;
        } else {
          result += `    auto arg${i} = args.size() > ${i} ? args[${i}] : "";\n`;
        }
      }
      
      // Generate method call
      const argList = params.map((_, i) => `arg${i}`).join(", ");
      
      if (returnType === "void") {
        result += `    sol.${methodName}(${argList});\n`;
        result += `    cout << "null" << endl;\n`;
      } else if (returnType === "string") {
        result += `    string result = sol.${methodName}(${argList});\n`;
        result += `    cout << "\\"" << result << "\\"" << endl;\n`;
      } else if (returnType === "bool") {
        result += `    bool result = sol.${methodName}(${argList});\n`;
        result += `    cout << (result ? "true" : "false") << endl;\n`;
      } else if (returnType.includes("vector")) {
        result += `    auto result = sol.${methodName}(${argList});\n`;
        result += `    cout << "[";\n`;
        result += `    for (int i = 0; i < (int)result.size(); i++) {\n`;
        result += `        if (i > 0) cout << ",";\n`;
        if (returnType.includes("string")) {
          result += `        cout << "\\"" << result[i] << "\\"";\n`;
        } else {
          result += `        cout << result[i];\n`;
        }
        result += `    }\n`;
        result += `    cout << "]" << endl;\n`;
      } else {
        result += `    auto result = sol.${methodName}(${argList});\n`;
        result += `    cout << result << endl;\n`;
      }
      
      result += `    return 0;\n}\n`;
    } else {
      // No Solution class found, add a simple main
      result += `\n\nint main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout << "Code loaded successfully." << endl;
    return 0;
}
`;
    }
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
        System.out.println("Code loaded successfully.");
    }
}
`;
  }

  if (language === "javascript" || language === "typescript") {
    // Check for a function that we can call with stdin
    if (!code.match(/\bconsole\.(log|error)\b/) && !code.includes("process.stdout")) {
      // Detect exported/defined function
      const funcMatch = code.match(/(?:var|let|const|function)\s+(\w+)\s*=?\s*(?:function\s*)?\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        return code + `

const _lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');
const _args = _lines.map(line => { try { return JSON.parse(line); } catch { return line; } });
const _result = ${funcName}(..._args);
console.log(typeof _result === 'object' ? JSON.stringify(_result) : _result);
`;
      }
      return code + `\n\nconsole.log("Code loaded successfully.");\n`;
    }
  }

  return code;
}

type TestCaseInput = {
  input?: string;
  expectedOutput?: string;
};

// Decode HTML entities that may come from LeetCode problem parsing
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

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

  // First, try synchronous submission (wait=true)
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
    // If wait=true fails (some instances don't support it), try async
    const asyncRes = await fetch(
      `${baseUrl}/submissions?base64_encoded=true`,
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

    if (!asyncRes.ok) {
      const errText = await asyncRes.text();
      throw new Error(`Judge0 submission failed: ${asyncRes.status} - ${errText.slice(0, 200)}`);
    }

    const { token } = await asyncRes.json();
    if (!token) throw new Error("Judge0 did not return a submission token");

    // Poll for result
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(
        `${baseUrl}/submissions/${token}?base64_encoded=true&fields=*`,
        { headers }
      );
      if (!pollRes.ok) continue;
      const result = await pollRes.json();
      if (result.status && result.status.id > 2) {
        return result;
      }
    }

    throw new Error("Judge0 submission timed out after 20s");
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

    const preparedCode = prepareCode(code, language, stdin);
    const languageId = JUDGE0_LANGUAGE_MAP[language];

    if (Array.isArray(testCases) && testCases.length > 0) {
      const results = [];
      for (const testCase of testCases as TestCaseInput[]) {
        const cleanInput = decodeHtmlEntities(testCase.input || "");
        const cleanExpected = decodeHtmlEntities((testCase.expectedOutput || "").trim());
        const result = await executeCode(preparedCode, languageId, cleanInput);
        const statusId = result.status?.id || 13;
        const mappedStatus = JUDGE0_STATUS_MAP[statusId] || "runtime_error";
        const actualOutput = decodeBase64(result.stdout).trim();

        const passed = mappedStatus === "accepted" && actualOutput === cleanExpected;
        // If code ran successfully but output doesn't match, status should be "wrong_answer"
        const effectiveStatus = mappedStatus === "accepted" && !passed ? "wrong_answer" : mappedStatus;

        results.push({
          input: cleanInput,
          expectedOutput: cleanExpected,
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

    const result = await executeCode(preparedCode, languageId, decodeHtmlEntities(stdin || ""));

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
