"""Tests for the TaskManager companion feature."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from echomate.companion.tasks import TaskManager
from echomate.models import Task


@pytest.fixture
def task_manager() -> TaskManager:
    """Create a TaskManager without long-term memory for testing."""
    return TaskManager(long_term_memory=None)


@pytest.fixture
def task_manager_with_ltm() -> TaskManager:
    """Create a TaskManager with a mocked long-term memory."""
    mock_ltm = MagicMock()
    mock_ltm.is_available.return_value = True
    mock_ltm.store = AsyncMock()
    return TaskManager(long_term_memory=mock_ltm)


class TestCreateTask:
    """Tests for TaskManager.create_task()."""

    @pytest.mark.asyncio
    async def test_create_task_basic(self, task_manager: TaskManager) -> None:
        """Create a task with title only."""
        task = await task_manager.create_task("Buy groceries")

        assert task.title == "Buy groceries"
        assert task.due_date is None
        assert task.completed is False
        assert task.completed_at is None
        assert task.id is not None
        assert task.created_at is not None

    @pytest.mark.asyncio
    async def test_create_task_with_due_date(self, task_manager: TaskManager) -> None:
        """Create a task with a due date."""
        due = datetime(2025, 7, 15, 10, 0, tzinfo=timezone.utc)
        task = await task_manager.create_task("Submit report", due_date=due)

        assert task.title == "Submit report"
        assert task.due_date == due

    @pytest.mark.asyncio
    async def test_create_task_truncates_long_title(self, task_manager: TaskManager) -> None:
        """Title longer than 200 characters is truncated."""
        long_title = "A" * 250
        task = await task_manager.create_task(long_title)

        assert len(task.title) == 200
        assert task.title == "A" * 200

    @pytest.mark.asyncio
    async def test_create_task_empty_title_raises(self, task_manager: TaskManager) -> None:
        """Empty title raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            await task_manager.create_task("")

    @pytest.mark.asyncio
    async def test_create_task_whitespace_title_raises(self, task_manager: TaskManager) -> None:
        """Whitespace-only title raises ValueError."""
        with pytest.raises(ValueError, match="cannot be empty"):
            await task_manager.create_task("   ")

    @pytest.mark.asyncio
    async def test_create_task_added_to_list(self, task_manager: TaskManager) -> None:
        """Created task appears in the internal task list."""
        await task_manager.create_task("Task 1")
        await task_manager.create_task("Task 2")

        assert len(task_manager.tasks) == 2

    @pytest.mark.asyncio
    async def test_create_task_persists_to_ltm(self, task_manager_with_ltm: TaskManager) -> None:
        """Task is persisted to long-term memory when available."""
        await task_manager_with_ltm.create_task("Important task")

        task_manager_with_ltm._ltm.store.assert_called_once()
        call_kwargs = task_manager_with_ltm._ltm.store.call_args
        assert "Important task" in call_kwargs[1]["text"] or "Important task" in call_kwargs[0][0]


class TestGetPendingTasks:
    """Tests for TaskManager.get_pending_tasks()."""

    @pytest.mark.asyncio
    async def test_empty_list(self, task_manager: TaskManager) -> None:
        """No tasks returns empty list."""
        result = await task_manager.get_pending_tasks()
        assert result == []

    @pytest.mark.asyncio
    async def test_excludes_completed_tasks(self, task_manager: TaskManager) -> None:
        """Completed tasks are not returned."""
        task = await task_manager.create_task("Done task")
        await task_manager.complete_task(task.id)

        result = await task_manager.get_pending_tasks()
        assert result == []

    @pytest.mark.asyncio
    async def test_includes_tasks_without_due_date(self, task_manager: TaskManager) -> None:
        """Tasks without a due date are always included."""
        await task_manager.create_task("No deadline")

        result = await task_manager.get_pending_tasks(within_hours=1)
        assert len(result) == 1
        assert result[0].title == "No deadline"

    @pytest.mark.asyncio
    async def test_includes_tasks_due_within_window(self, task_manager: TaskManager) -> None:
        """Tasks due within the time window are included."""
        due_soon = datetime.now(timezone.utc) + timedelta(hours=2)
        await task_manager.create_task("Due soon", due_date=due_soon)

        result = await task_manager.get_pending_tasks(within_hours=24)
        assert len(result) == 1
        assert result[0].title == "Due soon"

    @pytest.mark.asyncio
    async def test_excludes_tasks_due_after_window(self, task_manager: TaskManager) -> None:
        """Tasks due after the time window are excluded."""
        due_later = datetime.now(timezone.utc) + timedelta(hours=48)
        await task_manager.create_task("Due later", due_date=due_later)

        result = await task_manager.get_pending_tasks(within_hours=24)
        assert result == []

    @pytest.mark.asyncio
    async def test_sorted_by_due_date(self, task_manager: TaskManager) -> None:
        """Results are sorted by due date, earliest first."""
        now = datetime.now(timezone.utc)
        await task_manager.create_task("Later", due_date=now + timedelta(hours=10))
        await task_manager.create_task("Sooner", due_date=now + timedelta(hours=2))
        await task_manager.create_task("No due date")

        result = await task_manager.get_pending_tasks(within_hours=24)
        assert len(result) == 3
        assert result[0].title == "Sooner"
        assert result[1].title == "Later"
        assert result[2].title == "No due date"

    @pytest.mark.asyncio
    async def test_includes_overdue_tasks(self, task_manager: TaskManager) -> None:
        """Tasks that are already overdue are included (due_date <= cutoff)."""
        overdue = datetime.now(timezone.utc) - timedelta(hours=2)
        await task_manager.create_task("Overdue", due_date=overdue)

        result = await task_manager.get_pending_tasks(within_hours=24)
        assert len(result) == 1
        assert result[0].title == "Overdue"


class TestCompleteTask:
    """Tests for TaskManager.complete_task()."""

    @pytest.mark.asyncio
    async def test_complete_task_success(self, task_manager: TaskManager) -> None:
        """Completing a task sets completed=True and completed_at."""
        task = await task_manager.create_task("Finish feature")
        completed = await task_manager.complete_task(task.id)

        assert completed.completed is True
        assert completed.completed_at is not None
        assert completed.id == task.id

    @pytest.mark.asyncio
    async def test_complete_task_not_found(self, task_manager: TaskManager) -> None:
        """Completing a non-existent task raises ValueError."""
        with pytest.raises(ValueError, match="Task not found"):
            await task_manager.complete_task("non-existent-id")

    @pytest.mark.asyncio
    async def test_complete_task_already_completed(self, task_manager: TaskManager) -> None:
        """Completing an already-completed task raises ValueError."""
        task = await task_manager.create_task("Already done")
        await task_manager.complete_task(task.id)

        with pytest.raises(ValueError, match="already completed"):
            await task_manager.complete_task(task.id)

    @pytest.mark.asyncio
    async def test_complete_task_persists_to_ltm(self, task_manager_with_ltm: TaskManager) -> None:
        """Completing a task persists the completion to long-term memory."""
        task = await task_manager_with_ltm.create_task("Task to complete")
        await task_manager_with_ltm.complete_task(task.id)

        # store called twice: once for creation, once for completion
        assert task_manager_with_ltm._ltm.store.call_count == 2
