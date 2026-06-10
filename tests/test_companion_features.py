"""Unit tests for Companion Features: tasks, reminders, habits, briefing, reflection."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from echomate.companion.briefing import MorningBriefing
from echomate.companion.habits import HabitTracker
from echomate.companion.reflection import EveningReflection
from echomate.companion.reminders import ReminderScheduler
from echomate.companion.tasks import TaskManager


# ---------------------------------------------------------------------------
# TaskManager tests
# ---------------------------------------------------------------------------


class TestTaskManager:
    @pytest.fixture
    def mgr(self) -> TaskManager:
        return TaskManager()

    @pytest.mark.asyncio
    async def test_create_task_basic(self, mgr: TaskManager) -> None:
        task = await mgr.create_task("Buy groceries")
        assert task.title == "Buy groceries"
        assert not task.completed
        assert task.id
        assert task in mgr.tasks

    @pytest.mark.asyncio
    async def test_create_task_truncates_title(self, mgr: TaskManager) -> None:
        long_title = "A" * 250
        task = await mgr.create_task(long_title)
        assert len(task.title) == 200

    @pytest.mark.asyncio
    async def test_create_task_empty_raises(self, mgr: TaskManager) -> None:
        with pytest.raises(ValueError, match="empty"):
            await mgr.create_task("")

    @pytest.mark.asyncio
    async def test_create_task_whitespace_raises(self, mgr: TaskManager) -> None:
        with pytest.raises(ValueError, match="empty"):
            await mgr.create_task("   ")

    @pytest.mark.asyncio
    async def test_get_pending_tasks_excludes_completed(self, mgr: TaskManager) -> None:
        t1 = await mgr.create_task("Task 1")
        await mgr.create_task("Task 2")
        await mgr.complete_task(t1.id)
        pending = await mgr.get_pending_tasks()
        assert all(not t.completed for t in pending)
        assert len(pending) == 1

    @pytest.mark.asyncio
    async def test_get_pending_tasks_due_filtering(self, mgr: TaskManager) -> None:
        now = datetime.now(timezone.utc)
        # due in 2 hours — inside 24h window
        await mgr.create_task("Soon", due_date=now + timedelta(hours=2))
        # due in 48 hours — outside 24h window
        await mgr.create_task("Later", due_date=now + timedelta(hours=48))

        pending = await mgr.get_pending_tasks(within_hours=24)
        titles = [t.title for t in pending]
        assert "Soon" in titles
        assert "Later" not in titles

    @pytest.mark.asyncio
    async def test_complete_task_marks_done(self, mgr: TaskManager) -> None:
        task = await mgr.create_task("Finish report")
        done = await mgr.complete_task(task.id)
        assert done.completed
        assert done.completed_at is not None

    @pytest.mark.asyncio
    async def test_complete_task_not_found_raises(self, mgr: TaskManager) -> None:
        with pytest.raises(ValueError, match="not found"):
            await mgr.complete_task("nonexistent-id")

    @pytest.mark.asyncio
    async def test_complete_task_already_done_raises(self, mgr: TaskManager) -> None:
        task = await mgr.create_task("Do thing")
        await mgr.complete_task(task.id)
        with pytest.raises(ValueError, match="already completed"):
            await mgr.complete_task(task.id)

    @pytest.mark.asyncio
    async def test_create_task_persists_to_ltm(self) -> None:
        mock_ltm = MagicMock()
        mock_ltm.is_available.return_value = True
        mock_ltm.store = AsyncMock()
        mgr = TaskManager(long_term_memory=mock_ltm)
        await mgr.create_task("LTM task")
        mock_ltm.store.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_task_skips_ltm_when_unavailable(self) -> None:
        mock_ltm = MagicMock()
        mock_ltm.is_available.return_value = False
        mock_ltm.store = AsyncMock()
        mgr = TaskManager(long_term_memory=mock_ltm)
        await mgr.create_task("No LTM")
        mock_ltm.store.assert_not_awaited()


# ---------------------------------------------------------------------------
# ReminderScheduler tests
# ---------------------------------------------------------------------------


class TestReminderScheduler:
    @pytest.fixture
    def sched(self) -> ReminderScheduler:
        return ReminderScheduler()

    @pytest.mark.asyncio
    async def test_create_reminder(self, sched: ReminderScheduler) -> None:
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        reminder = await sched.create_reminder("Take meds", trigger)
        assert reminder.text == "Take meds"
        assert not reminder.delivered
        assert not reminder.queued

    @pytest.mark.asyncio
    async def test_check_due_reminders_within_window(self, sched: ReminderScheduler) -> None:
        now = datetime.now(timezone.utc)
        r = await sched.create_reminder("Now!", now)
        due = await sched.check_due_reminders()
        assert r in due

    @pytest.mark.asyncio
    async def test_check_due_reminders_excludes_future(self, sched: ReminderScheduler) -> None:
        future = datetime.now(timezone.utc) + timedelta(minutes=10)
        await sched.create_reminder("Future", future)
        due = await sched.check_due_reminders()
        assert len(due) == 0

    @pytest.mark.asyncio
    async def test_check_due_reminders_excludes_delivered(self, sched: ReminderScheduler) -> None:
        now = datetime.now(timezone.utc)
        r = await sched.create_reminder("Done", now)
        await sched.deliver_reminder(r)
        due = await sched.check_due_reminders()
        assert r not in due

    @pytest.mark.asyncio
    async def test_queue_missed_reminder(self, sched: ReminderScheduler) -> None:
        trigger = datetime.now(timezone.utc) - timedelta(minutes=5)
        r = await sched.create_reminder("Missed", trigger)
        await sched.queue_missed_reminder(r)
        assert r.queued

    @pytest.mark.asyncio
    async def test_on_session_start_returns_queued(self, sched: ReminderScheduler) -> None:
        trigger = datetime.now(timezone.utc) - timedelta(minutes=5)
        r = await sched.create_reminder("Queued", trigger)
        await sched.queue_missed_reminder(r)
        queued = await sched.on_session_start()
        assert r in queued
        assert sched.session_active

    @pytest.mark.asyncio
    async def test_on_session_end_deactivates(self, sched: ReminderScheduler) -> None:
        await sched.on_session_start()
        await sched.on_session_end()
        assert not sched.session_active


# ---------------------------------------------------------------------------
# HabitTracker tests
# ---------------------------------------------------------------------------


class TestHabitTracker:
    @pytest.fixture
    def tracker(self) -> HabitTracker:
        return HabitTracker()

    @pytest.mark.asyncio
    async def test_record_habit_adds_entry(self, tracker: HabitTracker) -> None:
        await tracker.record_habit("meditation")
        assert len(tracker.entries) == 1
        assert tracker.entries[0].habit_name == "meditation"

    @pytest.mark.asyncio
    async def test_get_trends_groups_by_name(self, tracker: HabitTracker) -> None:
        await tracker.record_habit("exercise")
        await tracker.record_habit("exercise")
        await tracker.record_habit("reading")
        trends = await tracker.get_trends(days=7)
        assert len(trends["exercise"]) == 2
        assert len(trends["reading"]) == 1

    @pytest.mark.asyncio
    async def test_get_trends_excludes_old_entries(self, tracker: HabitTracker) -> None:
        from echomate.models import HabitEntry

        old_entry = HabitEntry(
            habit_name="old_habit",
            completed_at=datetime.now(timezone.utc) - timedelta(days=10),
        )
        tracker.entries.append(old_entry)
        trends = await tracker.get_trends(days=7)
        assert "old_habit" not in trends

    @pytest.mark.asyncio
    async def test_get_trends_empty_when_no_entries(self, tracker: HabitTracker) -> None:
        trends = await tracker.get_trends()
        assert trends == {}


# ---------------------------------------------------------------------------
# MorningBriefing tests
# ---------------------------------------------------------------------------


class TestMorningBriefing:
    @pytest.fixture
    def briefing(self) -> MorningBriefing:
        return MorningBriefing(TaskManager(), ReminderScheduler())

    @pytest.mark.asyncio
    async def test_generate_no_mcp(self, briefing: MorningBriefing) -> None:
        result = await briefing.generate()
        assert "pending_tasks" in result
        assert "upcoming_reminders" in result
        assert "calendar" in result["missing_sources"]  # type: ignore[operator]
        assert "weather" in result["missing_sources"]  # type: ignore[operator]

    @pytest.mark.asyncio
    async def test_generate_with_pending_tasks(self) -> None:
        mgr = TaskManager()
        await mgr.create_task("Morning task")
        briefing = MorningBriefing(mgr, ReminderScheduler())
        result = await briefing.generate()
        assert "Morning task" in result["pending_tasks"]  # type: ignore[operator]

    @pytest.mark.asyncio
    async def test_generate_with_mcp_calendar(self) -> None:
        async def mock_mcp(tool: str, args: dict) -> object:  # type: ignore[type-arg]
            if tool == "get_calendar_events":
                return ["Meeting at 9am"]
            if tool == "get_weather":
                return "Sunny, 25°C"
            return None

        briefing = MorningBriefing(TaskManager(), ReminderScheduler(), mock_mcp)
        result = await briefing.generate()
        assert result["calendar_events"] == ["Meeting at 9am"]
        assert result["weather"] == "Sunny, 25°C"
        assert result["missing_sources"] == []  # type: ignore[comparison-overlap]

    @pytest.mark.asyncio
    async def test_generate_partial_mcp_failure(self) -> None:
        async def mock_mcp(tool: str, args: dict) -> object:  # type: ignore[type-arg]
            if tool == "get_calendar_events":
                raise RuntimeError("Calendar unavailable")
            return "Cloudy"

        briefing = MorningBriefing(TaskManager(), ReminderScheduler(), mock_mcp)
        result = await briefing.generate()
        assert "calendar" in result["missing_sources"]  # type: ignore[operator]
        assert result["weather"] == "Cloudy"


# ---------------------------------------------------------------------------
# EveningReflection tests
# ---------------------------------------------------------------------------


class TestEveningReflection:
    @pytest.fixture
    def reflection(self) -> EveningReflection:
        return EveningReflection(TaskManager(), HabitTracker())

    @pytest.mark.asyncio
    async def test_generate_completed_today(self) -> None:
        mgr = TaskManager()
        t = await mgr.create_task("Done task")
        await mgr.complete_task(t.id)
        reflection = EveningReflection(mgr, HabitTracker())
        result = await reflection.generate()
        assert "Done task" in result["completed_today"]  # type: ignore[operator]

    @pytest.mark.asyncio
    async def test_generate_suggestions_max_3(self) -> None:
        tracker = HabitTracker()
        for habit in ["a", "b", "c", "d"]:
            await tracker.record_habit(habit)
        reflection = EveningReflection(TaskManager(), tracker)
        result = await reflection.generate()
        assert len(result["suggestions"]) <= 3  # type: ignore[arg-type]

    @pytest.mark.asyncio
    async def test_generate_habit_trends(self) -> None:
        tracker = HabitTracker()
        await tracker.record_habit("running")
        await tracker.record_habit("running")
        reflection = EveningReflection(TaskManager(), tracker)
        result = await reflection.generate()
        assert result["habit_trends"]["running"] == 2  # type: ignore[index]

    @pytest.mark.asyncio
    async def test_generate_no_tasks_suggestion(self, reflection: EveningReflection) -> None:
        result = await reflection.generate()
        assert any("task" in s.lower() for s in result["suggestions"])  # type: ignore[union-attr]
