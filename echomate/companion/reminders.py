"""Reminder Scheduler for EchoMate companion features.

Manages reminder creation, due-checking, and queuing for missed reminders
when no active session exists.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from echomate.models import Reminder


class ReminderScheduler:
    """Manages reminder creation and delivery.

    Maintains an internal list of reminders, checks for due reminders
    within a 60-second window, and queues missed reminders for delivery
    at the next session start.

    Attributes:
        reminders: Internal list of all reminders.
        session_active: Whether a voice session is currently active.
        _session_start_time: Timestamp of the most recent session start.
    """

    def __init__(self) -> None:
        """Initialize the ReminderScheduler with an empty reminder list."""
        self.reminders: list[Reminder] = []
        self.session_active: bool = False
        self._session_start_time: datetime | None = None

    async def create_reminder(self, text: str, trigger_time: datetime) -> Reminder:
        """Create a new reminder with the given text and trigger time.

        Args:
            text: The reminder message content.
            trigger_time: When the reminder should be delivered.

        Returns:
            The newly created Reminder instance.
        """
        reminder = Reminder(
            id=str(uuid.uuid4()),
            text=text,
            trigger_time=trigger_time,
            delivered=False,
            queued=False,
        )
        self.reminders.append(reminder)
        return reminder

    async def check_due_reminders(self) -> list[Reminder]:
        """Check for reminders that are due within 60 seconds of now.

        Returns reminders where trigger_time is within 60 seconds of the
        current time (past or future) that haven't been delivered yet.

        Returns:
            List of due reminders that have not been delivered.
        """
        now = datetime.now(timezone.utc)
        due_reminders: list[Reminder] = []

        for reminder in self.reminders:
            if reminder.delivered:
                continue

            trigger = reminder.trigger_time
            # Ensure trigger_time is timezone-aware for comparison
            if trigger.tzinfo is None:
                trigger = trigger.replace(tzinfo=timezone.utc)

            diff_seconds = abs((now - trigger).total_seconds())
            if diff_seconds <= 60:
                due_reminders.append(reminder)

        return due_reminders

    async def queue_missed_reminder(self, reminder: Reminder) -> None:
        """Queue a reminder for delivery at the next session start.

        Called when a reminder's trigger time arrives but no active session
        exists. The reminder will be delivered within 60 seconds of the
        user's next session start.

        Args:
            reminder: The reminder to queue for later delivery.
        """
        reminder.queued = True

    async def deliver_reminder(self, reminder: Reminder) -> None:
        """Mark a reminder as delivered.

        Args:
            reminder: The reminder to mark as delivered.
        """
        reminder.delivered = True

    async def get_queued_reminders(self) -> list[Reminder]:
        """Get all queued reminders waiting for session start.

        Returns:
            List of reminders that are queued but not yet delivered.
        """
        return [r for r in self.reminders if r.queued and not r.delivered]

    async def on_session_start(self) -> list[Reminder]:
        """Handle session start by returning queued reminders for delivery.

        Called when a new voice session begins. Returns all queued reminders
        so they can be delivered within 60 seconds of session start.

        Returns:
            List of queued reminders to deliver.
        """
        self.session_active = True
        self._session_start_time = datetime.now(timezone.utc)
        return await self.get_queued_reminders()

    async def on_session_end(self) -> None:
        """Handle session end, marking session as inactive."""
        self.session_active = False
