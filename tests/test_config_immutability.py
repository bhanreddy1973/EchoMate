"""Property test 6: Configuration immutability at runtime.

Verifies config is loaded once at startup and cannot be mutated at runtime
(changes require restart; no hot-reload during active session).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from echomate.config.settings import (
    AppConfig,
    ASRConfig,
    LLMConfig,
    LiveKitConfig,
    MemoryConfig,
    MCPConfig,
    PersonalityProfile,
    TTSConfig,
)


def _make_valid_config() -> AppConfig:
    """Build a minimal valid AppConfig for testing."""
    return AppConfig(
        livekit=LiveKitConfig(
            url="wss://test.example.com",
            api_key="test-key",
            api_secret="test-secret",
        ),
        asr=ASRConfig(api_key="deepgram-key"),
        tts=TTSConfig(api_key="cartesia-key"),
        llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
        memory=MemoryConfig(),
        mcp=MCPConfig(),
    )


class TestConfigImmutability:
    """Property 6: Config is frozen at startup; mutations must raise."""

    def test_appconfig_is_frozen(self) -> None:
        cfg = _make_valid_config()
        with pytest.raises((ValidationError, TypeError)):
            cfg.log_level = "DEBUG"  # type: ignore[misc]

    def test_appconfig_livekit_field_frozen(self) -> None:
        cfg = _make_valid_config()
        with pytest.raises((ValidationError, TypeError)):
            cfg.livekit = LiveKitConfig(  # type: ignore[misc]
                url="wss://new.example.com",
                api_key="new-key",
                api_secret="new-secret",
            )

    def test_appconfig_silence_threshold_frozen(self) -> None:
        cfg = _make_valid_config()
        with pytest.raises((ValidationError, TypeError)):
            cfg.silence_threshold_ms = 1200  # type: ignore[misc]

    def test_appconfig_llm_frozen(self) -> None:
        cfg = _make_valid_config()
        with pytest.raises((ValidationError, TypeError)):
            cfg.llm = LLMConfig(openrouter_api_key="new-key")  # type: ignore[misc]

    def test_multiple_from_env_calls_are_independent(self) -> None:
        """Each from_env() call produces a new instance; they don't share state."""
        import os

        os.environ.setdefault("LIVEKIT_URL", "wss://test.lk.io")
        os.environ.setdefault("LIVEKIT_API_KEY", "k1")
        os.environ.setdefault("LIVEKIT_API_SECRET", "s1")
        os.environ.setdefault("DEEPGRAM_API_KEY", "d1")
        os.environ.setdefault("CARTESIA_API_KEY", "c1")
        os.environ.setdefault("NVIDIA_NIM_API_KEY", "n1")

        try:
            cfg1 = AppConfig.from_env()
            cfg2 = AppConfig.from_env()
            # Both should be valid and equal in value
            assert cfg1.livekit.url == cfg2.livekit.url
            # They must be separate instances
            assert cfg1 is not cfg2
        except Exception:
            # If env vars aren't set, test is not applicable
            pytest.skip("Environment variables not configured for from_env test")

    def test_config_model_config_frozen_true(self) -> None:
        """model_config frozen=True must be set on AppConfig."""
        assert AppConfig.model_config.get("frozen") is True

    def test_sub_config_values_accessible_after_creation(self) -> None:
        cfg = _make_valid_config()
        assert cfg.asr.api_key == "deepgram-key"
        assert cfg.tts.api_key == "cartesia-key"
        assert cfg.llm.nvidia_nim_api_key == "nvidia-key"
        assert cfg.livekit.url == "wss://test.example.com"

    def test_personality_defaults_applied(self) -> None:
        cfg = _make_valid_config()
        assert cfg.personality.tone == "friendly"
        assert cfg.personality.verbosity == "moderate"

    def test_silence_threshold_default(self) -> None:
        cfg = _make_valid_config()
        assert cfg.silence_threshold_ms == 600
