"""Unit tests for the PersonalityManager module."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from echomate.config.settings import PersonalityProfile
from echomate.personality import PersonalityManager


class TestPersonalityManagerDefaults:
    """Tests for default profile handling."""

    def test_none_profile_uses_defaults(self) -> None:
        """When profile is None, default friendly/moderate profile is used."""
        pm = PersonalityManager(profile=None)
        assert pm.profile.tone == "friendly"
        assert pm.profile.verbosity == "moderate"
        assert pm.profile.humor_enabled is True
        assert pm.profile.formal_address is False
        assert pm.profile.proactive_suggestions is True

    def test_explicit_profile_is_used(self) -> None:
        """When a valid profile is provided, it is used as-is."""
        profile = PersonalityProfile(
            tone="professional",
            verbosity="brief",
            humor_enabled=False,
            formal_address=True,
            proactive_suggestions=False,
        )
        pm = PersonalityManager(profile=profile)
        assert pm.profile.tone == "professional"
        assert pm.profile.verbosity == "brief"
        assert pm.profile.humor_enabled is False


class TestGetVerbosityInstruction:
    """Tests for get_verbosity_instruction method."""

    def test_brief_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(verbosity="brief"))
        assert pm.get_verbosity_instruction() == "Keep responses to 2 sentences or fewer"

    def test_moderate_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(verbosity="moderate"))
        assert pm.get_verbosity_instruction() == "Keep responses to 3-5 sentences"

    def test_detailed_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(verbosity="detailed"))
        assert pm.get_verbosity_instruction() == "Provide detailed responses of 6+ sentences when warranted"


class TestGetSystemPromptFragment:
    """Tests for get_system_prompt_fragment method."""

    def test_contains_tone(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(tone="casual"))
        fragment = pm.get_system_prompt_fragment()
        assert "casual assistant" in fragment

    def test_humor_enabled_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(humor_enabled=True))
        fragment = pm.get_system_prompt_fragment()
        assert "humor" in fragment.lower()

    def test_humor_disabled_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(humor_enabled=False))
        fragment = pm.get_system_prompt_fragment()
        assert "without humor" in fragment.lower()

    def test_formal_address_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(formal_address=True))
        fragment = pm.get_system_prompt_fragment()
        assert "formal" in fragment.lower()

    def test_informal_address_instruction(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(formal_address=False))
        fragment = pm.get_system_prompt_fragment()
        assert "informal" in fragment.lower() or "conversational" in fragment.lower()

    def test_proactive_enabled(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(proactive_suggestions=True))
        fragment = pm.get_system_prompt_fragment()
        assert "suggest" in fragment.lower()

    def test_proactive_disabled(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(proactive_suggestions=False))
        fragment = pm.get_system_prompt_fragment()
        assert "directly asked" in fragment.lower()

    def test_verbosity_in_fragment(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(verbosity="brief"))
        fragment = pm.get_system_prompt_fragment()
        assert "2 sentences or fewer" in fragment


class TestUpdatePreference:
    """Tests for update_preference method."""

    @pytest.mark.asyncio
    async def test_concise_updates_verbosity_to_brief(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(verbosity="moderate"))
        await pm.update_preference("be more concise")
        assert pm.profile.verbosity == "brief"

    @pytest.mark.asyncio
    async def test_detailed_updates_verbosity(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(verbosity="moderate"))
        await pm.update_preference("give me more detail")
        assert pm.profile.verbosity == "detailed"

    @pytest.mark.asyncio
    async def test_friendly_tone_update(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(tone="professional"))
        await pm.update_preference("use a friendlier tone")
        assert pm.profile.tone == "friendly"

    @pytest.mark.asyncio
    async def test_professional_tone_update(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(tone="friendly"))
        await pm.update_preference("be more professional")
        assert pm.profile.tone == "professional"

    @pytest.mark.asyncio
    async def test_casual_tone_update(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(tone="friendly"))
        await pm.update_preference("be more casual")
        assert pm.profile.tone == "casual"

    @pytest.mark.asyncio
    async def test_disable_humor(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(humor_enabled=True))
        await pm.update_preference("no jokes please")
        assert pm.profile.humor_enabled is False

    @pytest.mark.asyncio
    async def test_enable_humor(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(humor_enabled=False))
        await pm.update_preference("use humor")
        assert pm.profile.humor_enabled is True

    @pytest.mark.asyncio
    async def test_unrecognized_preference_no_change(self) -> None:
        pm = PersonalityManager(profile=PersonalityProfile(tone="friendly"))
        await pm.update_preference("something completely unrelated")
        assert pm.profile.tone == "friendly"

    @pytest.mark.asyncio
    async def test_persists_to_memory(self) -> None:
        """When a MemoryManager is provided, preferences are persisted."""
        mock_memory = MagicMock()
        mock_memory.store_fact = AsyncMock()
        pm = PersonalityManager(
            profile=PersonalityProfile(verbosity="moderate"),
            memory=mock_memory,
        )
        await pm.update_preference("be more concise")
        mock_memory.store_fact.assert_called_once()
        call_args = mock_memory.store_fact.call_args
        # store_fact is called as store_fact(fact, metadata) with positional args
        fact_text = call_args[0][0]
        metadata = call_args[0][1]
        assert "preference" in metadata["category"]
        assert "concise" in fact_text.lower() or "verbosity" in fact_text.lower()

    @pytest.mark.asyncio
    async def test_no_persist_without_memory(self) -> None:
        """Without a MemoryManager, preferences are not persisted but still applied."""
        pm = PersonalityManager(
            profile=PersonalityProfile(verbosity="moderate"),
            memory=None,
        )
        await pm.update_preference("be more concise")
        assert pm.profile.verbosity == "brief"
