"""Unit tests for the PromptBuilder module."""

from __future__ import annotations

from datetime import datetime

import pytest

from echomate.config.settings import PersonalityProfile
from echomate.models import CompanionState, MemoryContext, MemoryEntry, Reminder
from echomate.prompts.builder import PromptBuilder


@pytest.fixture
def builder() -> PromptBuilder:
    """Create a PromptBuilder instance for testing."""
    return PromptBuilder()


@pytest.fixture
def default_profile() -> PersonalityProfile:
    """Create a default personality profile."""
    return PersonalityProfile()


@pytest.fixture
def memory_context_with_entries() -> MemoryContext:
    """Create a MemoryContext with long-term entries."""
    return MemoryContext(
        short_term_messages=[],
        long_term_entries=[
            MemoryEntry(
                id="1",
                text="User prefers coffee over tea",
                category="preference",
                timestamp=datetime(2024, 1, 15, 10, 0, 0),
            ),
            MemoryEntry(
                id="2",
                text="User has a dog named Max",
                category="fact",
                timestamp=datetime(2024, 1, 14, 9, 0, 0),
            ),
        ],
        has_long_term=True,
    )


@pytest.fixture
def sample_tools() -> list[dict]:
    """Create sample tool definitions in OpenAI function format."""
    return [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get current weather for a location",
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_task",
                "description": "Create a new task with title and due date",
            },
        },
    ]


class TestBuildSystemPrompt:
    """Tests for build_system_prompt method."""

    def test_contains_base_identity(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt always contains the base EchoMate identity."""
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], CompanionState()
        )
        assert "EchoMate" in prompt
        assert "voice" in prompt.lower()

    def test_contains_personality_section(self, builder: PromptBuilder) -> None:
        """System prompt includes personality instructions."""
        profile = PersonalityProfile(tone="professional", verbosity="brief")
        prompt = builder.build_system_prompt(
            profile, MemoryContext(), [], CompanionState()
        )
        assert "Personality" in prompt
        assert "professional" in prompt

    def test_contains_memory_entries(
        self, builder: PromptBuilder, default_profile: PersonalityProfile, memory_context_with_entries: MemoryContext
    ) -> None:
        """System prompt includes relevant memory entries when available."""
        prompt = builder.build_system_prompt(
            default_profile, memory_context_with_entries, [], CompanionState()
        )
        assert "Relevant Memories" in prompt
        assert "User prefers coffee over tea" in prompt
        assert "User has a dog named Max" in prompt

    def test_no_memory_section_when_empty(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt omits memory section when no entries exist."""
        memory_ctx = MemoryContext(long_term_entries=[], has_long_term=True)
        prompt = builder.build_system_prompt(
            default_profile, memory_ctx, [], CompanionState()
        )
        assert "Relevant Memories" not in prompt

    def test_memory_unavailable_notice(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """When long-term memory is unavailable, a notice is included."""
        memory_ctx = MemoryContext(has_long_term=False)
        prompt = builder.build_system_prompt(
            default_profile, memory_ctx, [], CompanionState()
        )
        assert "Long-term memory is currently unavailable" in prompt

    def test_contains_tools_section(
        self, builder: PromptBuilder, default_profile: PersonalityProfile, sample_tools: list[dict]
    ) -> None:
        """System prompt includes tool descriptions when tools are available."""
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), sample_tools, CompanionState()
        )
        assert "Available Tools" in prompt
        assert "get_weather" in prompt
        assert "create_task" in prompt

    def test_no_tools_section_when_empty(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt omits tools section when no tools are available."""
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], CompanionState()
        )
        assert "Available Tools" not in prompt

    def test_tools_direct_format(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt handles tools in direct name/description format."""
        tools = [{"name": "set_timer", "description": "Set a countdown timer"}]
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), tools, CompanionState()
        )
        assert "set_timer" in prompt
        assert "Set a countdown timer" in prompt

    def test_morning_session_state(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt includes morning session context."""
        state = CompanionState(is_morning_session=True)
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], state
        )
        assert "morning session" in prompt.lower()

    def test_evening_session_state(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt includes evening session context."""
        state = CompanionState(is_evening_session=True)
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], state
        )
        assert "evening session" in prompt.lower()

    def test_pending_reminders_in_state(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt includes pending reminders."""
        state = CompanionState(
            pending_reminders=[
                Reminder(id="r1", text="Call doctor", trigger_time=datetime.now()),
            ]
        )
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], state
        )
        assert "Call doctor" in prompt
        assert "1 pending reminder" in prompt

    def test_pending_tasks_in_state(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt includes pending tasks count."""
        state = CompanionState(pending_tasks_count=5)
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], state
        )
        assert "5 pending task" in prompt

    def test_no_state_section_when_inactive(self, builder: PromptBuilder, default_profile: PersonalityProfile) -> None:
        """System prompt omits state section when nothing is active."""
        prompt = builder.build_system_prompt(
            default_profile, MemoryContext(), [], CompanionState()
        )
        assert "Current Context" not in prompt


class TestBuildMessages:
    """Tests for build_messages method."""

    def test_message_structure(self, builder: PromptBuilder) -> None:
        """Messages list starts with system, ends with user."""
        messages = builder.build_messages("You are helpful.", [], "Hello!")
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[0]["content"] == "You are helpful."
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == "Hello!"

    def test_includes_short_term_history(self, builder: PromptBuilder) -> None:
        """Messages list includes short-term conversation history in order."""
        short_term = [
            {"role": "user", "content": "Hi there"},
            {"role": "assistant", "content": "Hello! How can I help?"},
        ]
        messages = builder.build_messages("System prompt", short_term, "What time is it?")
        assert len(messages) == 4
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert messages[1]["content"] == "Hi there"
        assert messages[2]["role"] == "assistant"
        assert messages[2]["content"] == "Hello! How can I help?"
        assert messages[3]["role"] == "user"
        assert messages[3]["content"] == "What time is it?"

    def test_empty_short_term(self, builder: PromptBuilder) -> None:
        """Messages list works with empty short-term history."""
        messages = builder.build_messages("System prompt", [], "First message")
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert messages[1]["content"] == "First message"

    def test_preserves_message_format(self, builder: PromptBuilder) -> None:
        """Short-term messages are preserved as-is without modification."""
        short_term = [
            {"role": "user", "content": "msg1", "name": "custom_field"},
        ]
        messages = builder.build_messages("System", short_term, "msg2")
        assert messages[1] == {"role": "user", "content": "msg1", "name": "custom_field"}
