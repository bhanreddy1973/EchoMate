"""Unit tests for EchoMate configuration models."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from echomate.config.settings import (
    AppConfig,
    ASRConfig,
    LLMConfig,
    LiveKitConfig,
    MCPConfig,
    MemoryConfig,
    PersonalityProfile,
    TTSConfig,
)


class TestASRConfig:
    """Tests for ASR configuration validation."""

    def test_valid_config(self) -> None:
        config = ASRConfig(provider="deepgram", api_key="test-key-123")
        assert config.provider == "deepgram"
        assert config.api_key == "test-key-123"
        assert config.model == "nova-2"
        assert config.language == "en"

    def test_empty_api_key_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="ASR api_key is required"):
            ASRConfig(api_key="")

    def test_whitespace_api_key_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="ASR api_key is required"):
            ASRConfig(api_key="   ")

    def test_invalid_provider_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            ASRConfig(provider="invalid_provider", api_key="test-key")  # type: ignore[arg-type]

    def test_assemblyai_provider(self) -> None:
        config = ASRConfig(provider="assemblyai", api_key="test-key")
        assert config.provider == "assemblyai"


class TestTTSConfig:
    """Tests for TTS configuration validation."""

    def test_valid_config(self) -> None:
        config = TTSConfig(provider="cartesia", api_key="test-key-456")
        assert config.provider == "cartesia"
        assert config.api_key == "test-key-456"
        assert config.voice_id == "default"
        assert config.speed == 1.0

    def test_empty_api_key_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="TTS api_key is required"):
            TTSConfig(api_key="")

    def test_invalid_provider_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            TTSConfig(provider="unknown", api_key="test-key")  # type: ignore[arg-type]

    def test_speed_below_minimum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            TTSConfig(api_key="test-key", speed=0.05)

    def test_speed_above_maximum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            TTSConfig(api_key="test-key", speed=6.0)

    def test_elevenlabs_provider(self) -> None:
        config = TTSConfig(provider="elevenlabs", api_key="test-key")
        assert config.provider == "elevenlabs"


class TestLLMConfig:
    """Tests for LLM configuration validation."""

    def test_valid_with_nvidia_key(self) -> None:
        config = LLMConfig(nvidia_nim_api_key="nvidia-key-123")
        assert config.nvidia_nim_api_key == "nvidia-key-123"
        assert config.openrouter_api_key == ""
        assert config.default_tier == "fast"
        assert config.timeout_seconds == 5
        assert config.max_fallback_attempts == 3

    def test_valid_with_openrouter_key(self) -> None:
        config = LLMConfig(openrouter_api_key="openrouter-key-456")
        assert config.openrouter_api_key == "openrouter-key-456"

    def test_valid_with_both_keys(self) -> None:
        config = LLMConfig(
            nvidia_nim_api_key="nvidia-key", openrouter_api_key="openrouter-key"
        )
        assert config.nvidia_nim_api_key == "nvidia-key"
        assert config.openrouter_api_key == "openrouter-key"

    def test_no_provider_keys_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="At least one LLM provider API key"):
            LLMConfig()

    def test_invalid_tier_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            LLMConfig(nvidia_nim_api_key="key", default_tier="invalid")  # type: ignore[arg-type]

    def test_timeout_below_minimum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            LLMConfig(nvidia_nim_api_key="key", timeout_seconds=0)

    def test_max_fallback_below_minimum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            LLMConfig(nvidia_nim_api_key="key", max_fallback_attempts=0)


class TestMemoryConfig:
    """Tests for Memory configuration validation."""

    def test_defaults(self) -> None:
        config = MemoryConfig()
        assert config.chroma_persist_dir == "./data/chroma"
        assert config.short_term_token_limit == 4000
        assert config.long_term_top_k == 5
        assert config.min_similarity_score == 0.7

    def test_custom_values(self) -> None:
        config = MemoryConfig(
            chroma_persist_dir="/custom/path",
            short_term_token_limit=8000,
            long_term_top_k=10,
            min_similarity_score=0.5,
        )
        assert config.chroma_persist_dir == "/custom/path"
        assert config.short_term_token_limit == 8000
        assert config.long_term_top_k == 10
        assert config.min_similarity_score == 0.5

    def test_similarity_score_out_of_range_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            MemoryConfig(min_similarity_score=1.5)

    def test_negative_similarity_score_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            MemoryConfig(min_similarity_score=-0.1)


class TestMCPConfig:
    """Tests for MCP configuration validation."""

    def test_defaults(self) -> None:
        config = MCPConfig()
        assert config.servers_config_path == "./mcp_servers.json"
        assert config.connection_timeout == 15
        assert config.tool_call_timeout == 10

    def test_timeout_below_minimum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            MCPConfig(connection_timeout=0)

    def test_tool_call_timeout_below_minimum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            MCPConfig(tool_call_timeout=0)


class TestLiveKitConfig:
    """Tests for LiveKit configuration validation."""

    def test_valid_config(self) -> None:
        config = LiveKitConfig(
            url="wss://test.livekit.cloud",
            api_key="api-key-123",
            api_secret="api-secret-456",
        )
        assert config.url == "wss://test.livekit.cloud"
        assert config.api_key == "api-key-123"
        assert config.api_secret == "api-secret-456"

    def test_empty_url_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="LiveKit URL is required"):
            LiveKitConfig(url="", api_key="key", api_secret="secret")

    def test_empty_api_key_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="LiveKit API key is required"):
            LiveKitConfig(url="wss://test.livekit.cloud", api_key="", api_secret="secret")

    def test_empty_api_secret_raises_error(self) -> None:
        with pytest.raises(ValidationError, match="LiveKit API secret is required"):
            LiveKitConfig(url="wss://test.livekit.cloud", api_key="key", api_secret="")


class TestPersonalityProfile:
    """Tests for PersonalityProfile configuration."""

    def test_defaults(self) -> None:
        profile = PersonalityProfile()
        assert profile.tone == "friendly"
        assert profile.verbosity == "moderate"
        assert profile.humor_enabled is True
        assert profile.formal_address is False
        assert profile.proactive_suggestions is True

    def test_custom_values(self) -> None:
        profile = PersonalityProfile(
            tone="professional", verbosity="brief", humor_enabled=False
        )
        assert profile.tone == "professional"
        assert profile.verbosity == "brief"
        assert profile.humor_enabled is False

    def test_invalid_tone_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            PersonalityProfile(tone="angry")  # type: ignore[arg-type]


class TestAppConfig:
    """Tests for AppConfig root configuration."""

    def test_valid_full_config(self) -> None:
        config = AppConfig(
            livekit=LiveKitConfig(
                url="wss://test.livekit.cloud",
                api_key="lk-key",
                api_secret="lk-secret",
            ),
            asr=ASRConfig(api_key="deepgram-key"),
            tts=TTSConfig(api_key="cartesia-key"),
            llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
            memory=MemoryConfig(),
            mcp=MCPConfig(),
        )
        assert config.livekit.url == "wss://test.livekit.cloud"
        assert config.asr.api_key == "deepgram-key"
        assert config.tts.api_key == "cartesia-key"
        assert config.llm.nvidia_nim_api_key == "nvidia-key"
        assert config.log_level == "INFO"
        assert config.silence_threshold_ms == 600

    def test_frozen_config_cannot_be_modified(self) -> None:
        config = AppConfig(
            livekit=LiveKitConfig(
                url="wss://test.livekit.cloud",
                api_key="lk-key",
                api_secret="lk-secret",
            ),
            asr=ASRConfig(api_key="deepgram-key"),
            tts=TTSConfig(api_key="cartesia-key"),
            llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
        )
        with pytest.raises(ValidationError):
            config.log_level = "DEBUG"  # type: ignore[misc]

    def test_invalid_log_level_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            AppConfig(
                livekit=LiveKitConfig(
                    url="wss://test.livekit.cloud",
                    api_key="lk-key",
                    api_secret="lk-secret",
                ),
                asr=ASRConfig(api_key="deepgram-key"),
                tts=TTSConfig(api_key="cartesia-key"),
                llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
                log_level="TRACE",  # type: ignore[arg-type]
            )

    def test_silence_threshold_below_minimum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            AppConfig(
                livekit=LiveKitConfig(
                    url="wss://test.livekit.cloud",
                    api_key="lk-key",
                    api_secret="lk-secret",
                ),
                asr=ASRConfig(api_key="deepgram-key"),
                tts=TTSConfig(api_key="cartesia-key"),
                llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
                silence_threshold_ms=100,
            )

    def test_silence_threshold_above_maximum_raises_error(self) -> None:
        with pytest.raises(ValidationError):
            AppConfig(
                livekit=LiveKitConfig(
                    url="wss://test.livekit.cloud",
                    api_key="lk-key",
                    api_secret="lk-secret",
                ),
                asr=ASRConfig(api_key="deepgram-key"),
                tts=TTSConfig(api_key="cartesia-key"),
                llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
                silence_threshold_ms=3000,
            )

    def test_from_env_loads_config(self) -> None:
        env_vars = {
            "LIVEKIT_URL": "wss://env-test.livekit.cloud",
            "LIVEKIT_API_KEY": "env-lk-key",
            "LIVEKIT_API_SECRET": "env-lk-secret",
            "DEEPGRAM_API_KEY": "env-deepgram-key",
            "CARTESIA_API_KEY": "env-cartesia-key",
            "NVIDIA_NIM_API_KEY": "env-nvidia-key",
            "LOG_LEVEL": "DEBUG",
            "SILENCE_THRESHOLD_MS": "800",
        }
        with patch.dict(os.environ, env_vars, clear=False):
            config = AppConfig.from_env()
            assert config.livekit.url == "wss://env-test.livekit.cloud"
            assert config.livekit.api_key == "env-lk-key"
            assert config.asr.api_key == "env-deepgram-key"
            assert config.tts.api_key == "env-cartesia-key"
            assert config.llm.nvidia_nim_api_key == "env-nvidia-key"
            assert config.log_level == "DEBUG"
            assert config.silence_threshold_ms == 800

    def test_from_env_missing_required_raises_error(self) -> None:
        """Test that missing required env vars produce clear errors."""
        env_vars = {
            "LIVEKIT_URL": "",
            "LIVEKIT_API_KEY": "",
            "LIVEKIT_API_SECRET": "",
            "DEEPGRAM_API_KEY": "",
            "CARTESIA_API_KEY": "",
            "NVIDIA_NIM_API_KEY": "",
            "OPENROUTER_API_KEY": "",
        }
        with patch.dict(os.environ, env_vars, clear=False):
            with pytest.raises(ValidationError):
                AppConfig.from_env()

    def test_default_personality_profile(self) -> None:
        config = AppConfig(
            livekit=LiveKitConfig(
                url="wss://test.livekit.cloud",
                api_key="lk-key",
                api_secret="lk-secret",
            ),
            asr=ASRConfig(api_key="deepgram-key"),
            tts=TTSConfig(api_key="cartesia-key"),
            llm=LLMConfig(nvidia_nim_api_key="nvidia-key"),
        )
        assert config.personality.tone == "friendly"
        assert config.personality.verbosity == "moderate"
