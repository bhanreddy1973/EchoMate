"""Unit tests for the ReminderScheduler module."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from echomate.companion.reminders import ReminderScheduler


class TestCreateReminder:
    """Tests for create_reminder method."""

    @pytest.mark.asyncio
    async def test_creates_reminder_with_correct_text(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        reminder = await scheduler.create_reminder("Call mom", trigger)
        assert reminder.text == "Call mom"

    @pytest.mark.asyncio
    async def test_creates_reminder_with_correct_trigger_time(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        reminder = await scheduler.create_reminder("Call mom", trigger)
        assert reminder.trigger_time == trigger

    @pytest.mark.asyncio
    async def test_reminder_starts_undelivered(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        reminder = await scheduler.create_reminder("Call mom", trigger)
        assert reminder.delivered is False

    @pytest.mark.asyncio
    async def test_reminder_starts_not_queued(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        reminder = await scheduler.create_reminder("Call mom", trigger)
        assert reminder.queued is False

    @pytest.mark.asyncio
    async def test_reminder_has_unique_id(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        r1 = await scheduler.create_reminder("First", trigger)
        r2 = await scheduler.create_reminder("Second", trigger)
        assert r1.id != r2.id

    @pytest.mark.asyncio
    async def test_reminder_added_to_internal_list(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(hours=1)
        await scheduler.create_reminder("Call mom", trigger)
        assert len(scheduler.reminders) == 1


class TestCheckDueReminders:
    """Tests for check_due_reminders method."""

    @pytest.mark.asyncio
    async def test_returns_reminder_due_now(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc)
        await scheduler.create_reminder("Due now", trigger)
        due = await scheduler.check_due_reminders()
        assert len(due) == 1
        assert due[0].text == "Due now"

    @pytest.mark.asyncio
    async def test_returns_reminder_within_60_seconds_future(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(seconds=30)
        await scheduler.create_reminder("Almost due", trigger)
        due = await scheduler.check_due_reminders()
        assert len(due) == 1

    @pytest.mark.asyncio
    async def test_returns_reminder_within_60_seconds_past(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(seconds=30)
        await scheduler.create_reminder("Just passed", trigger)
        due = await scheduler.check_due_reminders()
        assert len(due) == 1

    @pytest.mark.asyncio
    async def test_excludes_reminder_more_than_60_seconds_future(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) + timedelta(seconds=120)
        await scheduler.create_reminder("Not yet", trigger)
        due = await scheduler.check_due_reminders()
        assert len(due) == 0

    @pytest.mark.asyncio
    async def test_excludes_reminder_more_than_60_seconds_past(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(seconds=120)
        await scheduler.create_reminder("Long gone", trigger)
        due = await scheduler.check_due_reminders()
        assert len(due) == 0

    @pytest.mark.asyncio
    async def test_excludes_already_delivered_reminders(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc)
        reminder = await scheduler.create_reminder("Delivered", trigger)
        await scheduler.deliver_reminder(reminder)
        due = await scheduler.check_due_reminders()
        assert len(due) == 0

    @pytest.mark.asyncio
    async def test_handles_naive_trigger_time(self) -> None:
        """Naive datetime trigger_time is treated as UTC."""
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc).replace(tzinfo=None)
        await scheduler.create_reminder("Naive time", trigger)
        due = await scheduler.check_due_reminders()
        assert len(due) == 1

    @pytest.mark.asyncio
    async def test_returns_multiple_due_reminders(self) -> None:
        scheduler = ReminderScheduler()
        now = datetime.now(timezone.utc)
        await scheduler.create_reminder("First", now)
        await scheduler.create_reminder("Second", now + timedelta(seconds=10))
        due = await scheduler.check_due_reminders()
        assert len(due) == 2


class TestQueueMissedReminder:
    """Tests for queue_missed_reminder method."""

    @pytest.mark.asyncio
    async def test_marks_reminder_as_queued(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(minutes=5)
        reminder = await scheduler.create_reminder("Missed", trigger)
        await scheduler.queue_missed_reminder(reminder)
        assert reminder.queued is True

    @pytest.mark.asyncio
    async def test_queued_reminder_appears_in_get_queued(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(minutes=5)
        reminder = await scheduler.create_reminder("Missed", trigger)
        await scheduler.queue_missed_reminder(reminder)
        queued = await scheduler.get_queued_reminders()
        assert len(queued) == 1
        assert queued[0].id == reminder.id

    @pytest.mark.asyncio
    async def test_delivered_queued_reminder_excluded(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(minutes=5)
        reminder = await scheduler.create_reminder("Missed", trigger)
        await scheduler.queue_missed_reminder(reminder)
        await scheduler.deliver_reminder(reminder)
        queued = await scheduler.get_queued_reminders()
        assert len(queued) == 0


class TestSessionHandling:
    """Tests for session start/end and queued reminder delivery."""

    @pytest.mark.asyncio
    async def test_on_session_start_returns_queued_reminders(self) -> None:
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(minutes=5)
        reminder = await scheduler.create_reminder("Missed", trigger)
        await scheduler.queue_missed_reminder(reminder)
        to_deliver = await scheduler.on_session_start()
        assert len(to_deliver) == 1
        assert to_deliver[0].id == reminder.id

    @pytest.mark.asyncio
    async def test_on_session_start_sets_active(self) -> None:
        scheduler = ReminderScheduler()
        await scheduler.on_session_start()
        assert scheduler.session_active is True

    @pytest.mark.asyncio
    async def test_on_session_end_sets_inactive(self) -> None:
        scheduler = ReminderScheduler()
        await scheduler.on_session_start()
        await scheduler.on_session_end()
        assert scheduler.session_active is False

    @pytest.mark.asyncio
    async def test_session_start_records_time(self) -> None:
        scheduler = ReminderScheduler()
        before = datetime.now(timezone.utc)
        await scheduler.on_session_start()
        after = datetime.now(timezone.utc)
        assert scheduler._session_start_time is not None
        assert before <= scheduler._session_start_time <= after

    @pytest.mark.asyncio
    async def test_queued_reminders_delivered_at_session_start(self) -> None:
        """Queued reminders are returned at session start for delivery within 60s."""
        scheduler = ReminderScheduler()
        trigger = datetime.now(timezone.utc) - timedelta(hours=1)
        r1 = await scheduler.create_reminder("Old reminder", trigger)
        await scheduler.queue_missed_reminder(r1)

        to_deliver = await scheduler.on_session_start()
        assert len(to_deliver) == 1
        assert to_deliver[0].text == "Old reminder"
