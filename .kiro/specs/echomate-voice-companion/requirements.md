# Requirements Document

## Introduction

EchoMate is a personalized, real-time voice-powered Daily Life Companion and Memory Assistant built on LiveKit Agents. Users interact hands-free via voice in a browser, mobile, or phone call to receive morning briefings, manage tasks, set reminders, recall personal memories, track habits, perform quick information lookups, and conduct evening reflections. The system maintains long-term personalized memory via RAG, supports natural interruptions and barge-in, targets low latency voice-to-voice responses, and uses exclusively free LLM endpoints. Tool integration is primarily handled through Model Context Protocol (MCP) for modularity and extensibility.

## Glossary

- **Voice_Pipeline**: The end-to-end streaming path from user speech input through ASR, LLM processing, and TTS output back to the user
- **ASR**: Automatic Speech Recognition service (Deepgram or AssemblyAI) that converts streaming audio to text
- **TTS**: Text-to-Speech service (Cartesia or ElevenLabs) that converts LLM text output to streaming audio
- **VAD**: Voice Activity Detection (Silero) that determines when a user is speaking or silent
- **Barge_In**: The ability for a user to interrupt the assistant while it is speaking, causing the assistant to stop and listen
- **LLM**: Large Language Model used for generating conversational responses (via NVIDIA NIM or OpenRouter free endpoints)
- **Model_Router**: A component that dynamically selects the optimal LLM (reasoning vs fast) based on query complexity, with automatic fallback on failure
- **LiteLLM**: A library providing a unified interface for calling multiple LLM providers with easy switching
- **MCP**: Model Context Protocol — an open standard for connecting AI models to external tools and data sources
- **MCP_Manager**: The component responsible for discovering, connecting to, and managing external MCP servers and their tools
- **MCP_Server**: An external service exposing tools via the Model Context Protocol (e.g., calendar, weather, web search)
- **RAG**: Retrieval-Augmented Generation — a technique combining vector search over stored memories with LLM generation
- **Memory_Store**: The persistent storage system (Chroma vector database) holding short-term context and long-term user memories
- **Short_Term_Memory**: Conversational context from the current session, stored temporarily for coherence
- **Long_Term_Memory**: Persistent user facts, preferences, and interaction summaries stored across sessions via RAG
- **LiveKit_Agent**: A Python-based real-time agent running on the LiveKit Agents framework that orchestrates the Voice_Pipeline
- **Personality_Profile**: A configurable set of traits, tone, and behavioral preferences that shape the assistant's responses
- **Observability_System**: The logging and metrics infrastructure tracking latency, model usage, MCP calls, and success rates
- **Turn_Taking**: The conversational mechanism determining when the user has finished speaking and the assistant should respond
- **NVIDIA_NIM**: NVIDIA's free inference endpoints at build.nvidia.com providing access to Nemotron-series models
- **OpenRouter_Free**: OpenRouter endpoints with the :free suffix providing zero-cost LLM inference
- **Skill_File**: A cloned reference file from GitHub repositories (e.g., livekit/agent-skills) stored locally to assist development

## Requirements

### Requirement 1: Streaming Voice Pipeline

**User Story:** As a user, I want to have a real-time voice conversation with EchoMate, so that I can interact hands-free with minimal perceived delay.

#### Acceptance Criteria

1. WHEN the user speaks into the microphone, THE Voice_Pipeline SHALL stream audio to the ASR service and begin transcription within 200ms of speech onset
2. WHEN the ASR service produces a partial transcript, THE Voice_Pipeline SHALL forward the transcript to the LLM for processing without waiting for utterance completion
3. WHEN the LLM generates response tokens, THE Voice_Pipeline SHALL stream tokens to the TTS service incrementally such that the first audio chunk begins playback within 500ms of the first token being generated
4. THE Voice_Pipeline SHALL achieve end-to-end voice-to-voice latency of less than 1000ms for the first audio chunk of a response when network round-trip latency is at or below 100ms and packet loss is 0%
5. WHEN the Voice_Pipeline is initialized, THE LiveKit_Agent SHALL connect ASR (Deepgram or AssemblyAI), LLM (via LiteLLM), and TTS (Cartesia or ElevenLabs) as streaming components within 5 seconds
6. IF any pipeline component (ASR, LLM, or TTS) becomes unavailable or fails to respond within 3 seconds during a conversation, THEN THE Voice_Pipeline SHALL notify the user with an audible or visual error indication and attempt to reconnect up to 3 times with a 2-second interval between attempts
7. IF the ASR service detects no speech for more than 30 seconds of continuous audio input, THEN THE Voice_Pipeline SHALL remain in a listening state without forwarding empty transcripts to the LLM
8. IF the Voice_Pipeline fails to establish a connection to any required component within 5 seconds during initialization, THEN THE Voice_Pipeline SHALL report an error indication specifying which component failed to connect

### Requirement 2: Natural Conversation and Turn-Taking

**User Story:** As a user, I want EchoMate to handle natural conversational flow including interruptions, so that speaking with it feels like talking to a real person.

#### Acceptance Criteria

1. THE VAD SHALL analyze incoming audio using Silero VAD to detect speech onset and offset within each 30ms audio frame
2. WHILE the TTS is playing audio, WHEN the VAD detects speech onset lasting at least 200ms, THE LiveKit_Agent SHALL stop TTS playback and begin processing the new user input (Barge_In) within 100ms of onset detection
3. WHEN the VAD detects end of speech, THE Turn_Taking system SHALL wait for a configurable silence threshold (range: 200ms to 2000ms, default 600ms) before triggering LLM response generation
4. IF the VAD detects speech resumption during the silence threshold wait period, THEN THE Turn_Taking system SHALL cancel the pending LLM trigger and continue listening for end of speech
5. WHILE the LLM is generating a response and no audio has been sent to the user within 1000ms of the LLM request, THE Voice_Pipeline SHALL play a filler sound of no more than 1500ms duration to signal processing to the user
6. WHEN Barge_In occurs, THE LiveKit_Agent SHALL discard all unplayed TTS audio, cancel any in-progress LLM generation, and reset the response pipeline to accept the new utterance

### Requirement 3: Free LLM Integration with Smart Model Router

**User Story:** As a developer, I want EchoMate to use only free LLM endpoints with intelligent routing, so that there are no inference costs while maintaining response quality.

#### Acceptance Criteria

1. THE Model_Router SHALL route all LLM requests exclusively through NVIDIA_NIM endpoints (Nemotron series) or OpenRouter_Free endpoints (models with :free suffix)
2. WHEN a user query contains multi-step instructions, comparative analysis, or requires synthesizing information from multiple topics, THE Model_Router SHALL classify the query as complex and select a reasoning-capable model from the available free endpoints
3. WHEN a user query is a single-turn interaction requiring no synthesis (greetings, confirmations, single-fact lookups, or queries containing fewer than 20 tokens), THE Model_Router SHALL classify the query as simple and select the free model with the lowest average historical response latency
4. IF the selected model endpoint returns an error or does not respond within 5 seconds, THEN THE Model_Router SHALL automatically retry with the next available free model in the fallback chain, attempting a maximum of 3 fallback models in descending priority order
5. IF all models in the fallback chain have been attempted and none return a successful response, THEN THE Model_Router SHALL return an error indication to the caller stating that no free model is currently available and preserve the original user query for retry
6. THE Model_Router SHALL use LiteLLM as the unified interface for calling all LLM providers
7. THE Observability_System SHALL log for each LLM call: the model selected, the query complexity classification, the routing reason, response latency in milliseconds, token count, and success or failure status

### Requirement 4: MCP Tool Integration

**User Story:** As a user, I want EchoMate to access external tools like calendar, weather, and web search via voice, so that I can get real-world information and manage my life hands-free.

#### Acceptance Criteria

1. THE MCP_Manager SHALL connect to one or more configured MCP_Servers at startup, with a connection timeout of 15 seconds per server, and discover available tools via the MCP protocol's tool listing capability
2. WHEN the LLM determines a user request requires an external tool, THE MCP_Manager SHALL invoke the matching MCP tool by name and return the tool's result to the LLM for response generation
3. WHEN a new MCP_Server is added to the configuration, THE MCP_Manager SHALL discover and register its tools without requiring code changes to the core agent
4. IF an MCP tool call fails or times out after 10 seconds, THEN THE MCP_Manager SHALL return an error description to the LLM indicating the tool name and failure reason, so the LLM can inform the user and suggest an alternative if available
5. THE MCP_Manager SHALL support standard MCP tool categories including calendar access, task management, weather lookup, and web search
6. WHEN no MCP_Server provides a requested tool, THE LiveKit_Agent SHALL fall back to standard function calling for built-in tools (timers, basic math, date/time)
7. THE Observability_System SHALL log for each MCP call: the server name, tool name, call latency, and success or failure status
8. IF an MCP_Server fails to connect at startup or becomes unreachable during an active session, THEN THE MCP_Manager SHALL mark that server as unavailable, continue operating with remaining connected servers, and attempt reconnection on the next tool request targeting that server
9. IF multiple MCP_Servers expose a tool with the same name, THEN THE MCP_Manager SHALL invoke the tool from the server listed first in the configuration order
10. IF a user request does not match any available MCP tool or built-in function, THEN THE LLM SHALL respond to the user indicating that the requested capability is not currently available

### Requirement 5: Memory System with RAG

**User Story:** As a user, I want EchoMate to remember things about me across conversations, so that it feels personalized and I do not have to repeat myself.

#### Acceptance Criteria

1. THE Memory_Store SHALL persist Long_Term_Memory entries in a Chroma vector database that survives application restarts
2. WHEN the user states a personal fact, preference, or named event, THE LiveKit_Agent SHALL extract and store it in Long_Term_Memory with a timestamped embedding within 3 seconds of the user's utterance completing
3. WHEN the user asks a question or makes a request, THE Memory_Store SHALL perform a semantic search over Long_Term_Memory, retrieve the top 5 entries that meet a configurable minimum similarity score (default 0.7), and provide them as context to the LLM
4. THE Short_Term_Memory SHALL maintain the current conversation history (up to a configurable token limit, default 4000 tokens) for session coherence
5. WHEN a conversation session ends, THE LiveKit_Agent SHALL generate a summary of the session (maximum 500 tokens) capturing user-stated facts, preferences, and decisions, and store it in Long_Term_Memory
6. WHEN the user explicitly requests to forget specific information, THE Memory_Store SHALL perform a semantic search to identify matching entries, remove them from Long_Term_Memory, and confirm to the user what information was removed
7. THE Memory_Store SHALL use LlamaIndex or LangChain for orchestrating RAG retrieval and Chroma for vector storage
8. IF the semantic search returns no entries meeting the minimum similarity score, THEN THE Memory_Store SHALL proceed without injecting Long_Term_Memory context, relying on Short_Term_Memory and the LLM's base prompt only
9. IF the Chroma vector database is unavailable, THEN THE Memory_Store SHALL continue the conversation using Short_Term_Memory only and inform the user that personalized memory is temporarily unavailable

### Requirement 6: Personality and Preferences

**User Story:** As a user, I want EchoMate to have a consistent, configurable personality that adapts to my preferences, so that interactions feel natural and tailored to me.

#### Acceptance Criteria

1. THE LiveKit_Agent SHALL load a Personality_Profile from configuration that defines tone (friendly, professional, or casual), verbosity level (brief, moderate, or detailed), and behavioral traits (humor usage enabled/disabled, formality of address, and proactiveness in offering suggestions)
2. WHEN generating a response, THE LLM SHALL incorporate the active Personality_Profile into its system prompt so that responses conform to the tone and verbosity level specified in the profile
3. WHEN the user expresses a preference for interaction style (e.g., "be more concise", "use a friendlier tone"), THE LiveKit_Agent SHALL update the Personality_Profile in Long_Term_Memory, apply the change starting from the next generated response in the same session, and confirm the change to the user verbally
4. THE Personality_Profile SHALL support configurable greeting behaviors for morning briefings and evening reflections, including whether to include a personalized salutation, a summary of upcoming events, and a motivational or reflective prompt
5. WHILE the Personality_Profile specifies a verbosity level of "brief", THE LLM SHALL limit responses to 2 sentences or fewer; WHILE the verbosity level is "moderate", THE LLM SHALL limit responses to 3 to 5 sentences; WHILE the verbosity level is "detailed", THE LLM SHALL provide 6 or more sentences when the topic warrants it
6. IF the Personality_Profile configuration is missing or fails validation at startup, THEN THE LiveKit_Agent SHALL log a warning and apply a default Personality_Profile with tone set to friendly, verbosity set to moderate, and all behavioral traits set to their default values

### Requirement 7: Daily Life Companion Features

**User Story:** As a user, I want EchoMate to help me with daily routines including morning briefings, task management, reminders, and evening reflections, so that I stay organized and productive.

#### Acceptance Criteria

1. WHEN the user starts a morning session, THE LiveKit_Agent SHALL provide a morning briefing including pending tasks due within the next 24 hours, calendar events for the current day (via MCP), current weather conditions (via MCP), and reminders with trigger times within the next 12 hours
2. IF one or more MCP tools (calendar, weather) are unavailable during a morning briefing request, THEN THE LiveKit_Agent SHALL deliver the briefing with the available data and indicate which sources could not be reached
3. WHEN the user creates a task or reminder via voice, THE LiveKit_Agent SHALL store it with a title (maximum 200 characters), an optional due date or trigger condition, and confirm the creation by echoing back the task title, due date, and trigger condition to the user
4. WHEN a reminder's trigger time arrives and an active session exists, THE LiveKit_Agent SHALL notify the user by spoken announcement within 60 seconds of the trigger time
5. IF a reminder's trigger time arrives and no active session exists, THEN THE LiveKit_Agent SHALL queue the reminder and deliver it within 60 seconds of the user's next session start
6. WHEN the user requests an evening reflection, THE LiveKit_Agent SHALL summarize tasks completed since the most recent morning session, conversations that resulted in stored tasks or habit entries, and suggest up to 3 improvements based on habit completion trends from the past 7 days
7. WHEN the user reports a habit completion (e.g., "I exercised today"), THE LiveKit_Agent SHALL record the habit name and completion timestamp in Long_Term_Memory and confirm the recording to the user
8. WHEN the user asks for quick information (facts, definitions, calculations), THE LiveKit_Agent SHALL use available MCP tools or built-in functions to provide an answer within a single conversational turn and within 10 seconds of the request

### Requirement 8: Observability and Latency Monitoring

**User Story:** As a developer, I want comprehensive observability into EchoMate's performance, so that I can identify bottlenecks, track model quality, and optimize latency.

#### Acceptance Criteria

1. THE Observability_System SHALL log structured metrics for every pipeline execution (completed or failed) including: a unique request correlation ID, ASR latency in milliseconds, LLM time-to-first-token in milliseconds, TTS time-to-first-audio in milliseconds, total voice-to-voice latency in milliseconds, and a UTC timestamp
2. THE Observability_System SHALL track per-model performance statistics computed over a rolling 5-minute window including: average latency in milliseconds, error rate as a percentage of total requests, and tokens-per-second for each LLM endpoint
3. THE Observability_System SHALL track per-MCP-server statistics computed over a rolling 5-minute window including: average call latency in milliseconds, error rate as a percentage of total calls, and tool invocation count per tool name
4. WHEN any pipeline component exceeds its latency budget (ASR > 300ms, LLM first token > 500ms, TTS first audio > 200ms), THE Observability_System SHALL emit a warning-level log entry containing the request correlation ID, the component name, the measured latency value, and the exceeded threshold value
5. THE Observability_System SHALL expose metrics in structured JSON log format or Prometheus-compatible format, where each metric entry includes at minimum: metric name, numeric value, unit, timestamp, and associated labels (request ID, model name, or MCP server name as applicable)
6. THE Observability_System SHALL use Python's standard logging module with structured JSON formatters and support configurable log levels of DEBUG, INFO, WARNING, and ERROR
7. IF a pipeline execution fails at any stage, THEN THE Observability_System SHALL log the failure with the request correlation ID, the failed component name, and an error category indicator within 100ms of failure detection

### Requirement 9: Frontend Interface

**User Story:** As a user, I want to access EchoMate through a web browser or mobile device, so that I can use it from any device with a microphone and speaker.

#### Acceptance Criteria

1. THE Frontend SHALL be built using the LiveKit React starter template and connect to the LiveKit_Agent via LiveKit's client SDK
2. WHEN the user opens the application, THE Frontend SHALL request microphone permissions and attempt to establish a real-time audio connection to the LiveKit_Agent within 10 seconds
3. IF the user denies microphone permission or the audio connection cannot be established within 10 seconds, THEN THE Frontend SHALL display an error message indicating the failure reason and provide instructions for resolution
4. THE Frontend SHALL display a visual indicator that is visually distinct for each of the three assistant states: listening, thinking, and speaking
5. WHEN the connection to the LiveKit_Agent is lost, THE Frontend SHALL display a notification indicating connection loss and attempt automatic reconnection with exponential backoff starting at 1 second, doubling up to a maximum delay of 30 seconds, for a maximum of 5 attempts
6. IF all reconnection attempts are exhausted without success, THEN THE Frontend SHALL display a persistent error notification indicating the connection could not be restored and provide a manual reconnect action
7. THE Frontend SHALL render a text transcript of the conversation that distinguishes between user and assistant messages and updates within 1 second of speech recognition output

### Requirement 10: Configuration and Extensibility

**User Story:** As a developer, I want EchoMate to be modular and easily configurable, so that I can add new capabilities, swap providers, and adjust behavior without major refactoring.

#### Acceptance Criteria

1. THE LiveKit_Agent SHALL load all configuration from environment variables and a .env file, with a .env.example documenting all required and optional variables
2. THE LiveKit_Agent codebase SHALL be organized into distinct modules: model_router.py, mcp_manager.py, tools/, memory/, prompts/, and config/
3. WHEN a new MCP_Server is added to the configuration file, THE MCP_Manager SHALL register and make available that server's tools at next startup without code modifications, and SHALL log a confirmation message indicating the server name and number of tools loaded
4. THE LiveKit_Agent SHALL use Pydantic models for all configuration validation and settings management
5. THE LiveKit_Agent SHALL use Python 3.11 or higher and manage dependencies with a requirements.txt or pyproject.toml
6. IF a configuration value fails Pydantic validation at startup, THEN THE LiveKit_Agent SHALL refuse to start and SHALL output an error message indicating the invalid field name and the reason for rejection
7. WHEN the LLM provider is changed in the configuration file, THE LiveKit_Agent SHALL route requests to the newly configured provider at next startup without code modifications to any module other than the configuration file
8. IF a configured MCP_Server fails to connect during startup, THEN THE MCP_Manager SHALL log a warning indicating the server name and continue startup with the remaining servers

### Requirement 11: Skills and Development Assistance

**User Story:** As a developer, I want relevant AI coding skill files cloned and accessible locally, so that development tooling can leverage LiveKit and MCP-specific knowledge.

#### Acceptance Criteria

1. WHEN the project is initialized via the setup script, THE build system SHALL clone the livekit/agent-skills repository into the .agents/skills/livekit-agent-skills/ directory
2. THE project SHALL include a script (scripts/refresh_skills.sh or Makefile target "refresh-skills") that pulls the latest changes from all configured skill repositories
3. THE project structure SHALL store skill files in .agents/skills/ with a skills-manifest.json listing each skill repository's name, URL, local path, and last-updated timestamp
4. WHEN a new skill repository URL is added to skills-manifest.json, THE refresh script SHALL clone it into .agents/skills/{repo-name}/ without manual file placement

### Requirement 12: Documentation

**User Story:** As a developer or contributor, I want comprehensive documentation, so that I can set up, configure, extend, and deploy EchoMate without guesswork.

#### Acceptance Criteria

1. THE project SHALL include a README.md covering: project overview, architecture diagram (visual or text-based showing Voice_Pipeline components and their connections), system prerequisites (Python version, OS requirements, system dependencies), setup instructions with a verification step confirming successful startup, free API key acquisition steps listing each provider URL (NVIDIA NIM, OpenRouter, Deepgram/AssemblyAI, Cartesia/ElevenLabs), how to run MCP servers, how to add new MCP tools, how to add new skills, and deployment instructions specifying at minimum the target environment, environment variable configuration, and process management
2. THE project SHALL include a .env.example file listing every environment variable referenced in the codebase, each annotated with a one-line description of its purpose, whether it is required or optional, and a placeholder example value
3. THE README.md SHALL document the Model_Router's fallback chain including the ordered list of free LLM endpoints, the selection criteria for reasoning vs fast models, and step-by-step instructions for adding a new free LLM endpoint
4. THE README.md SHALL document how to configure and connect new MCP_Servers with step-by-step instructions including: where to add the server configuration, what connection parameters are required, and how to verify the server's tools are discovered
5. THE project SHALL include inline code documentation (docstrings) following Google style for all public modules, classes, and functions, including at minimum a summary line, parameter descriptions, and return value descriptions
6. WHEN a developer follows the README.md setup instructions on a clean environment with the listed prerequisites installed, THE documented steps SHALL be sufficient to reach a running EchoMate instance that responds to a voice input without requiring external guidance
