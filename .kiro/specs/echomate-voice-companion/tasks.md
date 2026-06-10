# Implementation Plan: EchoMate Voice Companion

## Overview

EchoMate is a modular, event-driven real-time voice agent built on LiveKit Agents Python. Implementation follows a bottom-up approach: configuration and data models first, then core components (model router, memory, MCP), followed by the orchestrator wiring everything together, companion features, observability, frontend, and finally development tooling and documentation.

## Tasks

- [x] 1. Set up project structure, configuration, and data models
  - [x] 1.1 Create project directory structure and initialize pyproject.toml
    - Create the full directory tree as specified in the design (echomate/, frontend/, scripts/, tests/, data/, .agents/)
    - Initialize pyproject.toml with Python 3.11+ requirement and core dependencies: livekit-agents, livekit-plugins-deepgram, livekit-plugins-cartesia, livekit-plugins-silero, litellm, pydantic, pydantic-settings, llamaindex, chromadb, mcp
    - Create .env.example with all required environment variables documented
    - Create .gitignore excluding .env, data/chroma/, node_modules/, __pycache__/, .agents/skills/
    - _Requirements: 10.1, 10.2, 10.5, 12.2_

  - [x] 1.2 Implement Pydantic configuration models in `echomate/config/settings.py`
    - Implement ASRConfig, TTSConfig, LLMConfig, MemoryConfig, MCPConfig, LiveKitConfig, and root AppConfig models
    - Add validation that refuses startup on invalid config with clear error messages
    - Load from environment variables and .env file using pydantic-settings
    - _Requirements: 10.1, 10.4, 10.6, 10.7_

  - [x] 1.3 Define all data models in `echomate/models.py`
    - Implement MemoryEntry, MemoryContext, Task, Reminder, HabitEntry, PipelineMetrics, ModelStats, MCPServerStats, MCPTool, MCPToolResult, ToolResult, CompanionState, ModelEndpoint, QueryComplexity enum
    - Use Pydantic BaseModel with proper typing and defaults
    - _Requirements: 5.1, 7.3, 8.1_

  - [x]* 1.4 Write unit tests for configuration validation
    - Test valid config loads successfully
    - Test invalid config raises descriptive errors with field name and reason
    - Test env variable loading and .env file fallback
    - _Requirements: 10.6_

- [x] 2. Implement Model Router with free LLM endpoints
  - [x] 2.1 Implement complexity classification in `echomate/model_router.py`
    - Implement QueryComplexity enum (SIMPLE, MODERATE, COMPLEX)
    - Build classify_complexity method using token count heuristics and keyword detection
    - Simple: < 20 tokens, greetings, confirmations; Complex: multi-step, synthesis; Moderate: everything else
    - _Requirements: 3.2, 3.3_

  - [x] 2.2 Implement model routing and fallback logic
    - Implement ModelRouter class with model registry (NVIDIA NIM Nemotron + OpenRouter free models)
    - Implement route() method: classify → filter by tier → sort by priority/health → call via LiteLLM → stream tokens
    - Implement fallback chain: on error or 5s timeout, try next model (max 3 fallbacks)
    - Implement update_stats() for rolling performance tracking
    - Implement get_available_models() filtered by tier
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [x]* 2.3 Write property test for model routing consistency
    - **Property 3: Model routing consistency**
    - Verify that within a single request, if fallback occurs, the same message list is used for the next model attempt (no mutation between retries)
    - **Validates: Requirements 3.4, 3.5**

  - [x]* 2.4 Write unit tests for Model Router
    - Test complexity classification with various inputs (greetings, multi-step queries, single-fact lookups)
    - Test fallback chain ordering and exhaustion
    - Test stats update rolling calculations
    - Test AllModelsFailedError raised when chain exhausted
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Implement Memory System with RAG
  - [x] 3.1 Implement Short-Term Memory in `echomate/memory/short_term.py`
    - Implement ShortTermMemory class with sliding window conversation buffer
    - Implement add() with automatic trimming when over token budget (default 4000 tokens)
    - Implement get_messages() and clear()
    - _Requirements: 5.4_

  - [x] 3.2 Implement Long-Term Memory with Chroma in `echomate/memory/long_term.py`
    - Implement LongTermMemory class using LlamaIndex + Chroma
    - Implement store() for embedding and persisting facts with metadata and timestamps
    - Implement search() with top_k=5 and configurable min_score=0.7
    - Implement delete() for semantic similarity-based deletion
    - Implement is_available() health check for Chroma connection
    - _Requirements: 5.1, 5.3, 5.6, 5.7_

  - [x] 3.3 Implement MemoryManager facade in `echomate/memory/__init__.py`
    - Implement get_context(query) combining short-term messages and long-term RAG results
    - Implement store_fact(fact, metadata) with timestamp
    - Implement end_session(conversation) for session summarization (max 500 tokens)
    - Implement forget(query) with confirmation of removed items
    - Handle Chroma unavailability gracefully (continue with STM only)
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 5.8, 5.9_

  - [x]* 3.4 Write property test for memory retrieval freshness
    - **Property 5: Memory retrieval freshness**
    - Verify facts stored in the current session are immediately searchable in subsequent queries within the same session
    - **Validates: Requirements 5.2, 5.3**

  - [x]* 3.5 Write unit tests for Memory System
    - Test token budget trimming in ShortTermMemory
    - Test store/search/delete with mock Chroma
    - Test graceful degradation when Chroma is unavailable
    - Test session summarization stores to long-term memory
    - Test forget() removes matching entries and returns descriptions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement MCP Manager and Tool Registry
  - [x] 5.1 Implement MCP Manager in `echomate/mcp_manager.py`
    - Implement MCPManager class with MCPServerConfig and MCPServerState
    - Implement initialize() to connect to configured servers with 15s timeout, discover tools via MCP protocol
    - Implement list_tools() returning all tools across connected servers
    - Implement call_tool(name, arguments) with 10s timeout and routing to correct server (first match in config order)
    - Implement get_tools_as_openai_functions() for LLM function-calling format
    - Implement reconnect_server() and get_server_status()
    - Handle server failures gracefully: mark unavailable, continue with remaining
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9_

  - [x] 5.2 Create MCP server configuration file `mcp_servers.json`
    - Define configuration for weather, calendar, and web-search MCP servers
    - Support environment variable expansion (${VAR}) in env fields
    - _Requirements: 4.1, 4.3, 4.5_

  - [x] 5.3 Implement Tool Registry in `echomate/tools/registry.py`
    - Implement ToolRegistry combining MCP tools and built-in tools
    - Implement get_all_tools() returning combined OpenAI function format definitions
    - Implement resolve_and_call(name, args) routing to MCP or built-in
    - _Requirements: 4.2, 4.6, 4.10_

  - [x] 5.4 Implement built-in tools in `echomate/tools/builtin.py`
    - Implement basic tools: timer, math calculations, date/time utilities
    - Register as fallback when no MCP tool matches
    - _Requirements: 4.6_

  - [x]* 5.5 Write unit tests for MCP Manager and Tool Registry
    - Test tool resolution priority (first matching server in config order)
    - Test timeout handling (10s per call)
    - Test tool format conversion to OpenAI functions
    - Test graceful handling of server connection failures
    - Test reconnection logic
    - _Requirements: 4.1, 4.4, 4.8, 4.9_

- [x] 6. Implement Personality and Prompt Building
  - [x] 6.1 Implement Personality Manager in `echomate/personality.py`
    - Implement PersonalityProfile model with tone, verbosity, humor, formality, proactiveness, greeting configs
    - Implement PersonalityManager with get_system_prompt_fragment() generating personality instructions
    - Implement update_preference() persisting changes to memory
    - Implement get_verbosity_instruction() for response length constraints (brief: ≤2 sentences, moderate: 3-5, detailed: 6+)
    - Handle missing/invalid profile with defaults (friendly, moderate, defaults)
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

  - [x] 6.2 Implement Prompt Builder in `echomate/prompts/builder.py`
    - Implement build_system_prompt() assembling personality, memory context, available tools, and companion state
    - Implement build_messages() creating final OpenAI-format message list (system + short-term + user input)
    - Create prompt templates in `echomate/prompts/templates.py`
    - _Requirements: 6.2, 6.4_

  - [x]* 6.3 Write unit tests for Personality and Prompt Builder
    - Test prompt fragment generation for each tone/verbosity combination
    - Test assembled prompts contain expected sections
    - Test preference updates are persisted
    - Test default profile applied when config missing
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [x] 7. Implement Observability System
  - [x] 7.1 Implement MetricsCollector and StructuredLogger in `echomate/observability.py`
    - Implement StructuredLogger wrapping Python logging with JSON formatters and configurable levels
    - Implement MetricsCollector with start_request() generating correlation IDs
    - Implement record_asr_latency(), record_llm_metrics(), record_tts_latency(), record_mcp_call()
    - Implement complete_request() producing PipelineMetrics
    - Implement get_model_stats() and get_mcp_stats() with rolling 5-minute windows
    - Implement check_latency_budgets() emitting warnings for ASR > 300ms, LLM TTFT > 500ms, TTS > 200ms
    - Ensure every request (success or failure) produces a metrics entry
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x]* 7.2 Write property test for metric completeness
    - **Property 7: Metric completeness**
    - Verify every request that passes through the pipeline produces a metrics entry, whether it succeeds or fails
    - **Validates: Requirements 8.1, 8.7**

  - [x]* 7.3 Write unit tests for Observability
    - Test metric recording produces valid PipelineMetrics
    - Test rolling window calculations for model and MCP stats
    - Test latency budget detection emits warnings correctly
    - Test structured log output format
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 8. Implement Companion Features
  - [x] 8.1 Implement Task Manager in `echomate/companion/tasks.py`
    - Implement create_task() with title (max 200 chars), optional due_date
    - Implement get_pending_tasks(within_hours=24)
    - Implement complete_task() by task_id
    - Store tasks in long-term memory
    - _Requirements: 7.3_

  - [x] 8.2 Implement Reminder Scheduler in `echomate/companion/reminders.py`
    - Implement create_reminder(text, trigger_time)
    - Implement check_due_reminders() returning reminders within 60 seconds of trigger time
    - Implement queue_missed_reminder() for reminders when no session active
    - Deliver queued reminders within 60 seconds of next session start
    - _Requirements: 7.4, 7.5_

  - [x] 8.3 Implement Habit Tracker in `echomate/companion/habits.py`
    - Implement record_habit(habit_name) storing name + timestamp in long-term memory
    - Implement get_trends(days=7) returning completion history per habit
    - _Requirements: 7.7_

  - [x] 8.4 Implement Morning Briefing in `echomate/companion/briefing.py`
    - Implement generate() gathering: pending tasks (24h), calendar events (MCP), weather (MCP), upcoming reminders (12h)
    - Handle unavailable MCP tools gracefully (deliver partial briefing, indicate missing sources)
    - _Requirements: 7.1, 7.2_

  - [x] 8.5 Implement Evening Reflection in `echomate/companion/reflection.py`
    - Implement generate() summarizing: completed tasks since morning, conversations with stored tasks/habits
    - Suggest up to 3 improvements based on 7-day habit trends
    - _Requirements: 7.6_

  - [x]* 8.6 Write unit tests for Companion Features
    - Test task CRUD operations and due date filtering
    - Test reminder scheduling and missed reminder queuing
    - Test habit recording and trend calculation
    - Test briefing generation with partial MCP availability
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Core Orchestrator and Voice Pipeline
  - [x] 10.1 Implement the main EchoMate Agent in `agent.py`
    - Implement EchoMateAgent class using LiveKit VoicePipelineAgent
    - Wire up Silero VAD, Deepgram ASR, Cartesia TTS, and LLM via model router
    - Implement on_room_connected() initializing all components
    - Implement on_user_speech() pipeline: build prompt (with memory + personality + tools) → route to LLM → stream to TTS
    - Implement on_session_end() for session summarization and persistence
    - Configure VAD with 30ms frame analysis and configurable silence threshold (default 600ms)
    - Implement filler audio playback when response takes > 1000ms
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5_

  - [x] 10.2 Implement barge-in handling
    - Detect speech onset lasting ≥ 200ms during TTS playback
    - On barge-in: stop TTS immediately, cancel LLM generation, reset pipeline state
    - Ensure atomic sequence: TTS stop → LLM cancel → pipeline reset before processing new utterance
    - Discard all unplayed TTS audio on barge-in
    - _Requirements: 2.2, 2.6_

  - [x] 10.3 Implement pipeline error handling and reconnection
    - On component failure: notify user, retry up to 3 times with 2s interval
    - Handle ASR/TTS timeout at 3 seconds
    - Handle initialization failure with specific component error reporting
    - Implement graceful degradation: memory unavailable → STM only; MCP servers down → remaining tools
    - No-speech handling: remain listening without forwarding empty transcripts after 30s silence
    - _Requirements: 1.6, 1.7, 1.8_

  - [x]* 10.4 Write property test for barge-in atomicity
    - **Property 4: Barge-in atomicity**
    - Verify when barge-in occurs, TTS stop + LLM cancel + pipeline reset happen as an atomic sequence before the new utterance is processed
    - **Validates: Requirements 2.2, 2.6**

  - [x]* 10.5 Write property test for no data loss on crash
    - **Property 1: No data loss on crash**
    - Verify long-term memories are persisted to Chroma on write and session summaries are stored at session end
    - **Validates: Requirements 5.1, 5.5**

  - [x]* 10.6 Write integration tests for voice pipeline
    - Test ASR → LLM → TTS streaming chain produces output with mocked audio
    - Test barge-in: simulate speech during TTS, verify pipeline reset
    - Test model fallback: mock primary failure, verify fallback attempted
    - _Requirements: 1.1, 1.2, 1.3, 2.2, 3.4_

- [x] 11. Implement Frontend Interface
  - [x] 11.1 Initialize React frontend with LiveKit SDK
    - Set up Vite + React + TypeScript project in frontend/
    - Install @livekit/components-react, livekit-client
    - Configure LiveKit connection in frontend/src/lib/livekit.ts
    - _Requirements: 9.1_

  - [x] 11.2 Implement VoiceAgent component with connection management
    - Create VoiceAgent.tsx handling microphone permissions and LiveKit room connection (10s timeout)
    - Display error messages for permission denial or connection failure with resolution instructions
    - Implement auto-reconnection with exponential backoff (1s start, double to max 30s, max 5 attempts)
    - Show persistent error notification when all reconnection attempts exhausted with manual reconnect action
    - _Requirements: 9.2, 9.3, 9.5, 9.6_

  - [x] 11.3 Implement status indicators and transcript display
    - Create StatusIndicator.tsx with visually distinct states: listening, thinking, speaking
    - Create Transcript.tsx rendering conversation with user/assistant message distinction
    - Update transcript within 1 second of speech recognition output
    - Create ConnectionStatus.tsx for connection state visualization
    - _Requirements: 9.4, 9.7_

  - [x]* 11.4 Write unit tests for frontend components
    - Test state transitions for status indicator
    - Test transcript rendering with user/assistant messages
    - Test connection error handling and reconnection logic
    - _Requirements: 9.4, 9.5, 9.7_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Skills Management and Scripts
  - [x] 13.1 Create setup and skills refresh scripts
    - Create scripts/setup.sh that clones livekit/agent-skills into .agents/skills/livekit-agent-skills/
    - Create scripts/refresh_skills.sh that pulls latest changes from all configured skill repos
    - Create .agents/skills/skills-manifest.json with name, URL, local_path, last_updated fields
    - Create Makefile with targets: setup, refresh-skills, dev, test
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x]* 13.2 Write tests for skills management scripts
    - Test setup script creates correct directory structure
    - Test refresh script pulls from manifest entries
    - Test new skill repo added to manifest is cloned correctly
    - _Requirements: 11.1, 11.4_

- [x] 14. Implement Configuration Immutability and Validation
  - [x] 14.1 Ensure configuration is loaded once at startup and immutable at runtime
    - Config loaded in AppConfig at startup, frozen with Pydantic model_config frozen=True
    - No hot-reload during active sessions
    - Provider changes applied only at next startup
    - _Requirements: 10.6, 10.7_

  - [x]* 14.2 Write property test for configuration immutability
    - **Property 6: Configuration immutability at runtime**
    - Verify config is loaded once at startup and changes require restart; no hot-reload during active session
    - **Validates: Requirements 10.6, 10.7**

- [x] 15. Create Documentation
  - [x] 15.1 Create comprehensive README.md
    - Write project overview and architecture diagram
    - Document system prerequisites (Python 3.11+, Node.js, system deps)
    - Write setup instructions with verification step (confirm startup)
    - Document free API key acquisition (NVIDIA NIM, OpenRouter, Deepgram, Cartesia)
    - Document Model Router fallback chain: endpoint list, selection criteria, adding new endpoints
    - Document MCP server configuration: where to add, parameters required, verification steps
    - Write deployment instructions (target environment, env vars, process management)
    - Document how to add new skills
    - _Requirements: 12.1, 12.3, 12.4, 12.6_

  - [x] 15.2 Add inline documentation and complete .env.example
    - Add Google-style docstrings to all public modules, classes, and functions
    - Ensure .env.example lists every env variable with description, required/optional status, and placeholder
    - _Requirements: 12.2, 12.5_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design specifies Python with LiveKit Agents; frontend uses TypeScript with React
- All free LLM models are accessed via LiteLLM for unified interface
- MCP servers are subprocess-based (stdio transport) for process isolation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "3.3"] },
    { "id": 4, "tasks": ["2.3", "2.4", "3.4", "3.5", "5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "6.1"] },
    { "id": 6, "tasks": ["5.5", "6.2", "7.1"] },
    { "id": 7, "tasks": ["6.3", "7.2", "7.3", "8.1", "8.2", "8.3"] },
    { "id": 8, "tasks": ["8.4", "8.5", "8.6"] },
    { "id": 9, "tasks": ["10.1", "11.1"] },
    { "id": 10, "tasks": ["10.2", "10.3", "11.2"] },
    { "id": 11, "tasks": ["10.4", "10.5", "10.6", "11.3"] },
    { "id": 12, "tasks": ["11.4", "13.1", "14.1"] },
    { "id": 13, "tasks": ["13.2", "14.2"] },
    { "id": 14, "tasks": ["15.1", "15.2"] }
  ]
}
```
