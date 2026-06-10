"""Unit tests for the HabitTracker companion feature."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest

from echomate.companion.habits import HabitTracker
from echomate.models import HabitEntry


@pytest.fixture
def tracker() -> HabitTracker:
    """Create a fresh HabitTracker instance."""
    return HabitTracker()


class TestRecordHabit:
    """Tests for HabitTracker.record_habit()."""

    async def test_record_habit_adds_entry(self, tracker: HabitTracker) -> None:
        """Recording a habit should add an entry to the internal list."""
        await tracker.record_habit("exercise")
        assert len(tracker.entries) == 1
        assert tracker.entries[0].habit_name == "exercise"

    async def test_record_habit_stores_utc_timestamp(self, tracker: HabitTracker) -> None:
        """Recorded entries should have a UTC timestamp close to now."""
        before = datetime.now(timezone.utc)
        await tracker.record_habit("meditation")
        after = datetime.now(timezone.utc)

        entry = tracker.entries[0]
        assert before <= entry.completed_at <= after

    async def test_record_multiple_habits(self, tracker: HabitTracker) -> None:
        """Multiple habits can be recorded and stored separately."""
        await tracker.record_habit("exercise")
        await tracker.record_habit("reading")
        await tracker.record_habit("exercise")

        assert len(tracker.entries) == 3
        names = [e.habit_name for e in tracker.entries]
        assert names == ["exercise", "reading", "exercise"]

    async def test_record_habit_creates_habit_entry_model(self, tracker: HabitTracker) -> None:
        """Each recorded habit should be a HabitEntry instance."""
        await tracker.record_habit("journaling")
        assert isinstance(tracker.entries[0], HabitEntry)


class TestGetTrends:
    """Tests for HabitTracker.get_trends()."""

    async def test_get_trends_empty(self, tracker: HabitTracker) -> None:
        """An empty tracker should return an empty trends dict."""
        trends = await tracker.get_trends()
        assert trends == {}

    async def test_get_trends_returns_recent_entries(self, tracker: HabitTracker) -> None:
        """Trends should include habits recorded within the time window."""
        await tracker.record_habit("exercise")
        await tracker.record_habit("reading")

        trends = await tracker.get_trends(days=7)
        assert "exercise" in trends
        assert "reading" in trends
        assert len(trends["exercise"]) == 1
        assert len(trends["reading"]) == 1

    async def test_get_trends_excludes_old_entries(self, tracker: HabitTracker) -> None:
        """Entries older than the time window should be excluded."""
        # Manually add an old entry
        old_entry = HabitEntry(
            habit_name="exercise",
            completed_at=datetime.now(timezone.utc) - timedelta(days=10),
        )
        tracker.entries.append(old_entry)

        # Add a recent entry
        await tracker.record_habit("exercise")

        trends = await tracker.get_trends(days=7)
        assert "exercise" in trends
        assert len(trends["exercise"]) == 1  # Only the recent one

    async def test_get_trends_groups_by_habit_name(self, tracker: HabitTracker) -> None:
        """Trends should group timestamps by habit name."""
        await tracker.record_habit("exercise")
        await tracker.record_habit("exercise")
        await tracker.record_habit("meditation")

        trends = await tracker.get_trends(days=7)
        assert len(trends["exercise"]) == 2
        assert len(trends["meditation"]) == 1

    async def test_get_trends_custom_days_window(self, tracker: HabitTracker) -> None:
        """The days parameter should control the lookback window."""
        # Add an entry from 3 days ago
        entry_3d = HabitEntry(
            habit_name="exercise",
            completed_at=datetime.now(timezone.utc) - timedelta(days=3),
        )
        tracker.entries.append(entry_3d)

        # Should be included in a 7-day window
        trends_7 = await tracker.get_trends(days=7)
        assert "exercise" in trends_7
        assert len(trends_7["exercise"]) == 1

        # Should be excluded from a 2-day window
        trends_2 = await tracker.get_trends(days=2)
        assert trends_2 == {}

    async def test_get_trends_returns_datetime_objects(self, tracker: HabitTracker) -> None:
        """Trend values should be lists of datetime objects."""
        await tracker.record_habit("exercise")

        trends = await tracker.get_trends(days=7)
        assert all(isinstance(ts, datetime) for ts in trends["exercise"])
