"""Data models for EchoMate Voice Companion.

Defines all core data entities used across the application including
memory entries, tasks, reminders, pipeline metrics, MCP tool representations,
and companion state models.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class QueryComplexity(str, Enum):
    """Classification of query complexity for model routing.

    Used by the Model Router to select the appropriate LLM tier:
    - SIMPLE: fast-tier models (greetings, confirmations, < 20 tokens)
    - MODERATE: standard queries, single-topic
    - COMPLEX: reasoning-tier models (multi-step, analysis, synthesis)
    - CREATIVE: creative writing, emotional support
    - TECHNICAL: code, technical explanations
    """

    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    CREATIVE = "creative"
    TECHNICAL = "technical"


class ModelEndpoint(BaseModel):
    """Configuration for a single LLM endpoint in the model registry.

    Attributes:
        name: Human-readable endpoint name (e.g., "nvidia_nim/nemotron-4-340b").
        provider: The LLM provider serving this endpoint.
        model_id: LiteLLM model identifier for API calls.
        tier: Whether the model is optimized for speed or reasoning.
        priority: Routing priority (lower value = higher priority).
        avg_latency_ms: Rolling average latency in milliseconds.
        error_rate: Rolling error rate (0.0 to 1.0).
        tokens_per_second: Rolling throughput measurement.
    """

    name: str
    provider: Literal["nvidia_nim", "openrouter_free"]
    model_id: str
    tier: Literal["fast", "reasoning", "creative", "technical", "voice"]
    priority: int
    avg_latency_ms: float = 0.0
    error_rate: float = 0.0
    tokens_per_second: float = 0.0


class MemoryEntry(BaseModel):
    """A single entry in long-term memory.

    Attributes:
        id: Unique identifier (UUID string).
        text: The fact, summary, or content stored.
        category: Classification of the memory entry type.
        timestamp: When the entry was created or last updated.
        metadata: Additional context (source session, tags, etc.).
        similarity_score: Populated on retrieval with search relevance score.
    """

    id: str
    text: str
    category: Literal["fact", "preference", "event", "habit", "session_summary", "task"]
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)
    similarity_score: float = 0.0


class MemoryContext(BaseModel):
    """Combined memory context for prompt augmentation.

    Provides both short-term conversation history and relevant long-term
    memory entries retrieved via RAG for building LLM prompts.

    Attributes:
        short_term_messages: Recent conversation messages in OpenAI format.
        long_term_entries: Relevant RAG results from vector search.
        has_long_term: Whether long-term memory (Chroma) is available.
    """

    short_term_messages: list[dict[str, Any]] = Field(default_factory=list)
    long_term_entries: list[MemoryEntry] = Field(default_factory=list)
    has_long_term: bool = True


class Task(BaseModel):
    """A user-created task stored in long-term memory.

    Attributes:
        id: Unique identifier (UUID string).
        title: Task description (maximum 200 characters).
        due_date: Optional deadline for the task.
        completed: Whether the task has been marked as done.
        completed_at: Timestamp when the task was completed.
        created_at: Timestamp when the task was created.
    """

    id: str
    title: str = Field(max_length=200)
    due_date: datetime | None = None
    completed: bool = False
    completed_at: datetime | None = None
    created_at: datetime


class Reminder(BaseModel):
    """A scheduled reminder for user notification.

    Attributes:
        id: Unique identifier (UUID string).
        text: The reminder message content.
        trigger_time: When the reminder should be delivered.
        delivered: Whether the reminder has been announced to the user.
        queued: Whether the reminder is queued for next session start.
    """

    id: str
    text: str
    trigger_time: datetime
    delivered: bool = False
    queued: bool = False


class HabitEntry(BaseModel):
    """A single habit completion record.

    Attributes:
        habit_name: Name of the habit that was completed.
        completed_at: Timestamp when the habit was recorded.
    """

    habit_name: str
    completed_at: datetime


class PipelineMetrics(BaseModel):
    """Metrics for a single voice pipeline execution.

    Captures latency and status information for each stage of the
    voice-to-voice pipeline for observability and optimization.

    Attributes:
        request_id: Unique correlation ID for tracing.
        timestamp: When the request was initiated (UTC).
        asr_latency_ms: Time for ASR processing in milliseconds.
        llm_model: Which LLM model was used for this request.
        llm_ttft_ms: LLM time-to-first-token in milliseconds.
        llm_tokens: Total tokens generated by the LLM.
        tts_latency_ms: TTS time-to-first-audio in milliseconds.
        total_v2v_ms: Total voice-to-voice latency in milliseconds.
        success: Whether the pipeline completed successfully.
        error_component: Which component failed (if any).
        error_category: Classification of the error (if any).
    """

    request_id: str
    timestamp: datetime
    asr_latency_ms: float | None = None
    llm_model: str | None = None
    llm_ttft_ms: float | None = None
    llm_tokens: int | None = None
    tts_latency_ms: float | None = None
    total_v2v_ms: float | None = None
    success: bool = True
    error_component: str | None = None
    error_category: str | None = None


class ModelStats(BaseModel):
    """Rolling performance statistics for a single LLM model.

    Computed over a configurable time window (default 5 minutes) for
    use in model routing decisions.

    Attributes:
        model_id: The LiteLLM model identifier.
        avg_latency_ms: Average response latency in milliseconds.
        error_rate: Error rate as a fraction (0.0 to 1.0).
        tokens_per_second: Average throughput.
        total_requests: Total number of requests in the window.
        window_start: Start of the rolling statistics window.
    """

    model_id: str
    avg_latency_ms: float
    error_rate: float
    tokens_per_second: float
    total_requests: int
    window_start: datetime


class MCPServerStats(BaseModel):
    """Rolling performance statistics for a single MCP server.

    Computed over a configurable time window (default 5 minutes) for
    monitoring MCP server health and tool usage patterns.

    Attributes:
        server_name: Name of the MCP server.
        avg_latency_ms: Average call latency in milliseconds.
        error_rate: Error rate as a fraction (0.0 to 1.0).
        tool_usage: Mapping of tool name to invocation count.
        window_start: Start of the rolling statistics window.
    """

    server_name: str
    avg_latency_ms: float
    error_rate: float
    tool_usage: dict[str, int] = Field(default_factory=dict)
    window_start: datetime


class MCPTool(BaseModel):
    """Representation of a discovered MCP tool.

    Attributes:
        name: The tool's registered name.
        description: Human-readable description of tool functionality.
        input_schema: JSON Schema defining the tool's parameters.
        server_name: Which MCP server provides this tool.
    """

    name: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)
    server_name: str


class MCPToolResult(BaseModel):
    """Result from an MCP tool invocation.

    Attributes:
        success: Whether the tool call completed successfully.
        data: The tool's return data (if successful).
        error: Error message (if the call failed).
        latency_ms: Time taken for the tool call in milliseconds.
    """

    success: bool
    data: Any | None = None
    error: str | None = None
    latency_ms: float


class ToolResult(BaseModel):
    """Unified tool result for both MCP and built-in tools.

    Attributes:
        tool_name: Name of the tool that was invoked.
        source: Whether the tool came from MCP or built-in registry.
        success: Whether the tool call completed successfully.
        data: The tool's return data (if successful).
        error: Error message (if the call failed).
    """

    tool_name: str
    source: Literal["mcp", "builtin"]
    success: bool
    data: Any | None = None
    error: str | None = None


class CompanionState(BaseModel):
    """Current state of companion features for prompt context.

    Provides contextual information about active companion features
    to the prompt builder for relevant LLM responses.

    Attributes:
        is_morning_session: Whether the current session is a morning briefing.
        is_evening_session: Whether the current session is an evening reflection.
        pending_reminders: Reminders queued for delivery.
        pending_tasks_count: Number of incomplete tasks.
    """

    is_morning_session: bool = False
    is_evening_session: bool = False
    pending_reminders: list[Reminder] = Field(default_factory=list)
    pending_tasks_count: int = 0
