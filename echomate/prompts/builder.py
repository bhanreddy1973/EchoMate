"""Prompt builder for EchoMate Voice Companion.

Assembles context-aware prompts for the LLM by combining personality,
memory context, available tools, and companion state into a coherent
system prompt, and builds the final OpenAI-format message list.
"""

from __future__ import annotations

from typing import Any

from echomate.config.settings import PersonalityProfile
from echomate.models import CompanionState, MemoryContext
from echomate.personality import PersonalityManager
from echomate.prompts.templates import (
    BASE_SYSTEM_TEMPLATE,
    COMPANION_STATE_SECTION,
    EVENING_SESSION_TEMPLATE,
    MEMORY_SECTION,
    MORNING_SESSION_TEMPLATE,
    NO_MEMORY_AVAILABLE_TEMPLATE,
    PERSONALITY_SECTION,
    TOOLS_SECTION,
)

__all__ = ["PromptBuilder"]


class PromptBuilder:
    """Assembles context-aware prompts for the LLM.

    Combines personality profile, memory context, available tools, and
    companion state into a complete system prompt. Also builds the final
    OpenAI-format message list for LLM calls.

    Example usage::

        builder = PromptBuilder()
        system_prompt = builder.build_system_prompt(
            personality=profile,
            memory_context=memory_ctx,
            available_tools=tools,
            companion_state=state,
        )
        messages = builder.build_messages(system_prompt, short_term, user_input)
    """

    def build_system_prompt(
        self,
        personality: PersonalityProfile,
        memory_context: MemoryContext,
        available_tools: list[dict[str, Any]],
        companion_state: CompanionState,
    ) -> str:
        """Build complete system prompt from all sources.

        Assembles the base identity, personality instructions, relevant
        memories, tool descriptions, and companion state into a single
        coherent system prompt string.

        Args:
            personality: The active personality profile defining tone,
                verbosity, and behavioral traits.
            memory_context: Combined memory context containing relevant
                long-term memory entries for RAG augmentation.
            available_tools: List of tool definitions in OpenAI function
                format describing available capabilities.
            companion_state: Current companion state including session
                type and pending items.

        Returns:
            A complete system prompt string ready for use as the system
            message in an LLM call.
        """
        sections: list[str] = [BASE_SYSTEM_TEMPLATE]

        # Add personality section
        personality_fragment = self._build_personality_fragment(personality)
        sections.append(
            PERSONALITY_SECTION.format(personality_fragment=personality_fragment)
        )

        # Add memory section
        memory_section = self._build_memory_section(memory_context)
        if memory_section:
            sections.append(memory_section)

        # Add tools section
        tools_section = self._build_tools_section(available_tools)
        if tools_section:
            sections.append(tools_section)

        # Add companion state section
        state_section = self._build_companion_state_section(companion_state)
        if state_section:
            sections.append(state_section)

        return "".join(sections)

    def build_messages(
        self,
        system_prompt: str,
        short_term: list[dict[str, Any]],
        user_input: str,
    ) -> list[dict[str, Any]]:
        """Assemble final message list for LLM call.

        Creates an OpenAI-format message list with the system prompt,
        followed by short-term conversation history, and ending with
        the current user input.

        Args:
            system_prompt: The assembled system prompt string.
            short_term: Recent conversation messages in OpenAI format
                (list of dicts with 'role' and 'content' keys).
            user_input: The current user utterance to respond to.

        Returns:
            A list of message dicts in OpenAI chat format:
            [system_msg, ...short_term_msgs, user_msg]
        """
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
        ]

        # Add short-term conversation history
        for msg in short_term:
            messages.append(msg)

        # Add current user input
        messages.append({"role": "user", "content": user_input})

        return messages

    def _build_personality_fragment(self, personality: PersonalityProfile) -> str:
        """Generate personality instructions from the profile.

        Args:
            personality: The active personality profile.

        Returns:
            A string containing personality instructions for the system prompt.
        """
        manager = PersonalityManager(profile=personality)
        return manager.get_system_prompt_fragment()

    def _build_memory_section(self, memory_context: MemoryContext) -> str:
        """Build the memory section of the system prompt.

        Args:
            memory_context: Combined memory context with long-term entries.

        Returns:
            Formatted memory section string, or empty string if no
            relevant memories exist.
        """
        if not memory_context.has_long_term:
            return "\n\n" + NO_MEMORY_AVAILABLE_TEMPLATE

        if not memory_context.long_term_entries:
            return ""

        entries_text = "\n".join(
            f"- {entry.text}" for entry in memory_context.long_term_entries
        )
        return MEMORY_SECTION.format(memory_entries=entries_text)

    def _build_tools_section(self, available_tools: list[dict[str, Any]]) -> str:
        """Build the tools section of the system prompt.

        Args:
            available_tools: List of tool definitions in OpenAI function format.

        Returns:
            Formatted tools section string, or empty string if no tools
            are available.
        """
        if not available_tools:
            return ""

        tool_descriptions: list[str] = []
        for tool in available_tools:
            # Handle OpenAI function format: {"type": "function", "function": {...}}
            if "function" in tool:
                func = tool["function"]
                name = func.get("name", "unknown")
                description = func.get("description", "No description available")
            else:
                # Direct format: {"name": ..., "description": ...}
                name = tool.get("name", "unknown")
                description = tool.get("description", "No description available")
            tool_descriptions.append(f"- {name}: {description}")

        tools_text = "\n".join(tool_descriptions)
        return TOOLS_SECTION.format(tools_description=tools_text)

    def _build_companion_state_section(
        self, companion_state: CompanionState
    ) -> str:
        """Build the companion state section of the system prompt.

        Args:
            companion_state: Current companion state with session type
                and pending items.

        Returns:
            Formatted companion state section string, or empty string
            if no special state is active.
        """
        state_parts: list[str] = []

        if companion_state.is_morning_session:
            state_parts.append(MORNING_SESSION_TEMPLATE)

        if companion_state.is_evening_session:
            state_parts.append(EVENING_SESSION_TEMPLATE)

        if companion_state.pending_reminders:
            reminder_count = len(companion_state.pending_reminders)
            reminder_texts = [r.text for r in companion_state.pending_reminders]
            state_parts.append(
                f"There are {reminder_count} pending reminder(s) to deliver: "
                + "; ".join(reminder_texts)
            )

        if companion_state.pending_tasks_count > 0:
            state_parts.append(
                f"The user has {companion_state.pending_tasks_count} pending task(s)."
            )

        if not state_parts:
            return ""

        state_description = "\n".join(state_parts)
        return COMPANION_STATE_SECTION.format(state_description=state_description)
