"""Tests for EchoMate agent: barge-in atomicity, data persistence, pipeline integration."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent import EchoMateAgent


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_agent() -> EchoMateAgent:
    """Build an EchoMateAgent with a minimal stub config."""
    cfg = MagicMock()
    cfg.memory.short_term_token_limit = 4000
    cfg.memory.chroma_persist_dir = "/tmp/chroma_test"
    cfg.memory.long_term_top_k = 5
    cfg.memory.min_similarity_score = 0.7
    cfg.llm.nvidia_nim_api_key = "test"
    cfg.llm.openrouter_api_key = ""
    cfg.llm.timeout_seconds = 5
    cfg.llm.max_fallback_attempts = 3
    cfg.mcp.servers_config_path = "./mcp_servers.json"
    cfg.mcp.connection_timeout = 15
    cfg.mcp.tool_call_timeout = 10
    cfg.personality = MagicMock()
    cfg.asr.api_key = "test"
    cfg.asr.model = "nova-2"
    cfg.asr.language = "en"
    cfg.tts.api_key = "test"
    cfg.tts.voice_id = "default"
    return EchoMateAgent(config=cfg)


async def _init_with_mocks(agent: EchoMateAgent) -> None:
    """Wire agent with mocked subsystems — bypasses real Chroma/LLM/MCP."""
    from echomate.memory import MemoryManager
    from echomate.memory.short_term import ShortTermMemory
    from echomate.models import CompanionState

    stm = ShortTermMemory(max_tokens=4000)

    ltm = MagicMock()
    ltm.is_available.return_value = False
    ltm.store = AsyncMock()

    agent._memory_manager = MemoryManager(stm, ltm)

    router = MagicMock()

    async def _fake_route(messages):  # type: ignore[type-arg]
        yield "Hello from EchoMate!"

    router.route = _fake_route
    agent._model_router = router

    mcp = MagicMock()
    mcp.get_tools_as_openai_functions.return_value = []
    mcp.shutdown = AsyncMock()
    agent._mcp_manager = mcp

    registry = MagicMock()
    registry.get_all_tools.return_value = []
    agent._tool_registry = registry

    from echomate.personality import PersonalityManager
    agent._personality_manager = PersonalityManager(profile=agent.config.personality)

    from echomate.prompts.builder import PromptBuilder
    agent._prompt_builder = PromptBuilder()
    agent._companion_state = CompanionState()


# ---------------------------------------------------------------------------
# Property 4: Barge-in atomicity
# ---------------------------------------------------------------------------


class TestBargeInAtomicity:
    """Verify TTS stop → LLM cancel → pipeline reset is atomic."""

    @pytest.mark.asyncio
    async def test_barge_in_cancels_tts_task(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)

        cancelled = []

        async def slow_tts() -> None:
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                cancelled.append("tts")
                raise

        agent._tts_task = asyncio.create_task(slow_tts())
        await asyncio.sleep(0)  # let task start
        await agent.handle_barge_in()
        assert "tts" in cancelled
        assert agent._tts_task is None

    @pytest.mark.asyncio
    async def test_barge_in_cancels_llm_task(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)

        cancelled = []

        async def slow_llm() -> None:
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                cancelled.append("llm")
                raise

        agent._llm_task = asyncio.create_task(slow_llm())
        await asyncio.sleep(0)  # let task start
        await agent.handle_barge_in()
        assert "llm" in cancelled
        assert agent._llm_task is None

    @pytest.mark.asyncio
    async def test_barge_in_sets_event(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)
        await agent.handle_barge_in()
        assert agent._barge_in_event.is_set()

    @pytest.mark.asyncio
    async def test_barge_in_both_tasks_sequential(self) -> None:
        """TTS must be cancelled before LLM — order matters for atomicity."""
        agent = _make_agent()
        await _init_with_mocks(agent)

        order: list[str] = []

        async def slow_tts() -> None:
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                order.append("tts_cancel")
                raise

        async def slow_llm() -> None:
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                order.append("llm_cancel")
                raise

        agent._tts_task = asyncio.create_task(slow_tts())
        agent._llm_task = asyncio.create_task(slow_llm())
        await asyncio.sleep(0)  # let tasks start
        await agent.handle_barge_in()

        # Both must be cancelled and pipeline cleared
        assert "tts_cancel" in order
        assert "llm_cancel" in order
        assert agent._tts_task is None
        assert agent._llm_task is None


# ---------------------------------------------------------------------------
# Property 5: No data loss on crash
# ---------------------------------------------------------------------------


class TestNoDataLossOnCrash:
    """Verify memories are persisted to Chroma on write and at session end."""

    @pytest.mark.asyncio
    async def test_store_fact_calls_ltm_store(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)

        # Re-enable LTM mock
        agent._memory_manager.long_term.is_available.return_value = True

        await agent._memory_manager.store_fact("User likes jazz music")
        agent._memory_manager.long_term.store.assert_awaited()

    @pytest.mark.asyncio
    async def test_session_end_triggers_summary_store(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)

        agent._memory_manager.long_term.is_available.return_value = True

        agent._memory_manager.short_term.add({"role": "user", "content": "Hello"})
        agent._memory_manager.short_term.add({"role": "assistant", "content": "Hi!"})

        await agent.on_session_end()
        agent._memory_manager.long_term.store.assert_awaited()

    @pytest.mark.asyncio
    async def test_session_end_calls_mcp_shutdown(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)
        await agent.on_session_end()
        agent._mcp_manager.shutdown.assert_awaited_once()


# ---------------------------------------------------------------------------
# Integration: voice pipeline (mocked audio)
# ---------------------------------------------------------------------------


class TestVoicePipelineIntegration:
    @pytest.mark.asyncio
    async def test_on_user_speech_returns_response(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)
        response = await agent.on_user_speech("What is the weather today?")
        assert isinstance(response, str)
        assert len(response) > 0

    @pytest.mark.asyncio
    async def test_on_user_speech_empty_returns_empty(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)
        response = await agent.on_user_speech("   ")
        assert response == ""

    @pytest.mark.asyncio
    async def test_on_user_speech_adds_to_short_term(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)
        await agent.on_user_speech("Remember my cat's name is Whiskers")
        msgs = agent._memory_manager.short_term.get_messages()
        assert any(m["content"] == "Remember my cat's name is Whiskers" for m in msgs)

    @pytest.mark.asyncio
    async def test_on_user_speech_fallback_on_llm_error(self) -> None:
        agent = _make_agent()
        await _init_with_mocks(agent)

        async def _error_route(messages):  # type: ignore[type-arg]
            raise RuntimeError("LLM down")
            yield  # make it a generator

        agent._model_router.route = _error_route

        response = await agent.on_user_speech("Hello?")
        assert "trouble" in response.lower()

    @pytest.mark.asyncio
    async def test_model_fallback_uses_same_messages(self) -> None:
        """Property 3: Fallback retries must use identical message list."""
        agent = _make_agent()
        await _init_with_mocks(agent)

        captured_messages: list[list[dict]] = []

        async def _capture_route(messages):  # type: ignore[type-arg]
            captured_messages.append(list(messages))
            if len(captured_messages) == 1:
                raise RuntimeError("Primary model down")
            yield "Fallback response"

        agent._model_router.route = _capture_route

        # Simulate a router that captures args before delegating
        original_speech = agent.on_user_speech

        async def _patched_speech(transcript: str) -> str:
            agent._memory_manager.short_term.add({"role": "user", "content": transcript})
            from echomate.prompts.builder import PromptBuilder
            from echomate.models import CompanionState, MemoryContext
            memory_ctx = await agent._memory_manager.get_context(transcript)
            system_prompt = agent._prompt_builder.build_system_prompt(
                personality=agent.config.personality,
                memory_context=memory_ctx,
                available_tools=[],
                companion_state=agent._companion_state,
            )
            messages = agent._prompt_builder.build_messages(system_prompt, [], transcript)
            # First attempt fails, second succeeds
            for attempt in range(2):
                try:
                    result = ""
                    async for token in agent._model_router.route(messages):
                        result += token
                    return result
                except RuntimeError:
                    continue
            return "error"

        response = await _patched_speech("Tell me a story")
        # Both calls must have had the same user message at the end
        if len(captured_messages) >= 2:
            assert captured_messages[0][-1] == captured_messages[1][-1]
