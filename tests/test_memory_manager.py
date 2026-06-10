"""Unit tests for the MemoryManager facade."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from echomate.memory import LongTermMemory, MemoryManager, ShortTermMemory
from echomate.models import MemoryContext, MemoryEntry


class FakeLongTermMemory:
    """Fake LTM for testing with controllable availability and behavior."""

    def __init__(self, available: bool = True) -> None:
        self._available = available
        self._stored: list[tuple[str, dict]] = []
        self._entries: list[MemoryEntry] = []
        self._deleted: list[str] = []

    def is_available(self) -> bool:
        return self._available

    async def store(self, text: str, metadata: dict[str, Any]) -> None:
        if not self._available:
            raise RuntimeError("Long-term memory is unavailable")
        self._stored.append((text, metadata))

    async def search(
        self, query: str, top_k: int | None = None, min_score: float | None = None
    ) -> list[MemoryEntry]:
        if not self._available:
            return []
        return self._entries

    async def delete(self, query: str) -> list[str]:
        if not self._available:
            return []
        return self._deleted

    def set_entries(self, entries: list[MemoryEntry]) -> None:
        self._entries = entries

    def set_deleted(self, deleted: list[str]) -> None:
        self._deleted = deleted


@pytest.fixture
def stm() -> ShortTermMemory:
    """Create a ShortTermMemory instance for tests."""
    return ShortTermMemory(max_tokens=4000)


@pytest.fixture
def available_ltm() -> FakeLongTermMemory:
    """Create an available FakeLongTermMemory."""
    return FakeLongTermMemory(available=True)


@pytest.fixture
def unavailable_ltm() -> FakeLongTermMemory:
    """Create an unavailable FakeLongTermMemory."""
    return FakeLongTermMemory(available=False)


class TestGetContext:
    """Tests for MemoryManager.get_context()."""

    def test_returns_short_term_messages(self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory) -> None:
        """get_context returns short-term messages from the buffer."""
        stm.add({"role": "user", "content": "Hello"})
        stm.add({"role": "assistant", "content": "Hi there!"})
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        ctx = asyncio.run(mm.get_context("hello"))

        assert len(ctx.short_term_messages) == 2
        assert ctx.short_term_messages[0]["content"] == "Hello"
        assert ctx.short_term_messages[1]["content"] == "Hi there!"

    def test_returns_long_term_entries_when_available(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """get_context returns LTM entries when long-term memory is available."""
        entry = MemoryEntry(
            id="test-1",
            text="Wife's birthday is March 15",
            category="fact",
            timestamp=datetime.now(timezone.utc),
            similarity_score=0.85,
        )
        available_ltm.set_entries([entry])
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        ctx = asyncio.run(mm.get_context("birthday"))

        assert len(ctx.long_term_entries) == 1
        assert ctx.long_term_entries[0].text == "Wife's birthday is March 15"
        assert ctx.has_long_term is True

    def test_graceful_degradation_when_ltm_unavailable(
        self, stm: ShortTermMemory, unavailable_ltm: FakeLongTermMemory
    ) -> None:
        """get_context degrades gracefully when LTM is unavailable."""
        stm.add({"role": "user", "content": "What is my birthday?"})
        mm = MemoryManager(short_term=stm, long_term=unavailable_ltm)

        ctx = asyncio.run(mm.get_context("birthday"))

        assert len(ctx.short_term_messages) == 1
        assert ctx.long_term_entries == []
        assert ctx.has_long_term is False

    def test_handles_search_exception_gracefully(self, stm: ShortTermMemory) -> None:
        """get_context handles search exceptions by degrading gracefully."""
        ltm = FakeLongTermMemory(available=True)

        async def failing_search(*args, **kwargs):
            raise RuntimeError("Chroma connection lost")

        ltm.search = failing_search  # type: ignore
        mm = MemoryManager(short_term=stm, long_term=ltm)

        ctx = asyncio.run(mm.get_context("test"))

        assert ctx.long_term_entries == []
        assert ctx.has_long_term is False

    def test_returns_memory_context_type(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """get_context returns a MemoryContext instance."""
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        ctx = asyncio.run(mm.get_context("test"))

        assert isinstance(ctx, MemoryContext)


class TestStoreFact:
    """Tests for MemoryManager.store_fact()."""

    def test_stores_fact_with_timestamp(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """store_fact adds a timestamp to metadata and stores in LTM."""
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        asyncio.run(mm.store_fact("My dog's name is Max", {"category": "fact"}))

        assert len(available_ltm._stored) == 1
        text, metadata = available_ltm._stored[0]
        assert text == "My dog's name is Max"
        assert "timestamp" in metadata
        assert metadata["category"] == "fact"

    def test_stores_fact_with_default_empty_metadata(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """store_fact works with no explicit metadata."""
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        asyncio.run(mm.store_fact("I like pizza"))

        assert len(available_ltm._stored) == 1
        text, metadata = available_ltm._stored[0]
        assert text == "I like pizza"
        assert "timestamp" in metadata

    def test_does_not_store_when_ltm_unavailable(
        self, stm: ShortTermMemory, unavailable_ltm: FakeLongTermMemory
    ) -> None:
        """store_fact logs a warning and returns when LTM is unavailable."""
        mm = MemoryManager(short_term=stm, long_term=unavailable_ltm)

        # Should not raise
        asyncio.run(mm.store_fact("Some fact", {}))

        assert len(unavailable_ltm._stored) == 0

    def test_handles_store_exception_gracefully(self, stm: ShortTermMemory) -> None:
        """store_fact handles exceptions from LTM.store() without crashing."""
        ltm = FakeLongTermMemory(available=True)

        async def failing_store(*args, **kwargs):
            raise RuntimeError("Storage error")

        ltm.store = failing_store  # type: ignore
        mm = MemoryManager(short_term=stm, long_term=ltm)

        # Should not raise
        asyncio.run(mm.store_fact("fact", {}))


class TestEndSession:
    """Tests for MemoryManager.end_session()."""

    def test_stores_session_summary(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """end_session creates and stores a summary in LTM."""
        mm = MemoryManager(short_term=stm, long_term=available_ltm)
        conversation = [
            {"role": "user", "content": "What's the weather?"},
            {"role": "assistant", "content": "It's sunny today."},
        ]

        asyncio.run(mm.end_session(conversation))

        assert len(available_ltm._stored) == 1
        text, metadata = available_ltm._stored[0]
        assert "Session summary:" in text
        assert metadata["category"] == "session_summary"
        assert "timestamp" in metadata
        assert metadata["message_count"] == 2

    def test_summary_truncated_to_500_tokens(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """end_session truncates summary to max 500 tokens."""
        mm = MemoryManager(short_term=stm, long_term=available_ltm)
        # Create a very long conversation
        conversation = [
            {"role": "user", "content": "word " * 2000}
            for _ in range(10)
        ]

        asyncio.run(mm.end_session(conversation))

        text, _ = available_ltm._stored[0]
        estimated_tokens = len(text) // 4
        assert estimated_tokens <= 500

    def test_does_not_store_when_ltm_unavailable(
        self, stm: ShortTermMemory, unavailable_ltm: FakeLongTermMemory
    ) -> None:
        """end_session gracefully skips when LTM is unavailable."""
        mm = MemoryManager(short_term=stm, long_term=unavailable_ltm)

        asyncio.run(mm.end_session([{"role": "user", "content": "hi"}]))

        assert len(unavailable_ltm._stored) == 0

    def test_empty_conversation_skips_storage(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """end_session does not store anything for empty conversations."""
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        asyncio.run(mm.end_session([]))

        assert len(available_ltm._stored) == 0


class TestForget:
    """Tests for MemoryManager.forget()."""

    def test_returns_removed_descriptions(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """forget returns list of descriptions of removed items."""
        available_ltm.set_deleted(["Wife's birthday", "Anniversary date"])
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        removed = asyncio.run(mm.forget("birthday"))

        assert removed == ["Wife's birthday", "Anniversary date"]

    def test_returns_empty_when_no_matches(
        self, stm: ShortTermMemory, available_ltm: FakeLongTermMemory
    ) -> None:
        """forget returns empty list when no entries match."""
        available_ltm.set_deleted([])
        mm = MemoryManager(short_term=stm, long_term=available_ltm)

        removed = asyncio.run(mm.forget("nonexistent"))

        assert removed == []

    def test_returns_empty_when_ltm_unavailable(
        self, stm: ShortTermMemory, unavailable_ltm: FakeLongTermMemory
    ) -> None:
        """forget returns empty list when LTM is unavailable."""
        mm = MemoryManager(short_term=stm, long_term=unavailable_ltm)

        removed = asyncio.run(mm.forget("anything"))

        assert removed == []

    def test_handles_delete_exception_gracefully(self, stm: ShortTermMemory) -> None:
        """forget handles exceptions from LTM.delete() without crashing."""
        ltm = FakeLongTermMemory(available=True)

        async def failing_delete(*args, **kwargs):
            raise RuntimeError("Delete failed")

        ltm.delete = failing_delete  # type: ignore
        mm = MemoryManager(short_term=stm, long_term=ltm)

        removed = asyncio.run(mm.forget("test"))

        assert removed == []
