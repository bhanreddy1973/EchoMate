"""Personality management for EchoMate Voice Companion.

Loads, applies, and evolves the personality profile that shapes how the
assistant communicates. The PersonalityManager generates system prompt
fragments, handles runtime preference updates, and persists changes to
long-term memory.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from echomate.config.settings import PersonalityProfile

if TYPE_CHECKING:
    from echomate.memory import MemoryManager

logger = logging.getLogger(__name__)

__all__ = ["PersonalityManager"]

# Default profile applied when configuration is missing or invalid.
_DEFAULT_PROFILE = PersonalityProfile(
    tone="friendly",
    verbosity="moderate",
    humor_enabled=True,
    formal_address=False,
    proactive_suggestions=True,
)

# Mapping of verbosity levels to response length instructions.
_VERBOSITY_INSTRUCTIONS: dict[str, str] = {
    "brief": "Keep responses to 2 sentences or fewer",
    "moderate": "Keep responses to 3-5 sentences",
    "detailed": "Provide detailed responses of 6+ sentences when warranted",
}

# Simple keyword-based preference parsing rules.
# Each entry maps a set of trigger phrases to the profile field and new value.
_PREFERENCE_RULES: list[tuple[list[str], str, object]] = [
    # Verbosity preferences
    (["more concise", "shorter", "brief", "less verbose", "keep it short"], "verbosity", "brief"),
    (["more detail", "elaborate", "longer", "verbose", "detailed"], "verbosity", "detailed"),
    (["moderate length", "medium length", "normal length"], "verbosity", "moderate"),
    # Tone preferences
    (["friendlier", "friendly", "warmer", "more warm"], "tone", "friendly"),
    (["more professional", "formal tone", "business-like"], "tone", "professional"),
    (["more casual", "relaxed", "laid back", "chill"], "tone", "casual"),
    # Humor preferences
    (["more humor", "be funny", "use humor", "add jokes"], "humor_enabled", True),
    (["no humor", "less humor", "no jokes", "be serious", "stop joking"], "humor_enabled", False),
    # Formality preferences
    (["formal address", "use formal", "be formal", "sir", "ma'am"], "formal_address", True),
    (["informal", "no formalities", "drop formalities", "first name"], "formal_address", False),
    # Proactiveness preferences
    (["more proactive", "suggest things", "offer suggestions"], "proactive_suggestions", True),
    (["less proactive", "don't suggest", "no suggestions", "just answer"], "proactive_suggestions", False),
]


class PersonalityManager:
    """Loads, applies, and evolves the personality profile.

    Generates personality-based system prompt fragments for the LLM,
    parses user preference requests, and persists profile changes to
    long-term memory via the MemoryManager.

    Args:
        profile: The personality profile to use. If None or invalid,
            defaults are applied automatically.
        memory: Optional MemoryManager for persisting preference changes.

    Attributes:
        profile: The active PersonalityProfile instance.
    """

    def __init__(
        self,
        profile: PersonalityProfile | None = None,
        memory: MemoryManager | None = None,
    ) -> None:
        """Initialize PersonalityManager with a profile and optional memory.

        Args:
            profile: The personality profile. If None, a default profile
                with friendly tone, moderate verbosity, and default traits
                is used.
            memory: Optional MemoryManager for persisting preference changes
                to long-term memory.
        """
        if profile is None:
            logger.warning(
                "Personality profile missing; applying defaults "
                "(tone=friendly, verbosity=moderate)."
            )
            self.profile = _DEFAULT_PROFILE.model_copy()
        else:
            self.profile = profile
        self._memory = memory

    def get_system_prompt_fragment(self) -> str:
        """Generate personality instructions for the system prompt.

        Produces a multi-line instruction string that tells the LLM how to
        behave based on the active personality profile settings.

        Returns:
            A string containing personality instructions suitable for
            inclusion in a system prompt.
        """
        lines: list[str] = []

        # Tone instruction
        lines.append(f"You are a {self.profile.tone} assistant.")

        # Humor instruction
        if self.profile.humor_enabled:
            lines.append(
                "Feel free to use light humor when appropriate to make "
                "interactions enjoyable."
            )
        else:
            lines.append(
                "Keep responses straightforward without humor or jokes."
            )

        # Formality instruction
        if self.profile.formal_address:
            lines.append(
                "Use formal address and polite language in all interactions."
            )
        else:
            lines.append(
                "Use a conversational, informal style of address."
            )

        # Proactiveness instruction
        if self.profile.proactive_suggestions:
            lines.append(
                "Proactively offer helpful suggestions and follow-up actions "
                "when relevant."
            )
        else:
            lines.append(
                "Only respond to what is directly asked without offering "
                "unsolicited suggestions."
            )

        # Verbosity instruction
        lines.append(self.get_verbosity_instruction() + ".")

        return " ".join(lines)

    def get_verbosity_instruction(self) -> str:
        """Return length constraint for the current verbosity level.

        Maps the profile's verbosity setting to a concrete instruction:
        - brief: "Keep responses to 2 sentences or fewer"
        - moderate: "Keep responses to 3-5 sentences"
        - detailed: "Provide detailed responses of 6+ sentences when warranted"

        Returns:
            A string with the verbosity constraint instruction.
        """
        return _VERBOSITY_INSTRUCTIONS.get(
            self.profile.verbosity,
            _VERBOSITY_INSTRUCTIONS["moderate"],
        )

    async def update_preference(self, preference: str) -> None:
        """Update profile based on a user preference request.

        Parses the preference string using keyword matching to determine
        which profile field to update, applies the change, and persists
        it to long-term memory if a MemoryManager is available.

        Args:
            preference: A natural language preference request from the user,
                e.g., "be more concise", "use a friendlier tone".
        """
        preference_lower = preference.lower().strip()
        updated = False

        for triggers, field, value in _PREFERENCE_RULES:
            if any(trigger in preference_lower for trigger in triggers):
                old_value = getattr(self.profile, field, None)
                # Use model_copy to create a new profile with the updated field
                self.profile = self.profile.model_copy(update={field: value})
                logger.info(
                    "Personality preference updated: %s changed from %r to %r",
                    field,
                    old_value,
                    value,
                )
                updated = True
                break

        if not updated:
            logger.debug(
                "No matching preference rule for: %s",
                preference[:100],
            )
            return

        # Persist the change to long-term memory
        await self._persist_preference(preference)

    async def _persist_preference(self, preference: str) -> None:
        """Persist a preference change to long-term memory.

        Stores the preference update as a fact in long-term memory so that
        it can be recalled in future sessions.

        Args:
            preference: The original preference request text from the user.
        """
        if self._memory is None:
            logger.debug(
                "No MemoryManager configured; preference not persisted."
            )
            return

        fact = (
            f"User preference update: {preference}. "
            f"Current profile: tone={self.profile.tone}, "
            f"verbosity={self.profile.verbosity}, "
            f"humor_enabled={self.profile.humor_enabled}, "
            f"formal_address={self.profile.formal_address}, "
            f"proactive_suggestions={self.profile.proactive_suggestions}"
        )

        metadata = {"category": "preference", "source": "personality_update"}

        try:
            await self._memory.store_fact(fact, metadata)
            logger.info("Personality preference persisted to memory.")
        except Exception as e:
            logger.error("Failed to persist personality preference: %s", e)
