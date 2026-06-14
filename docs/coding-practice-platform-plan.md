# Coding Practice Platform Plan

> Superseded/refined by `docs/spatial-coding-companion-plan.md`, which corrects the product naming from Settle to Spatial/Coding and locks Judge0 + SQLite/Chroma hybrid storage.

## Goal
Add a NeetCode/LeetCode-inspired coding-practice mode to EchoMate where a user can paste a problem URL, view the parsed problem details, code in a split editor, run code through online compilers, ask an AI coach for contextual help, visualize solution flow, and track long-term weaknesses/style.

> Legal/product note: LeetCode and NeetCode content and UI are owned by their respective companies. We should build an original experience inspired by common coding-practice workflows, use public/allowed metadata where possible, and avoid copying proprietary editorials/solutions or protected UI assets.

## Core User Flow
1. User opens `Settle` / coding-practice mode.
2. User pastes a URL from LeetCode, NeetCode, or another supported platform.
3. App validates the URL and fetches/imports problem metadata.
4. Left pane shows problem statement, examples, constraints, tags, difficulty, hints, notes, and discussion/links where available.
5. Right pane shows a multi-language code editor with templates and test runner.
6. User chooses language and writes code.
7. User runs sample/custom tests through a compiler/execution provider.
8. User opens Bot Help. The AI receives the current problem, code, selected language, run results, past history, and user preferences.
9. AI offers actions: explain problem, walkthrough examples, validate approach, identify bug, optimize, generate dry run, visualize flow, suggest next topic.
10. Session results are saved: attempts, code versions, time spent, mistakes, tags, outcome, AI feedback, and style profile updates.

## Main Navigation / Feature Names
Proposed top-level option: `Settle`.
Inside Settle:
- `Coding`: URL import, editor, compiler, AI help.
- `Chart`: progress analytics, topic heatmap, weak areas.
- `Coach`: personalized practice recommendations.

If you meant three separate options named `settle`, `char`, and `coding`, implement them as:
- `Settle`: main practice workspace.
- `Char`/`Chart`: analytics and visualization dashboard.
- `Coding`: direct editor/problem-solving page.

## Feature Scope

### 1. Problem Import
Supported sources:
- LeetCode problem URLs.
- NeetCode roadmap/problem URLs as references.
- Manual paste fallback for unsupported pages.
- Future: Codeforces, HackerRank, GeeksForGeeks.

Data to display:
- Title.
- Difficulty.
- Platform/source.
- Problem statement.
- Examples with input/output/explanation.
- Constraints.
- Tags/topics.
- Hints if publicly available.
- Function signature/starter code when available.
- Related problems/roadmap category when available.
- Original source link.

Implementation approach:
- Create source adapters instead of hardcoding one scraper.
- `LeetCodeAdapter`: use public GraphQL-style problem endpoint where available; otherwise ask user to paste statement.
- `NeetCodeAdapter`: avoid copying proprietary content; use it as a roadmap/reference link and map to LeetCode problem slug when possible.
- `ManualAdapter`: user can paste markdown/text problem statement.
- Cache imported problem data locally to reduce repeated calls.

### 2. Split Practice Workspace
Left side:
- Problem detail tabs: Description, Examples, Constraints, Hints, Notes, Submissions, Similar.
- Sticky difficulty/tags/status.
- Markdown/math/code rendering.
- Example selector.

Right side:
- Code editor with language selector.
- Starter template generation.
- Run button.
- Custom test input panel.
- Output/error panel.
- Version history.
- Submit/check button where feasible.

Recommended editor:
- Monaco Editor for VS Code-like experience.
- Fallback: CodeMirror if bundle/performance becomes an issue.

Supported languages initially:
- Python.
- JavaScript/TypeScript.
- Java.
- C++.
- Go.
- Rust.

### 3. Online Compiler / Execution
Provider options:
- Judge0 CE/API for multi-language execution.
- Piston API as a simpler execution backend.
- Local sandbox only if security is handled properly.

Execution data:
- Language.
- Source code.
- stdin/custom tests.
- expected output if available.
- runtime.
- memory.
- compile errors.
- stderr.
- status.

Security requirements:
- Never execute arbitrary user code directly in the Next.js/Python app process.
- Use external sandboxed execution provider or container isolation.
- Apply timeouts, memory limits, rate limits, and input size limits.

### 4. AI Bot Help
Model provider requirement:
- Use NVIDIA NIM first.
- Later add OpenAI and Gemini via pluggable model provider registry.

AI model picker:
- Display available providers/models.
- Default to NVIDIA.
- Show status: configured/missing key/health.
- Allow per-session model choice.

Bot actions:
- Explain the problem in simple terms.
- Walkthrough examples.
- Clarify constraints.
- Identify patterns: two pointers, sliding window, DP, graph, heap, binary search, etc.
- Validate my approach.
- Give only a hint, not full solution.
- Debug current code.
- Analyze time/space complexity.
- Optimize current approach.
- Generate additional edge cases.
- Dry run my code.
- Compare brute force vs optimized.
- Show pseudocode.
- Show final solution only after confirmation.

AI context passed:
- Problem metadata.
- Current code.
- Selected language.
- Test results and errors.
- User notes.
- Attempt history for this problem.
- User learning profile and weak topics.
- User requested help mode.

Guardrails:
- Default to coaching/hints before revealing full solution.
- Ask before giving complete accepted solution.
- Highlight reasoning and mistakes.
- Avoid hallucinating platform-specific hidden tests.

### 5. Flow Visualization
Visualizations:
- Algorithm flowchart.
- Step-by-step dry run table.
- Data structure state timeline.
- Recursion tree.
- DP table/grid.
- Graph traversal animation.
- Pointer movement animation.
- Complexity growth illustration.

Libraries:
- Mermaid for generated flowcharts.
- React Flow for interactive algorithm diagrams.
- D3 or custom SVG/canvas for arrays, graphs, DP grids.

AI-assisted visualization:
- AI outputs a structured visualization spec, not raw freeform only.
- Frontend renders spec safely.

Example visualization spec types:
- `arrayPointers`.
- `hashMapTimeline`.
- `recursionTree`.
- `dpTable`.
- `graphTraversal`.
- `flowchart`.

### 6. Code Style Memory
Capture from user code:
- Preferred language.
- Variable naming patterns.
- Function decomposition style.
- Use of comments.
- Common imports/templates.
- Formatting preferences.
- Frequent mistakes: off-by-one, wrong base case, missed null case, overflow, mutability bugs.

Use cases:
- Generate starter code in user style.
- Explain suggestions in familiar style.
- Identify style drift or readability problems.
- Recommend refactors aligned with user's habits.

Storage:
- User profile table/document.
- Code snapshots per attempt.
- Derived style profile generated periodically by AI.

### 7. Learning Analytics / Weak Topic Detection
Track:
- Problems attempted/completed.
- Tags/topics.
- Difficulty.
- Time to first accepted/custom pass.
- Number of failed runs.
- Error categories.
- Help requests by type.
- Repeated confusion patterns.
- Confidence rating after problem.

Analytics shown:
- Topic heatmap.
- Weak topics ranked by evidence.
- Recent mistakes.
- Recommended next 5 problems.
- Spaced repetition queue.
- Progress by roadmap/category.
- Weekly summary.

Weakness model:
- Score topics using recency-weighted attempts, failures, hints used, time spent, and self-rating.
- Store evidence so suggestions are explainable: “Improve DP because 4 of your last 6 DP attempts needed base-case help.”

## Proposed Architecture

### Frontend: Next.js app
New routes:
- `app/app/settle/page.tsx` — main practice workspace.
- `app/app/settle/chart/page.tsx` — analytics/weakness dashboard.
- `app/app/settle/history/page.tsx` — attempts and code versions.

New components:
- `components/coding/UrlImportBar.tsx`.
- `components/coding/ProblemPanel.tsx`.
- `components/coding/ProblemTabs.tsx`.
- `components/coding/CodeEditor.tsx`.
- `components/coding/LanguageSelector.tsx`.
- `components/coding/TestRunnerPanel.tsx`.
- `components/coding/AICoachPanel.tsx`.
- `components/coding/ModelPicker.tsx`.
- `components/coding/VisualizationPanel.tsx`.
- `components/coding/AttemptTimeline.tsx`.
- `components/coding/WeakTopicCard.tsx`.

Client state:
- Zustand store for active problem/session/editor state.
- Persist code drafts in browser storage and backend.

### Backend APIs
Use Next.js route handlers or Python FastAPI service. Since EchoMate already has Python AI/memory components, either approach works:

Option A: Next.js API routes for UI-facing endpoints, Python for AI/memory.
Option B: Python FastAPI backend for all coding APIs, Next.js frontend only.

Recommended hybrid:
- Next.js route handlers for UI orchestration.
- Python EchoMate services for model routing, memory, and analytics.

Endpoints:
- `POST /api/coding/import-url`.
- `GET /api/coding/problems/:id`.
- `POST /api/coding/run`.
- `POST /api/coding/coach`.
- `POST /api/coding/visualize`.
- `POST /api/coding/attempts`.
- `GET /api/coding/history`.
- `GET /api/coding/analytics`.
- `GET /api/models`.

### Data Model
Core entities:
- `Problem`.
- `ProblemExample`.
- `CodingSession`.
- `CodeSnapshot`.
- `RunResult`.
- `AICoachMessage`.
- `UserSkillProfile`.
- `TopicWeakness`.
- `StyleProfile`.
- `PracticeRecommendation`.

Example `Problem` fields:
- `id`, `source`, `sourceUrl`, `slug`, `title`, `difficulty`, `statementMarkdown`, `examples`, `constraints`, `tags`, `starterCode`, `createdAt`, `updatedAt`.

Example `CodingSession` fields:
- `id`, `problemId`, `userId`, `language`, `status`, `startedAt`, `endedAt`, `timeSpentSeconds`, `currentCode`, `notes`.

### AI Provider Layer
Provider registry:
- NVIDIA provider using `NVIDIA_NIM_API_KEY`.
- Future OpenAI provider using `OPENAI_API_KEY`.
- Future Gemini provider using `GEMINI_API_KEY`.

Model list endpoint returns:
- Provider.
- Model id.
- Display name.
- Context window.
- Capabilities: text, code, vision, reasoning.
- Availability.

Initial NVIDIA models can be configured from environment rather than hardcoded.

## Phased Task Plan

### Phase 0 — Requirements and UX Wireframe
- Confirm exact naming: `Settle`, `Chart`, `Coding`.
- Confirm first platforms: LeetCode + NeetCode mapping + manual fallback.
- Confirm compiler provider: Judge0 or Piston.
- Define MVP languages.
- Build wireframes for split workspace, AI panel, analytics.

### Phase 1 — Foundation
- Add `/settle` route and navigation entry.
- Create coding Zustand store.
- Add common TypeScript types for problem/session/run/model.
- Add basic layout: URL import top, problem left, editor right, AI drawer/bottom panel.
- Add model picker UI with NVIDIA-only initial data.

### Phase 2 — Problem Import
- Implement URL parser.
- Implement LeetCode adapter.
- Implement NeetCode-to-LeetCode mapping/reference support.
- Implement manual import fallback.
- Cache/import problem into local backend store.
- Render statement/examples/constraints/tags.

### Phase 3 — Editor and Runner
- Add Monaco editor.
- Add language selector and starter templates.
- Add Piston/Judge0 API integration.
- Add sample/custom test execution.
- Display compile/runtime errors clearly.
- Save code snapshots and run results.

### Phase 4 — AI Coach
- Add `/api/coding/coach` endpoint.
- Add NVIDIA NIM service adapter.
- Build prompt templates for help modes.
- Pass problem + code + tests + history to AI.
- Add coaching UI actions.
- Add “hint first” guardrail.
- Save AI interactions.

### Phase 5 — Visualization
- Define visualization spec schema.
- Add Mermaid/React Flow renderer.
- Implement AI `visualize approach` action.
- Implement manual visualizers for common patterns.
- Add dry-run table rendering.

### Phase 6 — History, Style, and Weakness Analytics
- Store attempts, outcomes, tags, and help requests.
- Implement style profile extraction from submitted code.
- Implement weak-topic scoring.
- Add `/settle/chart` dashboard.
- Add recommendations and spaced repetition queue.
- Add “what to improve next” panel.

### Phase 7 — Polish and Safety
- Improve responsive design.
- Add loading/error states.
- Add rate limiting and provider error fallbacks.
- Add tests for adapters, run API, coach prompt builder, analytics scoring.
- Add privacy controls: delete history, disable code memory, export data.

## MVP Definition
MVP should include:
- `/settle` page.
- Paste LeetCode URL.
- Display problem details.
- Code editor for Python + JavaScript.
- Run code via one compiler provider.
- NVIDIA model picker.
- Bot help with explain/walkthrough/validate/debug actions.
- Save attempts locally.
- Basic topic stats.

## Later Enhancements
- Full roadmap like blind75/neetcode150 style tracking, but original UI/content.
- Collaborative rooms/interview mode.
- Voice-driven coaching using existing EchoMate LiveKit pipeline.
- Calendar reminders for spaced repetition.
- Browser extension to send current LeetCode problem into EchoMate.
- Mock interview timer and scoring.
- Plagiarism/self-solution policy controls.
- Mobile layout.

## Risks / Open Questions
- LeetCode/NeetCode content access may change or be restricted.
- Online execution APIs may have rate limits/costs.
- Secure code execution must not be self-hosted casually.
- AI should not always reveal full solutions; it should coach.
- Data privacy is important because code/history are personal.

## Immediate Next Tasks
1. Decide compiler provider: Piston for quick MVP or Judge0 for more languages.
2. Decide storage: lightweight SQLite/Prisma for Next.js, or Python-side JSON/SQLite integrated with EchoMate memory.
3. Add `/settle` UI skeleton.
4. Add problem import route and LeetCode adapter.
5. Add Monaco editor and local draft persistence.
6. Add NVIDIA model list and basic coach endpoint.
