"""Evening Reflection companion feature.

Summarizes completed tasks, recaps today's conversations, and suggests
improvements based on 7-day habit trends.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from echomate.companion.habits import HabitTracker
from echomate.companion.tasks import TaskManager

logger = logging.getLogger(__name__)


class EveningReflection:
    """Generates evening reflection summaries.

    Summarizes completed tasks, provides a narrative of today's activity,
    and suggests up to three improvements from 7-day habit trends.

    Args:
        task_manager: TaskManager for fetching completed tasks.
        habit_tracker: HabitTracker for trend analysis.
    """

    def __init__(self, task_manager: TaskManager, habit_tracker: HabitTracker) -> None:
        self._tasks = task_manager
        self._habits = habit_tracker

    async def generate(self) -> dict[str, object]:
        """Generate an evening reflection summary.

        Collects tasks completed since this morning, analyzes 7-day habit
        trends, and produces up to 3 improvement suggestions.

        Returns:
            dict with keys:
                - completed_today: list of task title strings completed today
                - habit_trends: dict mapping habit name to completion count over 7 days
                - suggestions: list of up to 3 improvement suggestion strings
        """
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        completed_today = [
            t.title
            for t in self._tasks.tasks
            if t.completed
            and t.completed_at is not None
            and t.completed_at >= today_start
        ]

        trends = await self._habits.get_trends(days=7)
        habit_counts = {name: len(times) for name, times in trends.items()}

        suggestions = self._generate_suggestions(habit_counts, completed_today)

        return {
            "completed_today": completed_today,
            "habit_trends": habit_counts,
            "suggestions": suggestions[:3],
        }

    def _generate_suggestions(
        self, habit_counts: dict[str, int], completed_today: list[str]
    ) -> list[str]:
        """Build improvement suggestions from habit consistency data.

        Args:
            habit_counts: Mapping of habit name to completions in last 7 days.
            completed_today: Titles of tasks completed today.

        Returns:
            List of suggestion strings (may be empty if data is sparse).
        """
        suggestions: list[str] = []

        for habit, count in habit_counts.items():
            if count < 3:
                suggestions.append(
                    f"Try to be more consistent with '{habit}' — only {count}/7 days this week."
                )
            elif count == 7:
                suggestions.append(
                    f"Great work keeping up '{habit}' every day this week!"
                )

        if not completed_today:
            suggestions.append("Consider setting at least one task to tackle tomorrow morning.")

        return suggestions
