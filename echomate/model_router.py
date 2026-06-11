"""Model Router for EchoMate Voice Companion.

Provides intelligent LLM selection based on query complexity classification
and fallback routing across free model endpoints.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import deque
from typing import Any, AsyncGenerator

import litellm

from echomate.models import ModelEndpoint, QueryComplexity

# Patterns indicating a SIMPLE query (greetings, confirmations, short acknowledgments)
_GREETING_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^\s*(hi|hello|hey|howdy|yo|sup|good\s+(morning|afternoon|evening|night))\b", re.IGNORECASE),
    re.compile(r"^\s*(thanks|thank\s+you|thx|bye|goodbye|see\s+you|later|ok|okay|sure|yes|no|yep|nope|got\s+it|alright)\s*[.!?]?\s*$", re.IGNORECASE),
]

# Keywords/phrases indicating CREATIVE queries
_CREATIVE_KEYWORDS: list[str] = [
    "write",
    "story",
    "poem",
    "creative",
    "imagine",
    "journal",
    "reflect",
    "feeling",
    "mood",
    "emotion",
    "motivate",
    "inspire",
    "meditat",
    "mindful",
    "gratitude",
    "self-care",
    "how am i",
    "support",
]

# Keywords indicating TECHNICAL queries
_TECHNICAL_KEYWORDS: list[str] = [
    "code",
    "function",
    "debug",
    "error",
    "programming",
    "algorithm",
    "database",
    "api",
    "deploy",
    "server",
    "python",
    "javascript",
    "typescript",
    "docker",
    "kubernetes",
    "git",
    "terminal",
    "command",
    "script",
    "build",
    "compile",
]

# Keywords/phrases indicating a COMPLEX query (multi-step reasoning, synthesis)
_COMPLEX_KEYWORDS: list[str] = [
    "compare",
    "analyze",
    "explain step by step",
    "step by step",
    "synthesize",
    "multiple topics",
    "pros and cons",
    "trade-offs",
    "tradeoffs",
    "in detail",
    "break down",
    "elaborate on",
    "walk me through",
    "differences between",
    "similarities between",
    "evaluate",
    "contrast",
    "summarize and",
    "list all",
    "how does .* relate to",
    "what are the implications",
]

# Pre-compiled complex patterns for efficiency
_COMPLEX_PATTERNS: list[re.Pattern[str]] = [
    re.compile(rf"\b{kw}\b", re.IGNORECASE) if " " not in kw
    else re.compile(kw, re.IGNORECASE)
    for kw in _COMPLEX_KEYWORDS
]

_CREATIVE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(rf"\b{kw}\b", re.IGNORECASE) if " " not in kw
    else re.compile(kw, re.IGNORECASE)
    for kw in _CREATIVE_KEYWORDS
]

_TECHNICAL_PATTERNS: list[re.Pattern[str]] = [
    re.compile(rf"\b{kw}\b", re.IGNORECASE) if " " not in kw
    else re.compile(kw, re.IGNORECASE)
    for kw in _TECHNICAL_KEYWORDS
]


def classify_complexity(messages: list[dict]) -> QueryComplexity:
    """Classify query complexity based on the user's last message.

    Uses token count heuristics and keyword detection:
    - SIMPLE: < 20 tokens AND matches greeting/confirmation patterns
    - TECHNICAL: contains code/programming keywords
    - CREATIVE: contains emotional/writing keywords
    - COMPLEX: contains keywords suggesting multi-step reasoning or synthesis
    - MODERATE: everything else

    Args:
        messages: OpenAI-format message list (list of dicts with 'role' and 'content').

    Returns:
        QueryComplexity classification for model routing.
    """
    content = _get_last_user_content(messages)

    if not content:
        return QueryComplexity.SIMPLE

    token_count = len(content.split())

    # Check for SIMPLE: short message matching greeting/confirmation patterns
    if token_count < 20 and _matches_simple_pattern(content):
        return QueryComplexity.SIMPLE

    # Check for TECHNICAL: code/programming keywords
    if _matches_pattern_list(content, _TECHNICAL_PATTERNS):
        return QueryComplexity.TECHNICAL

    # Check for COMPLEX: keywords suggesting multi-step reasoning
    if _matches_complex_pattern(content):
        return QueryComplexity.COMPLEX

    # Check for CREATIVE: emotional/writing keywords
    if _matches_pattern_list(content, _CREATIVE_PATTERNS):
        return QueryComplexity.CREATIVE

    # Default to MODERATE
    return QueryComplexity.MODERATE


def _get_last_user_content(messages: list[dict]) -> str:
    """Extract content from the last user message in the conversation.

    Args:
        messages: OpenAI-format message list.

    Returns:
        The content string of the last user message, or empty string if none found.
    """
    for message in reversed(messages):
        if message.get("role") == "user":
            content = message.get("content", "")
            return content if isinstance(content, str) else ""
    return ""


def _matches_simple_pattern(content: str) -> bool:
    """Check if content matches greeting or confirmation patterns.

    Args:
        content: The user message text.

    Returns:
        True if the content matches a known simple/greeting pattern.
    """
    for pattern in _GREETING_PATTERNS:
        if pattern.search(content):
            return True
    return False


def _matches_complex_pattern(content: str) -> bool:
    """Check if content contains keywords indicating complex reasoning."""
    for pattern in _COMPLEX_PATTERNS:
        if pattern.search(content):
            return True
    return False


def _matches_pattern_list(content: str, patterns: list[re.Pattern[str]]) -> bool:
    """Check if content matches any pattern in the list."""
    for pattern in patterns:
        if pattern.search(content):
            return True
    return False


logger = logging.getLogger(__name__)


class AllModelsFailedError(Exception):
    """Raised when all models in the fallback chain have been exhausted.

    Attributes:
        messages: The original messages that failed to get a response.
        attempts: List of (model_id, error) tuples for each failed attempt.
    """

    def __init__(self, messages: list[dict], attempts: list[tuple[str, str]]) -> None:
        self.messages = messages
        self.attempts = attempts
        model_names = [model_id for model_id, _ in attempts]
        super().__init__(
            f"All models failed after {len(attempts)} attempts: {model_names}"
        )


# Default model registry — multi-model routing across NVIDIA NIM + OpenRouter
DEFAULT_MODEL_REGISTRY: list[ModelEndpoint] = [
    # ── Voice tier (ultra-fast for real-time voice) ──
    ModelEndpoint(
        name="openrouter/gemini-flash",
        provider="openrouter_free",
        model_id="openrouter/google/gemini-2.0-flash-001",
        tier="voice",
        priority=1,
    ),
    # ── Fast tier (general chat, quick responses) ──
    ModelEndpoint(
        name="nvidia_nim/nemotron-mini-4b",
        provider="nvidia_nim",
        model_id="nvidia_nim/nvidia/nemotron-mini-4b-instruct",
        tier="fast",
        priority=1,
    ),
    ModelEndpoint(
        name="openrouter/qwen3-coder-fast",
        provider="openrouter_free",
        model_id="openrouter/qwen/qwen3-coder:free",
        tier="fast",
        priority=2,
    ),
    # ── Reasoning tier (complex analysis, planning, multi-step) ──
    ModelEndpoint(
        name="nvidia_nim/nemotron-ultra-550b",
        provider="nvidia_nim",
        model_id="nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b",
        tier="reasoning",
        priority=1,
    ),
    ModelEndpoint(
        name="openrouter/nex-n2-pro",
        provider="openrouter_free",
        model_id="openrouter/nex-agi/nex-n2-pro:free",
        tier="reasoning",
        priority=2,
    ),
    # ── Creative tier (emotional, journaling, reflection) ──
    ModelEndpoint(
        name="nvidia_nim/llama-3.1-70b",
        provider="nvidia_nim",
        model_id="nvidia_nim/meta/llama-3.1-70b-instruct",
        tier="creative",
        priority=1,
    ),
    ModelEndpoint(
        name="openrouter/nemotron-ultra-creative",
        provider="openrouter_free",
        model_id="openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
        tier="creative",
        priority=2,
    ),
    # ── Technical tier (code, debugging, architecture) ──
    ModelEndpoint(
        name="nvidia_nim/qwen-coder-32b",
        provider="nvidia_nim",
        model_id="nvidia_nim/qwen/qwen2.5-coder-32b-instruct",
        tier="technical",
        priority=1,
    ),
    ModelEndpoint(
        name="openrouter/qwen3-coder",
        provider="openrouter_free",
        model_id="openrouter/qwen/qwen3-coder:free",
        tier="technical",
        priority=2,
    ),
]


class _ModelCallStats:
    """Internal tracking entry for a single model call result."""

    __slots__ = ("timestamp", "latency_ms", "success", "tokens")

    def __init__(self, timestamp: float, latency_ms: float, success: bool, tokens: int) -> None:
        self.timestamp = timestamp
        self.latency_ms = latency_ms
        self.success = success
        self.tokens = tokens


class ModelRouter:
    """Routes LLM requests to the optimal free model with fallback.

    Maintains a registry of available free model endpoints and selects the best
    model based on query complexity classification, priority ordering, and
    rolling performance health metrics.

    Args:
        models: Optional list of ModelEndpoint configurations. Defaults to
            DEFAULT_MODEL_REGISTRY.
        timeout_seconds: Timeout in seconds for each LLM call. Defaults to 5.
        max_fallbacks: Maximum number of fallback attempts. Defaults to 3.
        stats_window_seconds: Rolling window in seconds for performance stats.
            Defaults to 300 (5 minutes).
    """

    def __init__(
        self,
        models: list[ModelEndpoint] | None = None,
        timeout_seconds: float = 5.0,
        max_fallbacks: int = 3,
        stats_window_seconds: float = 300.0,
    ) -> None:
        self._models = list(models) if models else list(DEFAULT_MODEL_REGISTRY)
        self._timeout_seconds = timeout_seconds
        self._max_fallbacks = max_fallbacks
        self._stats_window_seconds = stats_window_seconds
        # Rolling stats per model_id: deque of _ModelCallStats entries
        self._stats: dict[str, deque[_ModelCallStats]] = {}

    async def route(
        self,
        messages: list[dict],
        tools: list[dict[str, Any]] | None = None,
        force_tier: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Select model, call via LiteLLM, handle fallback on failure.

        Routing algorithm:
        1. Classify query complexity using classify_complexity (or use force_tier).
        2. Filter models by matching tier.
        3. Sort by priority, prefer models with lowest recent error rate.
        4. Attempt top choice via LiteLLM with streaming.
        5. On failure (error or timeout), try next model (max fallbacks).
        6. Raise AllModelsFailedError when fallback chain is exhausted.

        Args:
            messages: OpenAI-format message list.
            tools: Optional tool definitions for function calling.
            force_tier: Override automatic tier selection (e.g., "voice", "reasoning").

        Yields:
            Response tokens as they stream from the LLM.

        Raises:
            AllModelsFailedError: When all fallback models are exhausted.
        """
        if force_tier:
            tier = force_tier
        else:
            complexity = classify_complexity(messages)
            tier = self._tier_for_complexity(complexity)

        candidates = self._get_sorted_candidates(tier)

        # Use longer timeout for reasoning models
        timeout = self._timeout_seconds
        if tier == "reasoning":
            timeout = max(timeout, 30.0)
        elif tier == "voice":
            timeout = min(timeout, 8.0)
        # For fast/creative/technical, use the configured timeout as-is

        if not candidates:
            raise AllModelsFailedError(messages, [("none", "No models available for tier")])

        attempts: list[tuple[str, str]] = []
        # Try up to max_fallbacks + 1 models (initial + fallbacks)
        max_attempts = min(len(candidates), self._max_fallbacks + 1)

        for candidate in candidates[:max_attempts]:
            model_id = candidate.model_id
            start_time = time.monotonic()

            try:
                logger.info(
                    "model_router.attempt",
                    extra={
                        "model_id": model_id,
                        "tier": tier,
                        "complexity": complexity.value,
                    },
                )

                kwargs: dict[str, Any] = {
                    "model": model_id,
                    "messages": messages,
                    "stream": True,
                }
                if tools:
                    kwargs["tools"] = tools

                # Call LiteLLM with timeout
                response = await asyncio.wait_for(
                    litellm.acompletion(**kwargs),
                    timeout=timeout,
                )

                # Stream tokens from the response
                token_count = 0
                async for chunk in response:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        token_count += 1
                        yield delta.content

                # Record success
                latency_ms = (time.monotonic() - start_time) * 1000
                self.update_stats(model_id, latency_ms, success=True, tokens=token_count)
                logger.info(
                    "model_router.success",
                    extra={
                        "model_id": model_id,
                        "latency_ms": latency_ms,
                        "tokens": token_count,
                    },
                )
                return  # Successfully streamed, exit

            except asyncio.TimeoutError:
                latency_ms = (time.monotonic() - start_time) * 1000
                error_msg = f"Timeout after {timeout}s"
                attempts.append((model_id, error_msg))
                self.update_stats(model_id, latency_ms, success=False, tokens=0)
                logger.warning(
                    "model_router.timeout",
                    extra={"model_id": model_id, "latency_ms": latency_ms},
                )

            except Exception as exc:
                latency_ms = (time.monotonic() - start_time) * 1000
                error_msg = f"{type(exc).__name__}: {exc}"
                attempts.append((model_id, error_msg))
                self.update_stats(model_id, latency_ms, success=False, tokens=0)
                logger.warning(
                    "model_router.error",
                    extra={
                        "model_id": model_id,
                        "error": error_msg,
                        "latency_ms": latency_ms,
                    },
                )

        # All attempts exhausted
        raise AllModelsFailedError(messages, attempts)

    def update_stats(
        self, model: str, latency_ms: float, success: bool, tokens: int
    ) -> None:
        """Update rolling performance statistics for a model.

        Maintains a time-windowed deque of call results used for routing
        decisions. Old entries outside the stats window are pruned on each call.

        Args:
            model: The LiteLLM model identifier.
            latency_ms: Response latency in milliseconds.
            success: Whether the call succeeded.
            tokens: Number of tokens generated.
        """
        now = time.monotonic()
        entry = _ModelCallStats(
            timestamp=now,
            latency_ms=latency_ms,
            success=success,
            tokens=tokens,
        )

        if model not in self._stats:
            self._stats[model] = deque()

        stats_deque = self._stats[model]
        stats_deque.append(entry)

        # Prune entries outside the rolling window
        cutoff = now - self._stats_window_seconds
        while stats_deque and stats_deque[0].timestamp < cutoff:
            stats_deque.popleft()

    def get_available_models(self, tier: str | None = None) -> list[ModelEndpoint]:
        """Get models filtered by tier, sorted by priority and health.

        Args:
            tier: Optional tier filter ("fast" or "reasoning").
                If None, returns all models.

        Returns:
            List of ModelEndpoint instances sorted by priority then error rate.
        """
        if tier is not None:
            candidates = [m for m in self._models if m.tier == tier]
        else:
            candidates = list(self._models)

        return self._sort_by_priority_and_health(candidates)

    def _tier_for_complexity(self, complexity: QueryComplexity) -> str:
        """Map query complexity to model tier.

        Args:
            complexity: The classified query complexity.

        Returns:
            The tier string.
        """
        mapping = {
            QueryComplexity.COMPLEX: "reasoning",
            QueryComplexity.CREATIVE: "creative",
            QueryComplexity.TECHNICAL: "technical",
        }
        return mapping.get(complexity, "fast")

    def _get_sorted_candidates(self, tier: str) -> list[ModelEndpoint]:
        """Get candidate models for a tier, sorted by priority and health.

        Falls back to 'fast' tier if no models found for the requested tier.

        Args:
            tier: The model tier to filter by.

        Returns:
            Sorted list of ModelEndpoint candidates.
        """
        candidates = [m for m in self._models if m.tier == tier]
        if not candidates:
            # Fallback to fast tier
            candidates = [m for m in self._models if m.tier == "fast"]
        return self._sort_by_priority_and_health(candidates)

    def _sort_by_priority_and_health(
        self, candidates: list[ModelEndpoint]
    ) -> list[ModelEndpoint]:
        """Sort models by priority first, then by recent error rate.

        Models with lower priority values are preferred. Among same-priority
        models, those with lower recent error rates are preferred.

        Args:
            candidates: List of models to sort.

        Returns:
            Sorted list of models.
        """
        def sort_key(model: ModelEndpoint) -> tuple[int, float]:
            error_rate = self._get_recent_error_rate(model.model_id)
            return (model.priority, error_rate)

        return sorted(candidates, key=sort_key)

    def _get_recent_error_rate(self, model_id: str) -> float:
        """Calculate the recent error rate for a model from rolling stats.

        Args:
            model_id: The LiteLLM model identifier.

        Returns:
            Error rate as a float between 0.0 and 1.0. Returns 0.0 if
            no stats are available.
        """
        if model_id not in self._stats:
            return 0.0

        now = time.monotonic()
        cutoff = now - self._stats_window_seconds
        stats_deque = self._stats[model_id]

        # Count only entries within the window
        total = 0
        failures = 0
        for entry in stats_deque:
            if entry.timestamp >= cutoff:
                total += 1
                if not entry.success:
                    failures += 1

        if total == 0:
            return 0.0

        return failures / total
