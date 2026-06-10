"""Configuration models for EchoMate using Pydantic and pydantic-settings.

All configuration is loaded from environment variables and .env file.
Validation failures at startup produce clear error messages with field names and reasons.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ASRConfig(BaseModel):
    """Automatic Speech Recognition configuration.

    Attributes:
        provider: ASR provider to use (deepgram or assemblyai).
        api_key: API key for the ASR provider.
        model: ASR model identifier (default: nova-2).
        language: Language code for recognition (default: en).
    """

    provider: Literal["deepgram", "assemblyai"] = "deepgram"
    api_key: str = ""
    model: str = "nova-2"
    language: str = "en"

    @field_validator("api_key")
    @classmethod
    def api_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("ASR api_key is required; set DEEPGRAM_API_KEY in your environment")
        return v.strip()


class TTSConfig(BaseModel):
    """Text-to-Speech configuration.

    Attributes:
        provider: TTS provider to use (cartesia or elevenlabs).
        api_key: API key for the TTS provider.
        voice_id: Voice identifier for synthesis (default: default).
        speed: Speech rate multiplier (default: 1.0).
    """

    provider: Literal["cartesia", "elevenlabs"] = "cartesia"
    api_key: str = ""
    voice_id: str = "default"
    speed: float = Field(default=1.0, ge=0.1, le=5.0)

    @field_validator("api_key")
    @classmethod
    def api_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("TTS api_key is required; set CARTESIA_API_KEY in your environment")
        return v.strip()


class LLMConfig(BaseModel):
    """LLM routing configuration for free model endpoints.

    Attributes:
        nvidia_nim_api_key: API key for NVIDIA NIM endpoints.
        openrouter_api_key: API key for OpenRouter free endpoints.
        default_tier: Default routing tier (fast or reasoning).
        timeout_seconds: Timeout per LLM call in seconds.
        max_fallback_attempts: Maximum number of fallback models to try.
    """

    nvidia_nim_api_key: str = ""
    openrouter_api_key: str = ""
    default_tier: Literal["fast", "reasoning"] = "fast"
    timeout_seconds: int = Field(default=5, ge=1, le=60)
    max_fallback_attempts: int = Field(default=3, ge=1, le=10)

    @model_validator(mode="after")
    def at_least_one_provider_key(self) -> "LLMConfig":
        """Ensure at least one LLM provider API key is configured."""
        if not self.nvidia_nim_api_key.strip() and not self.openrouter_api_key.strip():
            raise ValueError(
                "At least one LLM provider API key is required; "
                "set NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY in your environment"
            )
        return self


class MemoryConfig(BaseModel):
    """Memory system configuration for short-term and long-term memory.

    Attributes:
        chroma_persist_dir: Directory for Chroma vector DB persistence.
        short_term_token_limit: Maximum tokens in short-term memory buffer.
        long_term_top_k: Number of results to retrieve from long-term memory.
        min_similarity_score: Minimum similarity score for memory retrieval.
    """

    chroma_persist_dir: str = "./data/chroma"
    short_term_token_limit: int = Field(default=4000, ge=100, le=128000)
    long_term_top_k: int = Field(default=5, ge=1, le=50)
    min_similarity_score: float = Field(default=0.7, ge=0.0, le=1.0)


class MCPConfig(BaseModel):
    """MCP (Model Context Protocol) server configuration.

    Attributes:
        servers_config_path: Path to the MCP servers JSON configuration file.
        connection_timeout: Timeout in seconds for connecting to MCP servers.
        tool_call_timeout: Timeout in seconds for individual tool calls.
    """

    servers_config_path: str = "./mcp_servers.json"
    connection_timeout: int = Field(default=15, ge=1, le=120)
    tool_call_timeout: int = Field(default=10, ge=1, le=120)


class LiveKitConfig(BaseModel):
    """LiveKit server connection configuration.

    Attributes:
        url: LiveKit server WebSocket URL.
        api_key: LiveKit API key.
        api_secret: LiveKit API secret.
    """

    url: str = ""
    api_key: str = ""
    api_secret: str = ""

    @field_validator("url")
    @classmethod
    def url_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError(
                "LiveKit URL is required; set LIVEKIT_URL in your environment"
            )
        return v.strip()

    @field_validator("api_key")
    @classmethod
    def api_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError(
                "LiveKit API key is required; set LIVEKIT_API_KEY in your environment"
            )
        return v.strip()

    @field_validator("api_secret")
    @classmethod
    def api_secret_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError(
                "LiveKit API secret is required; set LIVEKIT_API_SECRET in your environment"
            )
        return v.strip()


class PersonalityProfile(BaseModel):
    """Personality configuration for the EchoMate companion.

    Attributes:
        tone: Conversational tone style.
        verbosity: Response length preference.
        humor_enabled: Whether humor is enabled in responses.
        formal_address: Whether to use formal address.
        proactive_suggestions: Whether to proactively suggest actions.
    """

    tone: Literal["friendly", "professional", "casual"] = "friendly"
    verbosity: Literal["brief", "moderate", "detailed"] = "moderate"
    humor_enabled: bool = True
    formal_address: bool = False
    proactive_suggestions: bool = True


class AppConfig(BaseSettings):
    """Root application configuration loaded from environment variables and .env file.

    This is the central configuration object for EchoMate. It is frozen (immutable)
    after creation to ensure configuration cannot be changed at runtime.

    Attributes:
        livekit: LiveKit connection settings.
        asr: ASR provider settings.
        tts: TTS provider settings.
        llm: LLM routing settings.
        memory: Memory system settings.
        mcp: MCP tool integration settings.
        personality: Personality profile settings.
        log_level: Application log level.
        silence_threshold_ms: Silence duration before triggering response.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        frozen=True,
        extra="ignore",
    )

    # Sub-configurations built from individual env vars
    livekit: LiveKitConfig = Field(default_factory=LiveKitConfig)
    asr: ASRConfig = Field(default_factory=ASRConfig)
    tts: TTSConfig = Field(default_factory=TTSConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    mcp: MCPConfig = Field(default_factory=MCPConfig)
    personality: PersonalityProfile = Field(default_factory=PersonalityProfile)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    silence_threshold_ms: int = Field(default=600, ge=200, le=2000)

    @classmethod
    def from_env(cls) -> "AppConfig":
        """Load configuration from environment variables and .env file.

        Constructs sub-configurations from flat environment variables and
        validates the entire configuration tree.

        Returns:
            A validated, frozen AppConfig instance.

        Raises:
            ValidationError: If any configuration value is invalid.
                The error message includes the field name and reason.
        """
        import os

        from dotenv import load_dotenv

        load_dotenv()

        livekit = LiveKitConfig(
            url=os.getenv("LIVEKIT_URL", ""),
            api_key=os.getenv("LIVEKIT_API_KEY", ""),
            api_secret=os.getenv("LIVEKIT_API_SECRET", ""),
        )

        asr = ASRConfig(
            provider=os.getenv("ASR_PROVIDER", "deepgram"),  # type: ignore[arg-type]
            api_key=os.getenv("DEEPGRAM_API_KEY", ""),
            model=os.getenv("DEEPGRAM_MODEL", "nova-2"),
            language=os.getenv("DEEPGRAM_LANGUAGE", "en"),
        )

        tts = TTSConfig(
            provider=os.getenv("TTS_PROVIDER", "cartesia"),  # type: ignore[arg-type]
            api_key=os.getenv("CARTESIA_API_KEY", ""),
            voice_id=os.getenv("CARTESIA_VOICE_ID", "default"),
            speed=float(os.getenv("CARTESIA_SPEED", "1.0")),
        )

        llm = LLMConfig(
            nvidia_nim_api_key=os.getenv("NVIDIA_NIM_API_KEY", ""),
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
            default_tier=os.getenv("LLM_DEFAULT_TIER", "fast"),  # type: ignore[arg-type]
            timeout_seconds=int(os.getenv("LLM_TIMEOUT_SECONDS", "5")),
            max_fallback_attempts=int(os.getenv("LLM_MAX_FALLBACK_ATTEMPTS", "3")),
        )

        memory = MemoryConfig(
            chroma_persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./data/chroma"),
            short_term_token_limit=int(os.getenv("SHORT_TERM_TOKEN_LIMIT", "4000")),
            long_term_top_k=int(os.getenv("LONG_TERM_TOP_K", "5")),
            min_similarity_score=float(os.getenv("MIN_SIMILARITY_SCORE", "0.7")),
        )

        mcp = MCPConfig(
            servers_config_path=os.getenv("MCP_SERVERS_CONFIG_PATH", "./mcp_servers.json"),
            connection_timeout=int(os.getenv("MCP_CONNECTION_TIMEOUT", "15")),
            tool_call_timeout=int(os.getenv("MCP_TOOL_CALL_TIMEOUT", "10")),
        )

        log_level = os.getenv("LOG_LEVEL", "INFO")
        silence_threshold_ms = int(os.getenv("SILENCE_THRESHOLD_MS", "600"))

        return cls(
            livekit=livekit,
            asr=asr,
            tts=tts,
            llm=llm,
            memory=memory,
            mcp=mcp,
            log_level=log_level,  # type: ignore[arg-type]
            silence_threshold_ms=silence_threshold_ms,
        )
