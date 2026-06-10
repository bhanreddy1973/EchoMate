"""EchoMate Voice Agent — LiveKit Agents v1.x implementation.

Wires together VAD, ASR, LLM (via model router), TTS, memory, personality,
MCP tools, and companion features into a real-time voice pipeline.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

try:
    from livekit.agents import (
        Agent,
        AgentSession,
        JobContext,
        WorkerOptions,
        cli,
    )
    from livekit.plugins import deepgram as deepgram_plugin
    from livekit.plugins import cartesia as cartesia_plugin
    from livekit.plugins import silero as silero_plugin

    _LIVEKIT_AVAILABLE = True
except ImportError:  # pragma: no cover
    _LIVEKIT_AVAILABLE = False
    logger.warning("LiveKit packages not installed; agent runtime unavailable")


class EchoMateAgent:
    """Orchestrates the EchoMate real-time voice pipeline.

    Initialises and wires all subsystems (ASR, TTS, LLM, memory, personality,
    MCP tools) on room connection and tears them down gracefully on session end.

    Args:
        config: Application configuration (AppConfig). Loaded from environment
            if not supplied; must be valid before the agent can start.
    """

    def __init__(self, config: Any | None = None) -> None:
        if config is None:
            from echomate.config.settings import AppConfig
            config = AppConfig.from_env()
        self.config = config

        # Components initialised on room connection
        self._memory_manager: Any = None
        self._model_router: Any = None
        self._mcp_manager: Any = None
        self._tool_registry: Any = None
        self._personality_manager: Any = None
        self._prompt_builder: Any = None
        self._companion_state: Any = None

        # Barge-in state
        self._tts_task: asyncio.Task[Any] | None = None
        self._llm_task: asyncio.Task[Any] | None = None
        self._pipeline_lock = asyncio.Lock()
        self._barge_in_event = asyncio.Event()

    # ------------------------------------------------------------------
    # Initialisation helpers
    # ------------------------------------------------------------------

    async def _init_components(self) -> None:
        """Initialise all subsystems. Called once per room connection."""
        from echomate.memory import MemoryManager
        from echomate.memory.long_term import LongTermMemory
        from echomate.memory.short_term import ShortTermMemory
        from echomate.mcp_manager import MCPManager
        from echomate.model_router import ModelRouter
        from echomate.models import CompanionState
        from echomate.personality import PersonalityManager
        from echomate.prompts.builder import PromptBuilder
        from echomate.tools.registry import ToolRegistry

        stm = ShortTermMemory(max_tokens=self.config.memory.short_term_token_limit)
        ltm = LongTermMemory(
            persist_dir=self.config.memory.chroma_persist_dir,
            top_k=self.config.memory.long_term_top_k,
            min_score=self.config.memory.min_similarity_score,
        )
        self._memory_manager = MemoryManager(stm, ltm)

        self._model_router = ModelRouter(
            nvidia_api_key=self.config.llm.nvidia_nim_api_key,
            openrouter_api_key=self.config.llm.openrouter_api_key,
            timeout=self.config.llm.timeout_seconds,
            max_fallbacks=self.config.llm.max_fallback_attempts,
        )

        self._mcp_manager = MCPManager(
            servers_config_path=self.config.mcp.servers_config_path,
            connection_timeout=self.config.mcp.connection_timeout,
            tool_call_timeout=self.config.mcp.tool_call_timeout,
        )
        await self._mcp_manager.initialize()

        self._tool_registry = ToolRegistry(mcp_manager=self._mcp_manager)
        self._personality_manager = PersonalityManager(profile=self.config.personality)
        self._prompt_builder = PromptBuilder()
        self._companion_state = CompanionState()

        logger.info("EchoMate components initialised successfully")

    # ------------------------------------------------------------------
    # Core pipeline
    # ------------------------------------------------------------------

    async def on_user_speech(self, transcript: str) -> str:
        """Process a user utterance through the full voice pipeline.

        Builds a context-aware prompt, routes to the best available LLM,
        and returns the assistant's text response for TTS synthesis.

        Args:
            transcript: The ASR-produced transcript of the user's speech.

        Returns:
            The assistant's text response.
        """
        if not transcript or not transcript.strip():
            return ""

        self._memory_manager.short_term.add({"role": "user", "content": transcript})

        memory_ctx = await self._memory_manager.get_context(transcript)
        tools = self._tool_registry.get_all_tools()

        system_prompt = self._prompt_builder.build_system_prompt(
            personality=self.config.personality,
            memory_context=memory_ctx,
            available_tools=tools,
            companion_state=self._companion_state,
        )
        messages = self._prompt_builder.build_messages(
            system_prompt=system_prompt,
            short_term=memory_ctx.short_term_messages,
            user_input=transcript,
        )

        response_text = ""
        try:
            async for token in self._model_router.route(messages):
                response_text += token
        except Exception as e:
            logger.error("LLM routing failed: %s", e)
            response_text = "I'm having trouble thinking right now. Please try again."

        if response_text:
            self._memory_manager.short_term.add(
                {"role": "assistant", "content": response_text}
            )

        return response_text

    async def handle_barge_in(self) -> None:
        """Handle user speech during TTS playback (barge-in).

        Atomically stops TTS, cancels LLM generation, and resets pipeline
        state before the new utterance is processed.
        """
        async with self._pipeline_lock:
            if self._tts_task and not self._tts_task.done():
                self._tts_task.cancel()
                try:
                    await self._tts_task
                except asyncio.CancelledError:
                    pass

            if self._llm_task and not self._llm_task.done():
                self._llm_task.cancel()
                try:
                    await self._llm_task
                except asyncio.CancelledError:
                    pass

            self._tts_task = None
            self._llm_task = None
            self._barge_in_event.set()
            logger.debug("Barge-in handled: TTS stopped, LLM cancelled, pipeline reset")

    async def on_session_end(self) -> None:
        """Summarise and persist session on disconnect.

        Stores the full conversation history as a session summary in
        long-term memory and shuts down the MCP manager.
        """
        if self._memory_manager:
            conversation = self._memory_manager.short_term.get_messages()
            await self._memory_manager.end_session(conversation)

        if self._mcp_manager:
            try:
                await self._mcp_manager.shutdown()
            except Exception as e:
                logger.warning("MCP manager shutdown error: %s", e)

        logger.info("EchoMate session ended and summarised")

    # ------------------------------------------------------------------
    # Error handling helpers
    # ------------------------------------------------------------------

    async def _retry(self, coro_fn: Any, *args: Any, retries: int = 3, delay: float = 2.0) -> Any:
        """Retry a coroutine up to `retries` times with a fixed delay."""
        last_exc: Exception | None = None
        for attempt in range(retries):
            try:
                return await asyncio.wait_for(coro_fn(*args), timeout=3.0)
            except Exception as exc:
                last_exc = exc
                logger.warning("Attempt %d/%d failed: %s", attempt + 1, retries, exc)
                if attempt < retries - 1:
                    await asyncio.sleep(delay)
        raise last_exc or RuntimeError("All retry attempts failed")


# ---------------------------------------------------------------------------
# LiveKit Agents v1.x entrypoint
# ---------------------------------------------------------------------------

async def entrypoint(ctx: JobContext) -> None:
    """LiveKit job entrypoint — called once per incoming room connection."""
    if not _LIVEKIT_AVAILABLE:
        logger.error("LiveKit packages are required to run the agent")
        return

    echomate = EchoMateAgent()

    await ctx.connect()

    try:
        await echomate._init_components()
    except Exception as e:
        logger.error("Failed to initialise EchoMate components: %s", e)
        return

    try:
        cfg = echomate.config

        agent = Agent(
            instructions=(
                "You are EchoMate, a friendly and helpful voice companion. "
                "You assist with daily tasks, reminders, habits, and general questions. "
                "Be concise, warm, and conversational."
            ),
            stt=deepgram_plugin.STT(
                api_key=cfg.asr.api_key,
                model=cfg.asr.model,
                language=cfg.asr.language,
            ),
            tts=cartesia_plugin.TTS(
                api_key=cfg.tts.api_key,
                voice=cfg.tts.voice_id,
            ),
            vad=silero_plugin.VAD.load(min_silence_duration=0.6),
            allow_interruptions=True,
        )

        session = AgentSession()

        await session.start(agent=agent, room=ctx.room)
        logger.info("EchoMate session started")

        await session.say("Hello! I'm EchoMate. How can I help you today?")

    except Exception as e:
        logger.error("Voice pipeline error: %s", e)
    finally:
        await echomate.on_session_end()


if __name__ == "__main__":
    if _LIVEKIT_AVAILABLE:
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
    else:
        print("LiveKit packages not installed. Install with: pip install livekit-agents")
