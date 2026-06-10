"""Memory system with short-term and long-term RAG-based retrieval.

Provides the MemoryManager facade that orchestrates short-term conversation
buffers and long-term persistent memory with graceful degradation when
the Chroma vector database is unavailable.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from echomate.models import MemoryContext, MemoryEntry

from .long_term import LongTermMemory
from .short_term import ShortTermMemory

logger = logging.getLogger(__name__)

__all__ = [
    "LongTermMemory",
    "MemoryManager",
    "ShortTermMemory",
]


def _estimate_tokens(text: str) -> int:
    """Estimate token count using a simple heuristic (len / 4).

    Args:
        text: The text to estimate tokens for.

    Returns:
        Estimated number of tokens.
    """
    return max(1, len(text) // 4)


def _truncate_to_tokens(text: str, max_tokens: int) -> str:
    """Truncate text to approximately fit within a token budget.

    Uses the heuristic that 1 token ≈ 4 characters.

    Args:
        text: The text to truncate.
        max_tokens: Maximum number of tokens allowed.

    Returns:
        The text truncated to fit within the token budget.
    """
    max_chars = max_tokens * 4
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


class MemoryManager:
    """Orchestrates short-term and long-term memory.

    Provides a unified interface for memory operations including context
    retrieval, fact storage, session summarization, and selective forgetting.
    Gracefully degrades to short-term memory only when the Chroma vector
    database is unavailable.

    Args:
        short_term: The short-term memory instance for conversation history.
        long_term: The long-term memory instance for persistent RAG storage.

    Attributes:
        short_term: The short-term memory buffer.
        long_term: The long-term memory backend.
    """

    def __init__(self, short_term: ShortTermMemory, long_term: LongTermMemory) -> None:
        """Initialize MemoryManager with both memory tiers.

        Args:
            short_term: The short-term memory instance.
            long_term: The long-term memory instance.
        """
        self.short_term = short_term
        self.long_term = long_term

    async def get_context(self, query: str) -> MemoryContext:
        """Retrieve relevant memories for prompt augmentation.

        Combines recent conversation history from short-term memory with
        semantically relevant entries from long-term memory (RAG). If
        long-term memory is unavailable, returns short-term only with
        an empty long_term_entries list.

        Args:
            query: The user's current query for semantic search.

        Returns:
            A MemoryContext containing short-term messages and long-term entries.
        """
        short_term_messages = self.short_term.get_messages()
        long_term_entries: list[MemoryEntry] = []
        has_long_term = self.long_term.is_available()

        if has_long_term:
            try:
                long_term_entries = await self.long_term.search(query)
            except Exception as e:
                logger.warning(
                    "Long-term memory search failed: %s. Continuing with short-term only.",
                    e,
                )
                has_long_term = False
        else:
            logger.debug("Long-term memory unavailable. Using short-term memory only.")

        return MemoryContext(
            short_term_messages=short_term_messages,
            long_term_entries=long_term_entries,
            has_long_term=has_long_term,
        )

    async def store_fact(self, fact: str, metadata: dict[str, Any] | None = None) -> None:
        """Store a user fact in long-term memory with timestamp.

        Adds a timestamp to the metadata and persists the fact in long-term
        memory. If long-term memory is unavailable, logs a warning and
        returns without storing.

        Args:
            fact: The fact text to store.
            metadata: Optional additional metadata (category, source, etc.).
        """
        if metadata is None:
            metadata = {}

        metadata["timestamp"] = datetime.now(timezone.utc).isoformat()

        if not self.long_term.is_available():
            logger.warning(
                "Long-term memory unavailable. Cannot store fact: %s",
                fact[:50],
            )
            return

        try:
            await self.long_term.store(fact, metadata)
        except Exception as e:
            logger.error("Failed to store fact in long-term memory: %s", e)

    async def end_session(self, conversation: list[dict[str, Any]]) -> None:
        """Summarize and store session in long-term memory.

        Creates a summary from the conversation (truncated to max 500 tokens)
        and stores it in long-term memory with the category "session_summary".
        If long-term memory is unavailable, logs a warning and returns.

        Args:
            conversation: The full conversation history as a list of
                OpenAI-format message dicts with 'role' and 'content' keys.
        """
        if not self.long_term.is_available():
            logger.warning(
                "Long-term memory unavailable. Cannot store session summary."
            )
            return

        summary = self._create_session_summary(conversation)
        if not summary:
            logger.debug("Empty conversation, skipping session summary.")
            return

        metadata = {
            "category": "session_summary",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message_count": len(conversation),
        }

        try:
            await self.long_term.store(summary, metadata)
            logger.info("Session summary stored (%d messages summarized).", len(conversation))
        except Exception as e:
            logger.error("Failed to store session summary: %s", e)

    async def forget(self, query: str) -> list[str]:
        """Remove matching entries from long-term memory.

        Performs a semantic search to find matching entries, removes them,
        and returns descriptions of what was removed. If long-term memory
        is unavailable, returns an empty list.

        Args:
            query: The query describing what to forget.

        Returns:
            List of descriptions of removed items. Empty if LTM unavailable
            or no matches found.
        """
        if not self.long_term.is_available():
            logger.warning(
                "Long-term memory unavailable. Cannot forget: %s",
                query[:50],
            )
            return []

        try:
            removed = await self.long_term.delete(query)
            if removed:
                logger.info(
                    "Removed %d entries matching query: %s",
                    len(removed),
                    query[:50],
                )
            return removed
        except Exception as e:
            logger.error("Failed to forget entries: %s", e)
            return []

    def _create_session_summary(self, conversation: list[dict[str, Any]]) -> str:
        """Create a concise summary from a conversation, truncated to 500 tokens.

        Extracts key content from the conversation messages and produces
        a structured summary. The result is truncated to fit within the
        500-token budget.

        Args:
            conversation: The conversation messages in OpenAI format.

        Returns:
            A summary string, or empty string if conversation is empty.
        """
        if not conversation:
            return ""

        max_summary_tokens = 500

        # Build a summary from conversation content
        parts: list[str] = []
        parts.append("Session summary:")

        for msg in conversation:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if content:
                # Include role prefix for context
                parts.append(f"[{role}] {content}")

        raw_summary = "\n".join(parts)

        # Truncate to 500 tokens
        return _truncate_to_tokens(raw_summary, max_summary_tokens)
