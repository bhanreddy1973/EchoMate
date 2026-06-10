"""Habit Tracker companion feature.

Records habit completions and provides trend analysis over configurable
time windows. Habit entries are stored in long-term memory for persistence.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from echomate.models import HabitEntry


class HabitTracker:
    """Records and analyzes habit completions.

    Maintains an internal list of HabitEntry objects. Each entry stores
    the habit name and a UTC timestamp of when it was recorded.

    Attributes:
        entries: Internal list of all recorded habit entries.
    """

    def __init__(self) -> None:
        """Initialize the HabitTracker with an empty entries list."""
        self.entries: list[HabitEntry] = []

    async def record_habit(self, habit_name: str) -> None:
        """Record a habit completion with the current UTC timestamp.

        Creates a new HabitEntry with the given habit name and the current
        datetime, then appends it to the internal entries list (long-term memory).

        Args:
            habit_name: The name of the habit being recorded (e.g., "exercise",
                "meditation", "reading").
        """
        entry = HabitEntry(
            habit_name=habit_name,
            completed_at=datetime.now(timezone.utc),
        )
        self.entries.append(entry)

    async def get_trends(self, days: int = 7) -> dict[str, list[datetime]]:
        """Return completion history per habit within the last N days.

        Filters entries to those completed within the specified number of days
        from now, then groups them by habit name.

        Args:
            days: Number of days to look back for trend data. Defaults to 7.

        Returns:
            A dictionary mapping habit names to lists of completion timestamps
            within the specified time window. Only habits with at least one
            completion in the window are included.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        trends: dict[str, list[datetime]] = {}

        for entry in self.entries:
            if entry.completed_at >= cutoff:
                if entry.habit_name not in trends:
                    trends[entry.habit_name] = []
                trends[entry.habit_name].append(entry.completed_at)

        return trends
