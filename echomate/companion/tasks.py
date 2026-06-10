"""Task Manager module for EchoMate companion features.

Provides CRUD operations for user tasks with in-memory storage and optional
persistence to long-term memory via the LongTermMemory module.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from echomate.memory.long_term import LongTermMemory
from echomate.models import Task

logger = logging.getLogger(__name__)


class TaskManager:
    """CRUD operations for user tasks, stored in memory.

    Maintains a local list of Task objects and optionally persists them to
    LongTermMemory for cross-session retrieval.

    Args:
        long_term_memory: Optional LongTermMemory instance for persistence.
            If None, tasks are stored in-memory only and will not survive
            application restarts.

    Attributes:
        tasks: In-memory list of all tasks managed by this instance.
    """

    def __init__(self, long_term_memory: LongTermMemory | None = None) -> None:
        """Initialize the TaskManager.

        Args:
            long_term_memory: Optional LongTermMemory instance for persisting
                tasks to the vector database.
        """
        self.tasks: list[Task] = []
        self._ltm = long_term_memory

    async def create_task(self, title: str, due_date: datetime | None = None) -> Task:
        """Create a new task with a title and optional due date.

        The title is truncated to 200 characters if it exceeds that limit.
        The task is stored in the local task list and optionally persisted
        to long-term memory.

        Args:
            title: The task description (maximum 200 characters).
            due_date: Optional deadline for the task. Should be timezone-aware.

        Returns:
            The newly created Task instance.

        Raises:
            ValueError: If the title is empty or contains only whitespace.
        """
        if not title or not title.strip():
            raise ValueError("Task title cannot be empty")

        # Truncate title to 200 characters as per requirement 7.3
        truncated_title = title[:200]

        task = Task(
            id=str(uuid.uuid4()),
            title=truncated_title,
            due_date=due_date,
            completed=False,
            completed_at=None,
            created_at=datetime.now(timezone.utc),
        )

        self.tasks.append(task)

        # Persist to long-term memory if available
        if self._ltm is not None and self._ltm.is_available():
            due_str = due_date.isoformat() if due_date else "none"
            await self._ltm.store(
                text=f"Task: {truncated_title} (due: {due_str})",
                metadata={
                    "category": "task",
                    "task_id": task.id,
                    "due_date": due_str,
                    "completed": False,
                },
            )

        logger.info(
            "Task created",
            extra={"task_id": task.id, "title": truncated_title},
        )
        return task

    async def get_pending_tasks(self, within_hours: int = 24) -> list[Task]:
        """Retrieve pending (incomplete) tasks within a time window.

        Returns tasks that are not completed and either have no due date
        or have a due date within the specified number of hours from now.

        Args:
            within_hours: Number of hours from now to look ahead for due tasks.
                Defaults to 24. Tasks with no due date are always included.

        Returns:
            List of pending Task objects sorted by due date (earliest first),
            with tasks having no due date appearing last.
        """
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=within_hours)

        pending: list[Task] = []
        for task in self.tasks:
            if task.completed:
                continue

            # Include tasks with no due date or due within the window
            if task.due_date is None:
                pending.append(task)
            elif task.due_date <= cutoff:
                pending.append(task)

        # Sort: tasks with due dates first (earliest first), then no-due-date tasks
        pending.sort(
            key=lambda t: (t.due_date is None, t.due_date or datetime.max.replace(tzinfo=timezone.utc))
        )

        logger.debug(
            "Retrieved pending tasks",
            extra={"count": len(pending), "within_hours": within_hours},
        )
        return pending

    async def complete_task(self, task_id: str) -> Task:
        """Mark a task as completed by its ID.

        Updates the task's completed status and records the completion timestamp.
        Also updates the task record in long-term memory if available.

        Args:
            task_id: The unique identifier of the task to complete.

        Returns:
            The updated Task instance with completed=True and completed_at set.

        Raises:
            ValueError: If no task with the given ID exists.
            ValueError: If the task is already completed.
        """
        task = self._find_task(task_id)

        if task is None:
            raise ValueError(f"Task not found: {task_id}")

        if task.completed:
            raise ValueError(f"Task already completed: {task_id}")

        task.completed = True
        task.completed_at = datetime.now(timezone.utc)

        # Update in long-term memory if available
        if self._ltm is not None and self._ltm.is_available():
            await self._ltm.store(
                text=f"Completed task: {task.title}",
                metadata={
                    "category": "task",
                    "task_id": task.id,
                    "completed": True,
                    "completed_at": task.completed_at.isoformat(),
                },
            )

        logger.info(
            "Task completed",
            extra={"task_id": task_id, "title": task.title},
        )
        return task

    def _find_task(self, task_id: str) -> Task | None:
        """Find a task by its ID in the local task list.

        Args:
            task_id: The unique identifier of the task to find.

        Returns:
            The matching Task instance, or None if not found.
        """
        for task in self.tasks:
            if task.id == task_id:
                return task
        return None
