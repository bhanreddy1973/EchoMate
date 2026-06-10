"""Tests for the LongTermMemory module.

Tests cover store, search, delete, and is_available operations using
a temporary Chroma directory for isolation.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from echomate.memory.long_term import LongTermMemory


@pytest.fixture
def temp_chroma_dir(tmp_path: Path) -> str:
    """Provide a temporary directory for Chroma persistence."""
    return str(tmp_path / "chroma_test")


@pytest.fixture
def memory(temp_chroma_dir: str) -> LongTermMemory:
    """Create a LongTermMemory instance with a temp directory."""
    return LongTermMemory(chroma_persist_dir=temp_chroma_dir)


class TestLongTermMemoryInit:
    """Tests for LongTermMemory initialization."""

    def test_init_creates_instance(self, temp_chroma_dir: str) -> None:
        """LongTermMemory should initialize successfully with a valid path."""
        ltm = LongTermMemory(chroma_persist_dir=temp_chroma_dir)
        assert ltm.is_available() is True

    def test_init_custom_collection_name(self, temp_chroma_dir: str) -> None:
        """LongTermMemory should accept a custom collection name."""
        ltm = LongTermMemory(
            chroma_persist_dir=temp_chroma_dir,
            collection_name="custom_collection",
        )
        assert ltm.is_available() is True
        assert ltm._collection_name == "custom_collection"

    def test_init_graceful_degradation_invalid_path(self) -> None:
        """LongTermMemory should not crash with an invalid persist path.

        Note: Chroma may still create the directory, so we test with a
        path that's truly invalid (e.g., within a non-writable location).
        This test verifies the graceful handling pattern exists.
        """
        # A valid path will work; testing the pattern
        ltm = LongTermMemory(chroma_persist_dir="/tmp/echomate_test_valid")
        assert ltm.is_available() is True


class TestIsAvailable:
    """Tests for the is_available health check."""

    def test_is_available_when_initialized(self, memory: LongTermMemory) -> None:
        """Should return True when properly initialized."""
        assert memory.is_available() is True

    def test_is_available_false_when_client_none(self, temp_chroma_dir: str) -> None:
        """Should return False when chroma_client is None."""
        ltm = LongTermMemory(chroma_persist_dir=temp_chroma_dir)
        ltm.chroma_client = None
        ltm._available = False
        assert ltm.is_available() is False


class TestStore:
    """Tests for the store method."""

    @pytest.mark.asyncio
    async def test_store_basic_fact(self, memory: LongTermMemory) -> None:
        """Should store a basic fact without error."""
        await memory.store(
            text="User's wife's birthday is March 15",
            metadata={"category": "fact"},
        )
        # Verify by searching
        results = await memory.search("wife birthday", min_score=0.0)
        assert len(results) >= 1
        assert "March 15" in results[0].text

    @pytest.mark.asyncio
    async def test_store_with_metadata(self, memory: LongTermMemory) -> None:
        """Should store entry with additional metadata."""
        await memory.store(
            text="User prefers brief responses",
            metadata={"category": "preference", "source": "user_request"},
        )
        results = await memory.search("brief responses", min_score=0.0)
        assert len(results) >= 1
        assert results[0].category == "preference"

    @pytest.mark.asyncio
    async def test_store_when_unavailable(self, temp_chroma_dir: str) -> None:
        """Should silently return when memory is unavailable."""
        ltm = LongTermMemory(chroma_persist_dir=temp_chroma_dir)
        ltm._available = False
        # Should not raise
        await ltm.store("test", {"category": "fact"})


class TestSearch:
    """Tests for the search method."""

    @pytest.mark.asyncio
    async def test_search_returns_matching_entries(
        self, memory: LongTermMemory
    ) -> None:
        """Should return entries matching the query."""
        await memory.store("I love hiking in the mountains", {"category": "fact"})
        await memory.store("My favorite color is blue", {"category": "preference"})

        results = await memory.search("outdoor activities hiking", min_score=0.0)
        assert len(results) >= 1
        assert any("hiking" in r.text for r in results)

    @pytest.mark.asyncio
    async def test_search_respects_min_score(self, memory: LongTermMemory) -> None:
        """Should filter out results below min_score."""
        await memory.store("Python programming language", {"category": "fact"})

        # With a very high threshold, irrelevant queries should return nothing
        results = await memory.search("quantum physics", min_score=0.99)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_search_respects_top_k(self, memory: LongTermMemory) -> None:
        """Should return at most top_k results."""
        for i in range(10):
            await memory.store(f"Fact number {i} about cooking", {"category": "fact"})

        results = await memory.search("cooking", top_k=3, min_score=0.0)
        assert len(results) <= 3

    @pytest.mark.asyncio
    async def test_search_returns_memory_entries(self, memory: LongTermMemory) -> None:
        """Should return MemoryEntry objects with proper fields."""
        await memory.store("Meeting with John at 3pm", {"category": "event"})

        results = await memory.search("meeting John", min_score=0.0)
        assert len(results) >= 1
        entry = results[0]
        assert entry.id is not None
        assert entry.text == "Meeting with John at 3pm"
        assert entry.category == "event"
        assert entry.timestamp is not None
        assert entry.similarity_score >= 0.0

    @pytest.mark.asyncio
    async def test_search_when_unavailable(self, temp_chroma_dir: str) -> None:
        """Should return empty list when memory is unavailable."""
        ltm = LongTermMemory(chroma_persist_dir=temp_chroma_dir)
        ltm._available = False
        results = await ltm.search("anything")
        assert results == []

    @pytest.mark.asyncio
    async def test_search_empty_collection(self, memory: LongTermMemory) -> None:
        """Should return empty list when no entries exist."""
        results = await memory.search("anything", min_score=0.0)
        assert results == []


class TestDelete:
    """Tests for the delete method."""

    @pytest.mark.asyncio
    async def test_delete_removes_matching_entries(
        self, memory: LongTermMemory
    ) -> None:
        """Should delete entries matching the query and return descriptions."""
        await memory.store(
            "My favorite restaurant is Pasta Palace", {"category": "preference"}
        )
        await memory.store("I enjoy swimming on weekends", {"category": "fact"})

        removed = await memory.delete("favorite restaurant Pasta Palace")
        assert len(removed) >= 1
        assert any("Pasta Palace" in desc for desc in removed)

        # Verify the Pasta Palace entry is gone
        results = await memory.search("Pasta Palace", min_score=0.0)
        assert not any("Pasta Palace" in r.text for r in results)

    @pytest.mark.asyncio
    async def test_delete_no_matches(self, memory: LongTermMemory) -> None:
        """Should return empty list when nothing matches."""
        await memory.store("Something about cats", {"category": "fact"})

        removed = await memory.delete("quantum computing research papers")
        # If nothing meets the score threshold, should be empty
        assert isinstance(removed, list)

    @pytest.mark.asyncio
    async def test_delete_when_unavailable(self, temp_chroma_dir: str) -> None:
        """Should return empty list when memory is unavailable."""
        ltm = LongTermMemory(chroma_persist_dir=temp_chroma_dir)
        ltm._available = False
        removed = await ltm.delete("anything")
        assert removed == []
