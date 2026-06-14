"""EchoMate Voice Agent — LiveKit Agents v1.x implementation.

Wires together VAD, ASR, LLM (via model router), TTS, memory, personality,
MCP tools, and companion features into a real-time voice pipeline.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

import os
import ssl

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# Disable SSL verification if SSL_VERIFY is set to false
if os.getenv("SSL_VERIFY", "true").lower() == "false":
    # Disable for httpx / requests / urllib3
    os.environ["CURL_CA_BUNDLE"] = ""
    os.environ["REQUESTS_CA_BUNDLE"] = ""
    os.environ.pop("SSL_CERT_FILE", None)

    # Disable for litellm
    os.environ["LITELLM_SSL_VERIFY"] = "false"

    # Create a permissive SSL context as the default
    ssl._create_default_https_context = ssl._create_unverified_context

    # Monkey-patch aiohttp to disable SSL verification globally
    # This is needed for LiveKit agent's WebSocket connections
    import aiohttp

    _original_tcp_connector_init = aiohttp.TCPConnector.__init__

    def _patched_tcp_connector_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("ssl", False)
        _original_tcp_connector_init(self, *args, **kwargs)

    aiohttp.TCPConnector.__init__ = _patched_tcp_connector_init  # type: ignore[method-assign]

    # Also patch aiohttp.ClientSession to use ssl=False by default on ws_connect and request
    _original_session_init = aiohttp.ClientSession.__init__

    def _patched_session_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        if "connector" not in kwargs or kwargs["connector"] is None:
            kwargs["connector"] = aiohttp.TCPConnector(ssl=False)
        _original_session_init(self, *args, **kwargs)

    aiohttp.ClientSession.__init__ = _patched_session_init  # type: ignore[method-assign]

    # Monkey-patch httpx to disable SSL verification globally
    # This is needed for the OpenAI SDK used by livekit-plugins-openai
    import httpx

    _original_httpx_client_init = httpx.Client.__init__
    _original_httpx_async_client_init = httpx.AsyncClient.__init__

    def _patched_httpx_client_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("verify", False)
        _original_httpx_client_init(self, *args, **kwargs)

    def _patched_httpx_async_client_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("verify", False)
        _original_httpx_async_client_init(self, *args, **kwargs)

    httpx.Client.__init__ = _patched_httpx_client_init  # type: ignore[method-assign]
    httpx.AsyncClient.__init__ = _patched_httpx_async_client_init  # type: ignore[method-assign]

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
    from livekit.plugins import openai as openai_plugin

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
            chroma_persist_dir=self.config.memory.chroma_persist_dir,
        )
        self._memory_manager = MemoryManager(stm, ltm)

        self._model_router = ModelRouter(
            timeout_seconds=self.config.llm.timeout_seconds,
            max_fallbacks=self.config.llm.max_fallback_attempts,
        )

        self._mcp_manager = MCPManager(
            tool_call_timeout=self.config.mcp.tool_call_timeout,
        )
        await self._mcp_manager.initialize(servers=[])

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

def _load_coding_context() -> str:
    """Load current coding session context from saved run history."""
    coding_context = ""
    try:
        import json as _json
        from pathlib import Path as _P
        
        # Read coding session state if available
        coding_state_file = _P(__file__).parent / "data" / "coding_context.json"
        if coding_state_file.exists():
            state = _json.loads(coding_state_file.read_text(encoding="utf-8"))
            problem = state.get("currentProblem")
            if problem:
                coding_context += f"\n--- Current Coding Session ---\n"
                coding_context += f"Problem: {problem.get('title', 'Unknown')} ({problem.get('difficulty', '')})\n"
                if problem.get("tags"):
                    coding_context += f"Tags: {', '.join(problem['tags'])}\n"
                if problem.get("statementMarkdown"):
                    coding_context += f"Statement: {problem['statementMarkdown'][:500]}\n"
            
            code = state.get("code", "")
            lang = state.get("language", "")
            if code:
                coding_context += f"\nCurrent code ({lang}):\n```{lang}\n{code[:800]}\n```\n"
            
            results = state.get("runResults", [])
            if results:
                latest = results[0]
                coding_context += f"\nLast run: {latest.get('status', 'unknown')}"
                if latest.get("testResults"):
                    passed = sum(1 for t in latest["testResults"] if t.get("passed"))
                    total = len(latest["testResults"])
                    coding_context += f" ({passed}/{total} tests passed)"
                coding_context += "\n"
            
            history = state.get("history", [])
            if history:
                coding_context += f"\nCoding history ({len(history)} problems solved):\n"
                for h in history[:5]:
                    coding_context += f"  - {h.get('title', 'Unknown')}: {h.get('status', 'attempted')}\n"
            
            coding_context += "--- End Coding Context ---\n"
    except Exception as e:
        logger.debug(f"No coding context available: {e}")
    
    return coding_context


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

    cfg = echomate.config

    # Load current tasks and memories for context
    task_context = ""
    memory_context = ""
    try:
        import json
        from pathlib import Path as _P
        tasks_file = _P(__file__).parent / "data" / "conversations"
        # Load tasks from localStorage export isn't possible, so we read from any saved state
        # Use memories from ChromaDB
        if echomate._memory_manager and echomate._memory_manager.long_term.is_available():
            mem_ctx = await echomate._memory_manager.get_context("user preferences and tasks")
            if mem_ctx.long_term_entries:
                memory_context = "\n".join([f"- {e.text}" for e in mem_ctx.long_term_entries[:5]])
    except Exception as e:
        logger.warning(f"Failed to load context: {e}")

    # Load coding context
    coding_context = _load_coding_context()

    instructions = (
        "You are EchoMate, a friendly and helpful voice companion. "
        "You assist with daily tasks, reminders, habits, scheduling, coding help, and general questions. "
        "Be concise, warm, and conversational. Keep responses under 2-3 sentences for voice. "
        "You have access to the user's memory, preferences, and coding session.\n"
        "When the user asks about their code or coding problems, use the coding context provided.\n"
    )
    if memory_context:
        instructions += f"\nWhat you remember about the user:\n{memory_context}\n"
    if coding_context:
        instructions += coding_context

    # Determine which LLM to use: NVIDIA Nemotron VoiceChat or standard LLM
    nvidia_key = cfg.llm.nvidia_nim_api_key or os.getenv("NVIDIA_NIM_API_KEY", "")
    voicechat_key = os.getenv("NVIDIA_VOICECHAT_API_KEY", "") or nvidia_key
    voice_model = os.getenv("VOICE_LLM_MODEL", "nvidia/nemotron-voicechat")

    # Deepgram STT supports 36+ languages with nova-2
    # Language can be set via DEEPGRAM_LANGUAGE env var (default: en)
    # Supported: en, es, fr, de, it, pt, nl, ja, ko, zh, hi, ar, ru, pl, tr, sv, da, no, fi, etc.
    stt_language = cfg.asr.language or "en"

    agent = Agent(
        instructions=instructions,
        llm=openai_plugin.LLM(
            model=voice_model,
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=voicechat_key,
        ),
        stt=deepgram_plugin.STT(
            api_key=cfg.asr.api_key,
            model=cfg.asr.model,
            language=stt_language,
        ),
        tts=deepgram_plugin.TTS(
            api_key=cfg.asr.api_key,
        ),
        vad=silero_plugin.VAD.load(min_silence_duration=0.5),
        allow_interruptions=True,
    )

    session = AgentSession()
    await session.start(agent=agent, room=ctx.room)
    logger.info(f"EchoMate session started — model={voice_model}, language={stt_language}")

    await session.say("Hey! I'm EchoMate. What can I help you with?")


if __name__ == "__main__":
    if _LIVEKIT_AVAILABLE:
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
    else:
        print("LiveKit packages not installed. Install with: pip install livekit-agents")
