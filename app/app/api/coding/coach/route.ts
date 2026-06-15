import { NextRequest, NextResponse } from "next/server";

// Build the system prompt for the AI coach
function buildSystemPrompt(action: string): string {
  const baseInstructions = `You are EchoMate's AI Coding Coach. Your job is to help the user improve at algorithms and data structures using the active problem, current code, selected language, and last run output.

GLOBAL RESPONSE RULES:
- Be accurate, concrete, and grounded in the provided problem/code/run output.
- Prefer teaching and guided discovery over dumping a full solution.
- Use clear markdown sections with short headings.
- When useful, use tables for examples, dry-runs, edge cases, and complexity.
- If you include code, use fenced code blocks with the correct language label.
- Keep code snippets minimal unless the user explicitly asks for a complete solution.
- Never invent problem constraints. If context is missing, say what you are assuming.
- End with a small "Next step" section containing exactly 1-2 actionable items.
- Be direct about bugs, but keep a supportive tone.

DEFAULT STRUCTURE:
1. Quick verdict / goal
2. Key reasoning
3. Specific guidance based on the user's code
4. Next step`;

  const actionSkills: Record<string, string> = {
    explain_problem: `${baseInstructions}

SKILL: Explain Problem
Purpose: Convert the statement into a practical mental model before solving.
Response plan:
- Start with a one-sentence plain-English restatement.
- Define inputs, outputs, and what must be returned/mutated.
- Highlight constraints that affect algorithm choice.
- Identify the core pattern only at a high level, e.g. two pointers, stack, graph, DP, linked list manipulation.
- Mention common traps and edge cases.
- Do NOT provide full algorithm steps or final code.
Preferred format:
## Problem in simple terms
## What matters
## Traps to watch
## Next step`,

    walkthrough_examples: `${baseInstructions}

SKILL: Walkthrough Examples
Purpose: Make sample cases intuitive through step-by-step simulation.
Response plan:
- Use the given examples first. If none exist, create one small illustrative example and label it as assumed.
- Show state changes in a compact table: step, current item/pointer, important variables, result so far.
- Explain why the expected output follows from the rules.
- Connect the example to the underlying pattern without revealing full code.
Preferred format:
## Example walkthrough
| Step | State | Decision | Result |
## Pattern noticed
## Next step`,

    validate_approach: `${baseInstructions}

SKILL: Validate Approach
Purpose: Judge whether the user's current strategy can solve the problem.
Response plan:
- Give a clear verdict: Correct / Partially correct / Incorrect / Not enough code.
- Identify the algorithmic idea detected in the code.
- Check correctness against constraints and examples.
- Call out missing cases, invariant violations, or language/runtime issues.
- If mostly correct, suggest small improvements.
- If wrong, give the smallest conceptual correction, not a full rewrite.
Preferred format:
## Verdict
## What your code is doing
## Gaps or risks
## Minimal next fix
## Next step`,

    give_hint: `${baseInstructions}

SKILL: Give Hint
Purpose: Provide one useful nudge without revealing the solution.
Response plan:
- Give exactly one main hint.
- Phrase it as an observation or question when possible.
- Include why the hint matters.
- Optionally include a tiny pseudo-state example, not full code.
- Avoid giving the complete algorithm unless the user asks again.
Preferred format:
## Hint
## Why this helps
## Try this next`,

    debug_code: `${baseInstructions}

SKILL: Debug Code
Purpose: Find concrete bugs in the user's current implementation.
Response plan:
- Use the last run output first if present.
- Locate likely failing logic by naming the function/block/condition.
- Explain what happens vs what should happen.
- Provide a minimal patch snippet only for the broken part.
- Suggest one test case that verifies the fix.
- If code is incomplete, say exactly what is missing to run/validate.
Preferred format:
## Likely issue
## Why it fails
## Minimal fix
\`\`\`language
// only changed lines or small patch
\`\`\`
## Verify with
## Next step`,

    generate_edge_cases: `${baseInstructions}

SKILL: Generate Edge Cases
Purpose: Produce high-value tests that expose logical mistakes.
Response plan:
- Group cases by category: empty/minimal, boundary, duplicates, invalid-ish input if constraints allow, stress/large, tricky structure.
- For each case include input, expected output/behavior, and why it matters.
- Match the problem's input style when possible.
- Do not over-generate; 6-10 strong cases is enough.
Preferred format:
## Edge cases
| Case | Input | Expected | Why it matters |
## Most important one to run first
## Next step`,

    analyze_complexity: `${baseInstructions}

SKILL: Analyze Complexity
Purpose: Explain time and space cost of the current code/approach.
Response plan:
- Identify variables, e.g. n = length of list, m = rows, E = edges.
- Analyze each important loop/recursion/data structure.
- Give final Big-O for time and space.
- If code has nested loops, explain whether they truly multiply.
- Compare with the expected optimal complexity if known.
Preferred format:
## Complexity summary
| Part | Cost | Reason |
## Final Big-O
## Can it be improved?
## Next step`,

    optimize_approach: `${baseInstructions}

SKILL: Optimize Approach
Purpose: Improve algorithmic efficiency while preserving correctness.
Response plan:
- Identify the current bottleneck from code or likely brute-force approach.
- State the target optimal complexity.
- Explain the key data structure/invariant enabling the optimization.
- Provide pseudocode or a small snippet only if needed.
- Discuss tradeoffs and edge cases introduced by optimization.
Preferred format:
## Bottleneck
## Better idea
## Why it works
## Pseudocode
## Complexity
## Next step`,

    dry_run: `${baseInstructions}

SKILL: Dry Run
Purpose: Trace execution so the user can see variable/state changes.
Response plan:
- Pick the first provided example unless the user supplied a custom input.
- Track meaningful variables/pointers/collections.
- Use a table with step-by-step updates.
- Point out the exact step where behavior diverges if debugging.
- Keep it readable; summarize repeated iterations.
Preferred format:
## Dry run input
| Step | Operation | Variables/state | Output/effect |
## Observation
## Next step`,

    visualize_flow: `${baseInstructions}

SKILL: Visualize Flow
Purpose: Generate a renderable visual diagram, not prose.
STRICT OUTPUT RULES:
- Output ONLY one fenced Mermaid code block.
- Do not write any text before or after the code block.
- Do not explain the diagram in prose.
- The first line must be exactly: \`\`\`mermaid
- The last line must be exactly: \`\`\`
Diagram selection:
- Use flowchart TD for general algorithms, linked-list pointer changes, two pointers, stacks, queues, heaps, greedy, and binary search.
- Use graph TD/LR for graph traversal.
- Use stateDiagram-v2 for state machines or pointer state transitions.
- Use sequenceDiagram for call/interaction flows.
- Use classDiagram for object/class relationships.
- Use erDiagram for data/entity relationships.
- Use journey, timeline, mindmap, pie, quadrantChart, gitGraph, or requirementDiagram only when those better fit the problem.
Quality rules:
- Keep node labels short.
- Escape special characters by simplifying labels.
- Prefer valid Mermaid over clever syntax.
Required output shape:
\`\`\`mermaid
flowchart TD
  A[Start] --> B[Decision]
\`\`\``, 

    show_solution: `${baseInstructions}

SKILL: Show Solution
Purpose: Reveal a complete solution only when appropriate.
Response plan:
- If the user has not clearly confirmed they want the final answer, ask for confirmation and offer one more hint.
- If they clearly confirm or repeatedly ask, provide: approach, correctness intuition, clean code in selected language, complexity, edge cases.
- Keep the solution original and explanatory.
Preferred format when confirmed:
## Approach
## Correctness intuition
## Code
\`\`\`language
...
\`\`\`
## Complexity
## Next step`,

    free_text: `${baseInstructions}

SKILL: Free-form Coding Help
Purpose: Answer the user's exact question while using problem/code/run context.
Response plan:
- First infer the user's intent: explain, debug, optimize, test, or solution request.
- Answer directly, then add only the most relevant supporting details.
- If the question is vague, provide a best-effort answer and ask one clarifying question at the end.
- Do not reveal a full solution unless clearly requested.`
  };

  return actionSkills[action] || actionSkills.free_text;
}

type CoachProblem = {
  title?: string;
  difficulty?: string;
  tags?: string[];
  statementMarkdown?: string;
  examples?: { input?: string; output?: string }[];
  constraints?: string[];
};

type CoachRunResult = {
  status?: string;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
};

type CoachApiResponse = {
  choices?: { message?: { content?: string } }[];
};

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

// Build the user message with context
function buildUserMessage(params: {
  action: string;
  message?: string;
  problem?: CoachProblem | null;
  code: string;
  language: string;
  lastResult?: CoachRunResult | null;
  tier?: string;
}): string {
  const { action, message, problem, code, language, lastResult, tier } = params;

  let content = `## Requested Coach Action\n${action}\n`;
  if (tier) content += `Model tier: ${tier}\n`;
  content += "\n";

  if (problem) {
    content += `## Problem: ${problem.title} (${problem.difficulty})\n`;
    content += `Tags: ${problem.tags?.join(", ") || "none"}\n\n`;
    content += `### Statement:\n${problem.statementMarkdown?.slice(0, 1500) || "N/A"}\n\n`;

    const examples = problem.examples || [];
    if (examples.length > 0) {
      content += `### Examples:\n`;
      examples.slice(0, 3).forEach((ex, i: number) => {
        content += `Example ${i + 1}: Input: ${ex.input || ""} | Output: ${ex.output || ""}\n`;
      });
      content += "\n";
    }

    const constraints = problem.constraints || [];
    if (constraints.length > 0) {
      content += `### Constraints:\n${constraints.join("\n")}\n\n`;
    }
  }

  content += `## Current Code (${language}):\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;

  if (lastResult) {
    content += `## Last Run Result:\n`;
    content += `Status: ${lastResult.status}\n`;
    if (lastResult.stdout) content += `stdout: ${lastResult.stdout.slice(0, 500)}\n`;
    if (lastResult.stderr) content += `stderr: ${lastResult.stderr.slice(0, 500)}\n`;
    if (lastResult.compileOutput) content += `Compile: ${lastResult.compileOutput.slice(0, 500)}\n`;
    content += "\n";
  }

  if (message) {
    content += `## User Message:\n${message}\n`;
  }

  return content;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, message, problem, code, language, lastResult, model, tier } = body as {
      action?: string;
      message?: string;
      problem?: CoachProblem | null;
      code?: string;
      language?: string;
      lastResult?: CoachRunResult | null;
      model?: string;
      tier?: string;
    };

    const systemPrompt = buildSystemPrompt(action || "free_text");
    const userMessage = buildUserMessage({
      action: action || "free_text",
      message,
      problem,
      code: code || "",
      language: language || "python",
      lastResult,
      tier,
    });

    const nvidiaKey = process.env.NVIDIA_NIM_API_KEY;
    const nvidiaIntegrateKey = process.env.NVIDIA_INTEGRATE_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    // Determine which provider/endpoint to use based on model ID
    const modelProvider = model?.split("/")[0] || "";
    const isNvidiaModel = ["meta", "nvidia", "mistralai", "deepseek-ai", "moonshotai", "z-ai", "google", "minimaxai"].includes(modelProvider);
    const isOpenRouterModel = modelProvider === "openrouter";

    let apiUrl: string;
    let apiKey: string;
    let modelId: string;
    let headers: Record<string, string>;

    // NVIDIA models (meta/*, nvidia/*, mistralai/*, minimaxai/*)
    if (isNvidiaModel && (nvidiaKey || nvidiaIntegrateKey)) {
      apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      // Use NVIDIA_INTEGRATE_API_KEY for MiniMax/Mistral models if available, or try both keys
      apiKey = ((modelProvider === "minimaxai" || modelProvider === "mistralai") && nvidiaIntegrateKey) ? nvidiaIntegrateKey : (nvidiaKey || nvidiaIntegrateKey || "");
      modelId = model || "meta/llama-3.1-70b-instruct";
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
    } else if (isOpenRouterModel && openRouterKey) {
      // OpenRouter models — use "openrouter/auto" → let OpenRouter pick
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = openRouterKey;
      modelId = model === "openrouter/auto" ? "meta-llama/llama-3.1-70b-instruct:free" : model || "meta-llama/llama-3.1-70b-instruct:free";
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://echomate.app",
        "X-Title": "EchoMate Coding Coach",
      };
    } else if (nvidiaKey || nvidiaIntegrateKey) {
      // Default: try NVIDIA with a known good model
      apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      apiKey = nvidiaKey || nvidiaIntegrateKey || "";
      modelId = model || "meta/llama-3.1-70b-instruct";
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
    } else if (openRouterKey) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = openRouterKey;
      modelId = "meta-llama/llama-3.1-70b-instruct:free";
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://echomate.app",
        "X-Title": "EchoMate Coding Coach",
      };
    } else {
      return NextResponse.json({
        response: "No AI model configured. Add `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` to your `.env` file to enable AI coaching.",
        model: "none",
      });
    }

    // First attempt
    let response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    // If NVIDIA returns 404 (model not found), retry with fallback model
    if (!response.ok && apiUrl.includes("nvidia.com")) {
      const status = response.status;
      console.warn(`NVIDIA API returned ${status} for model "${modelId}" with current key`);

      // If we have an alternate NVIDIA key, try the same model with that key first
      if (nvidiaIntegrateKey && apiKey !== nvidiaIntegrateKey) {
        console.warn(`Retrying model "${modelId}" with NVIDIA_INTEGRATE_API_KEY`);
        headers["Authorization"] = `Bearer ${nvidiaIntegrateKey}`;
        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            max_tokens: 2048,
            temperature: 0.7,
            top_p: 0.9,
          }),
        });
        if (response.ok) {
          const data = await response.json() as CoachApiResponse;
          const aiResponse = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
          return NextResponse.json({ response: aiResponse, model: modelId });
        }
      }

      // Try fallback NVIDIA model
      const fallbackModel = "meta/llama-3.1-70b-instruct";
      if (modelId !== fallbackModel) {
        console.warn(`Retrying with fallback model: ${fallbackModel}`);
        // Reset to primary key for the fallback model (we know it works)
        headers["Authorization"] = `Bearer ${nvidiaKey || nvidiaIntegrateKey}`;
        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: fallbackModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            max_tokens: 2048,
            temperature: 0.7,
            top_p: 0.9,
          }),
        });
        if (response.ok) {
          const data = await response.json() as CoachApiResponse;
          const aiResponse = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
          return NextResponse.json({
            response: `⚠️ *Model "${modelId}" is unavailable for your API key. Using fallback.*\n\n${aiResponse}`,
            model: fallbackModel,
            requestedModel: modelId,
            fallback: true,
          });
        }
      }

      // If still failing, try OpenRouter as last resort
      if (!response.ok && openRouterKey) {
        console.warn(`NVIDIA fallback also failed, trying OpenRouter`);
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://echomate.app",
          "X-Title": "EchoMate Coding Coach",
        };
        modelId = "meta-llama/llama-3.1-70b-instruct:free";

        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            max_tokens: 2048,
            temperature: 0.7,
            top_p: 0.9,
          }),
        });
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const data = await response.json() as CoachApiResponse;
    const aiResponse = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    return NextResponse.json({
      response: aiResponse,
      model: modelId,
    });
  } catch (error: unknown) {
    console.error("Coach error:", error);
    return NextResponse.json(
      {
        response: `Coach error: ${getErrorMessage(error, "Unknown error")}. Check your API keys and try again.`,
        model: "error",
      },
      { status: 200 }
    );
  }
}
