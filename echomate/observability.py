"""Observability module for EchoMate Voice Companion.

Provides structured logging and metrics collection for monitoring
pipeline performance, model routing decisions, and MCP tool calls.

Uses Python's standard logging module with JSON formatters and
collects rolling statistics over configurable time windows.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

from echomate.models import MCPServerStats, ModelStats, PipelineMetrics


class _JSONFormatter(logging.Formatter):
    """JSON log formatter for structured logging output."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
            "logger": record.name,
        }
        # Merge extra fields attached to the record
        if hasattr(record, "_extra"):
            log_entry.update(record._extra)
        return json.dumps(log_entry, default=str)


class StructuredLogger:
    """JSON-formatted logger wrapping Python's standard logging module.

    Provides structured log output with configurable levels. Each log
    entry includes a UTC timestamp, level, event name, and any additional
    keyword arguments as structured fields.

    Args:
        name: Logger name (used for Python logging hierarchy).
        level: Logging level string (DEBUG, INFO, WARNING, ERROR).

    Example:
        >>> logger = StructuredLogger("echomate.pipeline", level="INFO")
        >>> logger.info("request_started", request_id="abc-123")
    """

    def __init__(self, name: str = "echomate", level: str = "INFO") -> None:
        self._logger = logging.getLogger(name)
        self._logger.setLevel(getattr(logging, level.upper(), logging.INFO))
        self._logger.propagate = False

        # Only add handler if none exist to avoid duplicate output
        if not self._logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(_JSONFormatter())
            handler.setLevel(getattr(logging, level.upper(), logging.INFO))
            self._logger.addHandler(handler)

    def _log(self, level: int, event: str, **kwargs) -> None:
        """Internal log method that attaches extra fields to the record."""
        record = self._logger.makeRecord(
            name=self._logger.name,
            level=level,
            fn="",
            lno=0,
            msg=event,
            args=(),
            exc_info=None,
        )
        record._extra = kwargs  # type: ignore[attr-defined]
        self._logger.handle(record)

    def info(self, event: str, **kwargs) -> None:
        """Log an informational event.

        Args:
            event: Short description of what happened.
            **kwargs: Additional structured fields to include in the log.
        """
        self._log(logging.INFO, event, **kwargs)

    def warning(self, event: str, **kwargs) -> None:
        """Log a warning event.

        Args:
            event: Short description of the warning condition.
            **kwargs: Additional structured fields to include in the log.
        """
        self._log(logging.WARNING, event, **kwargs)

    def error(self, event: str, **kwargs) -> None:
        """Log an error event.

        Args:
            event: Short description of the error.
            **kwargs: Additional structured fields to include in the log.
        """
        self._log(logging.ERROR, event, **kwargs)

    def debug(self, event: str, **kwargs) -> None:
        """Log a debug event.

        Args:
            event: Short description for debugging.
            **kwargs: Additional structured fields to include in the log.
        """
        self._log(logging.DEBUG, event, **kwargs)


@dataclass
class _RequestState:
    """Internal state tracking for an in-flight request."""

    request_id: str
    start_time: float
    asr_latency_ms: float | None = None
    llm_model: str | None = None
    llm_ttft_ms: float | None = None
    llm_tokens: int | None = None
    tts_latency_ms: float | None = None
    mcp_calls: list[dict] = field(default_factory=list)


@dataclass
class _LLMCallRecord:
    """Record of a single LLM call for rolling statistics."""

    model: str
    timestamp: float
    latency_ms: float
    tokens: int
    success: bool


@dataclass
class _MCPCallRecord:
    """Record of a single MCP call for rolling statistics."""

    server: str
    tool: str
    timestamp: float
    latency_ms: float
    success: bool


class MetricsCollector:
    """Collects and exposes pipeline and component metrics.

    Tracks per-request pipeline metrics including ASR, LLM, and TTS
    latencies. Provides rolling statistics over configurable time windows
    for model performance and MCP server health monitoring.

    Latency budgets:
        - ASR: 300ms
        - LLM TTFT: 500ms
        - TTS: 200ms

    Example:
        >>> collector = MetricsCollector()
        >>> req_id = collector.start_request()
        >>> collector.record_asr_latency(req_id, 150.0)
        >>> collector.record_llm_metrics(req_id, "nvidia/nemotron", 320.0, 45)
        >>> collector.record_tts_latency(req_id, 180.0)
        >>> metrics = collector.complete_request(req_id)
    """

    # Latency budget thresholds in milliseconds
    ASR_BUDGET_MS: float = 300.0
    LLM_TTFT_BUDGET_MS: float = 500.0
    TTS_BUDGET_MS: float = 200.0

    def __init__(self, logger: StructuredLogger | None = None) -> None:
        self._logger = logger or StructuredLogger("echomate.metrics")
        self._active_requests: dict[str, _RequestState] = {}
        self._completed_metrics: list[PipelineMetrics] = []
        self._llm_records: list[_LLMCallRecord] = []
        self._mcp_records: list[_MCPCallRecord] = []

    def start_request(self) -> str:
        """Generate a correlation ID and start timing for a new request.

        Returns:
            A unique UUID4 correlation ID for the request.
        """
        request_id = str(uuid.uuid4())
        self._active_requests[request_id] = _RequestState(
            request_id=request_id,
            start_time=time.monotonic(),
        )
        self._logger.info(
            "request_started",
            request_id=request_id,
        )
        return request_id

    def record_asr_latency(self, request_id: str, latency_ms: float) -> None:
        """Record the ASR processing latency for a request.

        Args:
            request_id: The correlation ID from start_request().
            latency_ms: ASR latency in milliseconds.
        """
        state = self._active_requests.get(request_id)
        if state is None:
            self._logger.warning(
                "record_asr_unknown_request",
                request_id=request_id,
            )
            return
        state.asr_latency_ms = latency_ms

    def record_llm_metrics(
        self, request_id: str, model: str, ttft_ms: float, tokens: int
    ) -> None:
        """Record LLM metrics for a request.

        Args:
            request_id: The correlation ID from start_request().
            model: The LLM model identifier used.
            ttft_ms: Time-to-first-token in milliseconds.
            tokens: Total tokens generated.
        """
        state = self._active_requests.get(request_id)
        if state is None:
            self._logger.warning(
                "record_llm_unknown_request",
                request_id=request_id,
            )
            return
        state.llm_model = model
        state.llm_ttft_ms = ttft_ms
        state.llm_tokens = tokens

        # Store for rolling stats
        self._llm_records.append(
            _LLMCallRecord(
                model=model,
                timestamp=time.time(),
                latency_ms=ttft_ms,
                tokens=tokens,
                success=True,
            )
        )

    def record_tts_latency(self, request_id: str, latency_ms: float) -> None:
        """Record the TTS processing latency for a request.

        Args:
            request_id: The correlation ID from start_request().
            latency_ms: TTS time-to-first-audio in milliseconds.
        """
        state = self._active_requests.get(request_id)
        if state is None:
            self._logger.warning(
                "record_tts_unknown_request",
                request_id=request_id,
            )
            return
        state.tts_latency_ms = latency_ms

    def record_mcp_call(
        self,
        request_id: str,
        server: str,
        tool: str,
        latency_ms: float,
        success: bool,
    ) -> None:
        """Record an MCP tool call for a request.

        Args:
            request_id: The correlation ID from start_request().
            server: The MCP server name.
            tool: The tool name invoked.
            latency_ms: Call latency in milliseconds.
            success: Whether the call succeeded.
        """
        state = self._active_requests.get(request_id)
        if state is None:
            self._logger.warning(
                "record_mcp_unknown_request",
                request_id=request_id,
            )
            return
        state.mcp_calls.append(
            {"server": server, "tool": tool, "latency_ms": latency_ms, "success": success}
        )

        # Store for rolling stats
        self._mcp_records.append(
            _MCPCallRecord(
                server=server,
                tool=tool,
                timestamp=time.time(),
                latency_ms=latency_ms,
                success=success,
            )
        )

        self._logger.info(
            "mcp_call_recorded",
            request_id=request_id,
            server=server,
            tool=tool,
            latency_ms=latency_ms,
            success=success,
        )

    def complete_request(
        self, request_id: str, success: bool = True, error_component: str | None = None, error_category: str | None = None
    ) -> PipelineMetrics:
        """Complete a request and produce final PipelineMetrics.

        This method ALWAYS produces a metrics entry regardless of
        whether the request succeeded or failed, ensuring metric
        completeness (Property 7).

        Args:
            request_id: The correlation ID from start_request().
            success: Whether the pipeline completed successfully.
            error_component: Which component failed (if any).
            error_category: Classification of the error (if any).

        Returns:
            A PipelineMetrics instance with all recorded data.

        Raises:
            KeyError: If request_id is not found in active requests.
        """
        state = self._active_requests.pop(request_id, None)
        if state is None:
            # Even for unknown requests, produce a metrics entry
            metrics = PipelineMetrics(
                request_id=request_id,
                timestamp=datetime.now(tz=timezone.utc),
                success=False,
                error_component="metrics_collector",
                error_category="unknown_request",
            )
            self._completed_metrics.append(metrics)
            self._logger.error(
                "complete_request_unknown",
                request_id=request_id,
            )
            return metrics

        elapsed_ms = (time.monotonic() - state.start_time) * 1000.0

        metrics = PipelineMetrics(
            request_id=request_id,
            timestamp=datetime.now(tz=timezone.utc),
            asr_latency_ms=state.asr_latency_ms,
            llm_model=state.llm_model,
            llm_ttft_ms=state.llm_ttft_ms,
            llm_tokens=state.llm_tokens,
            tts_latency_ms=state.tts_latency_ms,
            total_v2v_ms=elapsed_ms,
            success=success,
            error_component=error_component,
            error_category=error_category,
        )

        self._completed_metrics.append(metrics)

        # Check latency budgets and emit warnings
        violations = self.check_latency_budgets(metrics)

        self._logger.info(
            "request_completed",
            request_id=request_id,
            success=success,
            total_v2v_ms=round(elapsed_ms, 2),
            asr_latency_ms=state.asr_latency_ms,
            llm_ttft_ms=state.llm_ttft_ms,
            tts_latency_ms=state.tts_latency_ms,
            budget_violations=len(violations),
        )

        # If the LLM call resulted in failure, record it in rolling stats
        if not success and state.llm_model:
            self._llm_records.append(
                _LLMCallRecord(
                    model=state.llm_model,
                    timestamp=time.time(),
                    latency_ms=state.llm_ttft_ms or 0.0,
                    tokens=state.llm_tokens or 0,
                    success=False,
                )
            )

        return metrics

    def get_model_stats(self, window_seconds: int = 300) -> dict[str, ModelStats]:
        """Compute rolling performance statistics per LLM model.

        Args:
            window_seconds: Time window in seconds (default 300 = 5 minutes).

        Returns:
            A dict mapping model_id to ModelStats for models with activity
            within the window.
        """
        cutoff = time.time() - window_seconds
        window_start = datetime.fromtimestamp(cutoff, tz=timezone.utc)

        # Group records by model within the window
        by_model: dict[str, list[_LLMCallRecord]] = defaultdict(list)
        for record in self._llm_records:
            if record.timestamp >= cutoff:
                by_model[record.model].append(record)

        stats: dict[str, ModelStats] = {}
        for model_id, records in by_model.items():
            total = len(records)
            errors = sum(1 for r in records if not r.success)
            total_latency = sum(r.latency_ms for r in records)
            total_tokens = sum(r.tokens for r in records)
            total_time_seconds = sum(r.latency_ms for r in records if r.success) / 1000.0

            avg_latency = total_latency / total if total > 0 else 0.0
            error_rate = errors / total if total > 0 else 0.0
            tokens_per_second = (
                total_tokens / total_time_seconds if total_time_seconds > 0 else 0.0
            )

            stats[model_id] = ModelStats(
                model_id=model_id,
                avg_latency_ms=round(avg_latency, 2),
                error_rate=round(error_rate, 4),
                tokens_per_second=round(tokens_per_second, 2),
                total_requests=total,
                window_start=window_start,
            )

        return stats

    def get_mcp_stats(self, window_seconds: int = 300) -> dict[str, MCPServerStats]:
        """Compute rolling performance statistics per MCP server.

        Args:
            window_seconds: Time window in seconds (default 300 = 5 minutes).

        Returns:
            A dict mapping server_name to MCPServerStats for servers with
            activity within the window.
        """
        cutoff = time.time() - window_seconds
        window_start = datetime.fromtimestamp(cutoff, tz=timezone.utc)

        # Group records by server within the window
        by_server: dict[str, list[_MCPCallRecord]] = defaultdict(list)
        for record in self._mcp_records:
            if record.timestamp >= cutoff:
                by_server[record.server].append(record)

        stats: dict[str, MCPServerStats] = {}
        for server_name, records in by_server.items():
            total = len(records)
            errors = sum(1 for r in records if not r.success)
            total_latency = sum(r.latency_ms for r in records)

            avg_latency = total_latency / total if total > 0 else 0.0
            error_rate = errors / total if total > 0 else 0.0

            # Count tool invocations
            tool_usage: dict[str, int] = defaultdict(int)
            for r in records:
                tool_usage[r.tool] += 1

            stats[server_name] = MCPServerStats(
                server_name=server_name,
                avg_latency_ms=round(avg_latency, 2),
                error_rate=round(error_rate, 4),
                tool_usage=dict(tool_usage),
                window_start=window_start,
            )

        return stats

    def check_latency_budgets(self, metrics: PipelineMetrics) -> list[str]:
        """Check pipeline metrics against latency budgets and emit warnings.

        Emits warning-level log entries for any budget violations including
        the request correlation ID, component name, measured value, and
        threshold.

        Args:
            metrics: The PipelineMetrics to check.

        Returns:
            A list of human-readable violation description strings.
        """
        violations: list[str] = []

        if metrics.asr_latency_ms is not None and metrics.asr_latency_ms > self.ASR_BUDGET_MS:
            msg = (
                f"ASR latency {metrics.asr_latency_ms:.1f}ms exceeds "
                f"budget of {self.ASR_BUDGET_MS:.1f}ms"
            )
            violations.append(msg)
            self._logger.warning(
                "latency_budget_exceeded",
                request_id=metrics.request_id,
                component="ASR",
                measured_ms=metrics.asr_latency_ms,
                threshold_ms=self.ASR_BUDGET_MS,
            )

        if metrics.llm_ttft_ms is not None and metrics.llm_ttft_ms > self.LLM_TTFT_BUDGET_MS:
            msg = (
                f"LLM TTFT {metrics.llm_ttft_ms:.1f}ms exceeds "
                f"budget of {self.LLM_TTFT_BUDGET_MS:.1f}ms"
            )
            violations.append(msg)
            self._logger.warning(
                "latency_budget_exceeded",
                request_id=metrics.request_id,
                component="LLM",
                measured_ms=metrics.llm_ttft_ms,
                threshold_ms=self.LLM_TTFT_BUDGET_MS,
            )

        if metrics.tts_latency_ms is not None and metrics.tts_latency_ms > self.TTS_BUDGET_MS:
            msg = (
                f"TTS latency {metrics.tts_latency_ms:.1f}ms exceeds "
                f"budget of {self.TTS_BUDGET_MS:.1f}ms"
            )
            violations.append(msg)
            self._logger.warning(
                "latency_budget_exceeded",
                request_id=metrics.request_id,
                component="TTS",
                measured_ms=metrics.tts_latency_ms,
                threshold_ms=self.TTS_BUDGET_MS,
            )

        return violations
