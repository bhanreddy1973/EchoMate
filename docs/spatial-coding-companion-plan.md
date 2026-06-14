# EchoMate Spatial Coding Companion Plan

## Decisions Locked

### Compiler / Online Judge
Use **Judge0** as the primary execution backend.

Why Judge0 over Piston:
- Better fit for “write code in any language”.
- Supports many languages and compiler/runtime versions.
- Designed as an online judge with execution status, compile errors, runtime errors, time, and memory.
- Easier to move from hosted API to self-hosted container later.
- Better for future hidden/custom test execution and submission-like workflows.

MVP fallback option:
- Keep the execution adapter interface provider-agnostic so Piston can be added later as a fallback if Judge0 rate limits or hosted API access becomes an issue.

### Storage
Do **not** replace ChromaDB.

Use a hybrid storage strategy:
- **ChromaDB** stays for semantic long-term memory/RAG:
  - User coding style summaries.
  - Weakness explanations.
  - Recurring mistake patterns.
  - “I usually struggle with DP base cases” type memory.
  - Retrieval for AI coaching.
- Add **SQLite** for structured coding data:
  - Problems.
  - Sessions.
  - Code snapshots.
  - Run results.
  - Topic scores.
  - Attempt history.

Reason:
- Chroma is excellent for vector search, but not ideal as the source of truth for relational analytics like attempts by topic, pass/fail count, time spent, language usage, and run history.
- SQLite fits the current local-first EchoMate project and can later migrate to Postgres without changing frontend UX.

## Correct Product Naming
The existing frontend currently has two main modes:
- **Spatial** — LiveKit voice/orb dashboard.
- **Chat** — text chat overlay.

The new feature should not be named Settle. It should be added as:
- **Coding** — coding-practice workspace.
- Optional analytics sub-panel: **Chart** / **Progress** inside Coding.

Top nav proposal:
```text
[ Spatial ] [ Chat ] [ Coding ]
```

Spatial stays the LiveKit voice companion. Coding should follow the same EchoMate liquid-glass visual language.

## Existing Project UX to Preserve
From the current app:
- Dark-only premium UI.
- Liquid glass panels.
- Emotion accent colors from `EmotionContext`.
- Ambient background.
- Framer Motion transitions.
- Central orb remains meaningful in Spatial; in Coding it can become a small floating coach/orb button.
- Chat uses `/api/chat` and model tier routing.
- Voice uses `/api/token` and LiveKit.
- Backend currently has `token_server.py` with endpoints for chat, token, memories, conversations, and connectors.
- Long-term memory is already ChromaDB via `echomate/memory/long_term.py`.
- Model routing is already NVIDIA/OpenRouter oriented via `echomate/model_router.py`.

## Main Coding UX

### Layout
Coding mode should be a 3-region glass workspace:

```text
Top:   URL import + model picker + status + history/progress buttons
Left:  Problem details
Right: Code editor + runner
Bottom/Drawer: AI Coach + Visualizer + Run results
```

Recommended desktop layout:
- Left panel width: 40% problem statement.
- Right panel width: 60% editor/test runner.
- AI coach as right drawer or bottom drawer, not a separate full page.

Mobile layout:
- Tabs: Problem / Code / Run / Coach / Progress.

### Top Navigation Integration
Modify `SpatialDashboard` view state from:
```ts
"spatial" | "chat"
```
to:
```ts
"spatial" | "chat" | "coding"
```

Use icons:
- Spatial: `LayoutGrid`.
- Chat: `MessageSquare`.
- Coding: `Code2` or `TerminalSquare`.

Keep the same active-button styles using `accentColor` and glass borders.

## Coding Workspace Features

### 1. Problem URL Import
User pastes:
- LeetCode problem URL.
- NeetCode URL/reference.
- Future platforms.

Adapters:
- `LeetCodeAdapter` — fetch problem metadata when publicly available.
- `NeetCodeAdapter` — map/reference roadmaps, but do not copy proprietary NeetCode content.
- `ManualAdapter` — fallback where user pastes markdown/problem text.

Displayed problem details:
- Title.
- Difficulty.
- Platform/source link.
- Statement.
- Examples.
- Constraints.
- Tags.
- Starter code if available.
- Notes.
- Similar/related problems if available.

Legal/product constraint:
- Build an original UI inspired by normal coding-practice patterns.
- Do not copy LeetCode/NeetCode proprietary editorials, assets, premium content, or protected solutions.

### 2. Code Editor
Use **Monaco Editor**.

Initial languages:
- Python.
- JavaScript.
- TypeScript.
- Java.
- C++.

Later:
- Go.
- Rust.
- C#.

Editor features:
- Language selector.
- Starter templates.
- Auto-save draft.
- Code snapshots.
- Format button where supported.
- Copy/download.
- Theme matching EchoMate dark glass UI.

### 3. Judge0 Runner
Execution flow:
1. Frontend sends language, code, stdin/custom tests, and problem/session id.
2. Backend maps app language to Judge0 language id.
3. Backend submits code to Judge0.
4. Backend polls or waits for result.
5. Backend returns status, stdout, stderr, compile output, time, memory.
6. App saves run result into SQLite and optionally stores a memory summary in Chroma.

Security:
- Never run arbitrary user code inside the Next.js app or `token_server.py` process.
- Use Judge0 hosted API or self-hosted Judge0 sandbox.
- Add request size limits, timeout, rate limiting, and max output size.

Environment variables:
```env
JUDGE0_BASE_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=...
JUDGE0_HOST=judge0-ce.p.rapidapi.com
```

If self-hosted later:
```env
JUDGE0_BASE_URL=http://localhost:2358
JUDGE0_API_KEY=
JUDGE0_HOST=
```

### 4. AI Coach
Use NVIDIA first through existing EchoMate model routing.

Coach actions:
- Explain problem.
- Walkthrough examples.
- Validate my approach.
- Give a hint.
- Debug my code.
- Generate edge cases.
- Analyze time/space complexity.
- Optimize approach.
- Dry-run code.
- Visualize flow.
- Show final solution only after confirmation.

Context sent to AI:
- Problem title/statement/examples/constraints/tags.
- Current code.
- Selected language.
- Latest Judge0 result.
- Current notes.
- Attempt history for this problem.
- User style profile from Chroma.
- Weak-topic summary from analytics.

Coach behavior:
- Default to hints and teaching.
- Do not reveal a full solution immediately.
- Ask before showing final accepted-style solution.
- Give concise next action after every response.

### 5. Model Picker
Initial picker should show NVIDIA models from current routing.

Modes:
- Auto.
- Fast.
- Technical.
- Reasoning.

Later provider expansion:
- OpenAI.
- Gemini.
- OpenRouter.

The UI should show:
- Provider.
- Model/tier.
- Status: configured/missing key.
- Best use: fast, code, reasoning.

### 6. Flow Visualization
Visualizer panel supports:
- Flowchart.
- Example walkthrough table.
- Pointer movement.
- Hash map timeline.
- Stack/queue state.
- Recursion tree.
- DP table.
- Graph traversal.

Implementation:
- Use Mermaid for simple generated flowcharts.
- Use React Flow or custom SVG cards for interactive algorithm visuals.
- AI returns structured JSON visualization specs, then UI renders safely.

Example visualization actions:
- “Visualize brute force”.
- “Visualize optimized approach”.
- “Dry run example 1”.
- “Show DP table”.

## Storage Design

### SQLite Tables

`coding_problems`
- `id`
- `source`
- `source_url`
- `slug`
- `title`
- `difficulty`
- `statement_markdown`
- `examples_json`
- `constraints_json`
- `tags_json`
- `starter_code_json`
- `created_at`
- `updated_at`

`coding_sessions`
- `id`
- `problem_id`
- `language`
- `status` — draft/running/solved/revisit.
- `started_at`
- `updated_at`
- `ended_at`
- `time_spent_seconds`
- `current_code`
- `notes`

`code_snapshots`
- `id`
- `session_id`
- `language`
- `code`
- `reason` — autosave/run/manual/ai-suggested.
- `created_at`

`run_results`
- `id`
- `session_id`
- `snapshot_id`
- `provider` — judge0.
- `status`
- `stdout`
- `stderr`
- `compile_output`
- `time`
- `memory`
- `stdin`
- `created_at`

`coach_messages`
- `id`
- `session_id`
- `role`
- `action`
- `content`
- `model`
- `created_at`

`topic_scores`
- `topic`
- `attempts`
- `solved`
- `failed_runs`
- `hints_used`
- `avg_time_seconds`
- `weakness_score`
- `last_practiced_at`

### Chroma Collections
Keep existing `echomate_memories`, or add coding-specific collection:
- `echomate_coding_memory`.

Store semantic summaries like:
- “User often forgets binary search boundary updates.”
- “User prefers Python with helper functions and descriptive variable names.”
- “User struggled with graph visited-set handling on BFS problems.”

Best recommendation:
- Use a separate Chroma collection for coding memory to keep retrieval focused.

## Backend API Plan
Because this project already uses `token_server.py`, add coding endpoints there first for MVP:

- `POST /api/coding/import-url`
- `POST /api/coding/run`
- `POST /api/coding/coach`
- `POST /api/coding/visualize`
- `GET /api/coding/models`
- `GET /api/coding/history`
- `GET /api/coding/analytics`
- `POST /api/coding/session`

Later, if this grows, move these to FastAPI for cleaner routing.

## Frontend Component Plan
New components under `app/components/coding/`:

- `CodingWorkspace.tsx`
- `UrlImportBar.tsx`
- `ProblemPanel.tsx`
- `ProblemTabs.tsx`
- `CodeEditor.tsx`
- `LanguageSelector.tsx`
- `RunnerPanel.tsx`
- `AICoachPanel.tsx`
- `ModelPicker.tsx`
- `VisualizationPanel.tsx`
- `ProgressPanel.tsx`
- `AttemptTimeline.tsx`
- `WeakTopicCard.tsx`

New store:
- `app/store/codingStore.ts`

New types:
- Extend `app/types/index.ts` with problem/session/run/model/visualization types.

## UI/UX Styling Rules
Follow current EchoMate UI exactly:
- Use `AmbientBackground` behind Coding mode.
- Use glass cards with `rgba(255,255,255,0.04)` / `border: rgba(255,255,255,0.09)`.
- Use `accentColor` and `glowColor` from `useEmotion()`.
- Use `motion.div` transitions similar to `SpatialDashboard` and `ChatOverlay`.
- Use small, clean labels: 10–13px metadata; readable problem body.
- Use rounded 16–24px glass cards.
- Keep panels calm and spacious; avoid a direct LeetCode clone.

## MVP Build Order

### Phase 1 — Add Coding Mode Shell
- Add third top nav button: Coding.
- Create `CodingWorkspace` component.
- Add URL import bar, empty problem panel, editor placeholder, coach drawer placeholder.
- Match current Spatial/Chat animation and glass design.

### Phase 2 — Storage + Types
- Add SQLite helper module.
- Add coding tables.
- Add TypeScript coding types.
- Add Zustand coding store.

### Phase 3 — Problem Import
- Add URL parser.
- Add LeetCode adapter.
- Add manual fallback.
- Save/import problem into SQLite.
- Render statement/examples/constraints/tags.

### Phase 4 — Monaco Editor + Judge0
- Install Monaco dependency.
- Add language selector.
- Add Judge0 adapter.
- Add `/api/coding/run`.
- Display stdout/stderr/compile errors/time/memory.
- Save snapshots and run results.

### Phase 5 — NVIDIA AI Coach
- Add `/api/coding/coach`.
- Reuse existing model router and NVIDIA-first technical/reasoning tiers.
- Add coach action buttons.
- Pass problem + code + run result + memory context.
- Save coaching messages.

### Phase 6 — Visualization + Analytics
- Add visualization spec schema.
- Add flowchart/dry-run renderer.
- Add weak-topic scoring.
- Add progress/chart panel inside Coding.
- Store semantic style/weakness summaries in Chroma.

## Final MVP Acceptance Criteria
- User can switch between Spatial, Chat, and Coding without breaking LiveKit voice.
- User can paste a LeetCode URL and see a clean problem panel.
- User can write code in at least Python and JavaScript.
- User can run code through Judge0 and see results.
- AI Coach can explain, walkthrough, validate, and debug using the active problem and code.
- NVIDIA model/tier is selectable.
- Attempts and run results are saved.
- Basic weak-topic suggestions are shown.
- UI looks like EchoMate, not a copied LeetCode/NeetCode UI.
