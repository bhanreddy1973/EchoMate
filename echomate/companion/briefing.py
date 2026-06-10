"""Morning Briefing companion feature.

Generates a contextual morning summary from pending tasks, calendar events,
weather, and upcoming reminders. Handles unavailable MCP tools gracefully
by delivering partial briefings with notes on missing sources.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from echomate.companion.reminders import ReminderScheduler
from echomate.companion.tasks import TaskManager

logger = logging.getLogger(__name__)


class MorningBriefing:
    """Generates morning briefing summaries from multiple data sources.

    Collects pending tasks, upcoming reminders, and optionally fetches
    calendar events and weather via MCP tools. Always delivers a partial
    briefing even when MCP tools are unavailable.

    Args:
        task_manager: TaskManager for fetching pending tasks.
        reminder_scheduler: ReminderScheduler for upcoming reminders.
        mcp_tool_caller: Optional async callable(tool_name, args) for MCP calls.
    """

    def __init__(
        self,
        task_manager: TaskManager,
        reminder_scheduler: ReminderScheduler,
        mcp_tool_caller: object | None = None,
    ) -> None:
        self._tasks = task_manager
        self._reminders = reminder_scheduler
        self._mcp = mcp_tool_caller

    async def generate(self) -> dict[str, object]:
        """Generate a morning briefing with all available data sources.

        Gathers pending tasks (24h window), upcoming reminders (12h window),
        and optionally calendar events and weather from MCP tools. Missing
        sources are indicated rather than causing failure.

        Returns:
            dict with keys:
                - pending_tasks: list of task title strings
                - upcoming_reminders: list of reminder text strings
                - calendar_events: list of event strings, or None if unavailable
                - weather: weather string, or None if unavailable
                - missing_sources: list of source names that could not be fetched
        """
        missing: list[str] = []

        # Core data — always available
        pending_tasks = await self._tasks.get_pending_tasks(within_hours=24)
        task_titles = [t.title for t in pending_tasks]

        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=12)
        upcoming_reminders = [
            r
            for r in self._reminders.reminders
            if not r.delivered
            and r.trigger_time.replace(tzinfo=timezone.utc if r.trigger_time.tzinfo is None else r.trigger_time.tzinfo) <= cutoff
        ]
        reminder_texts = [r.text for r in upcoming_reminders]

        # Optional MCP data
        calendar_events: list[str] | None = None
        weather: str | None = None

        if self._mcp is not None:
            try:
                cal_result = await self._mcp("get_calendar_events", {"hours_ahead": 12})  # type: ignore[operator]
                if isinstance(cal_result, list):
                    calendar_events = [str(e) for e in cal_result]
                elif isinstance(cal_result, dict) and "events" in cal_result:
                    calendar_events = [str(e) for e in cal_result["events"]]
            except Exception as e:
                logger.warning("Calendar MCP tool unavailable: %s", e)
                missing.append("calendar")

            try:
                wx_result = await self._mcp("get_weather", {})  # type: ignore[operator]
                weather = str(wx_result) if wx_result else None
            except Exception as e:
                logger.warning("Weather MCP tool unavailable: %s", e)
                missing.append("weather")
        else:
            missing.extend(["calendar", "weather"])

        return {
            "pending_tasks": task_titles,
            "upcoming_reminders": reminder_texts,
            "calendar_events": calendar_events,
            "weather": weather,
            "missing_sources": missing,
        }
