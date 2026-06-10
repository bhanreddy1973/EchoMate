"""Tests for the model router complexity classification and ModelRouter class."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from echomate.model_router import (
    AllModelsFailedError,
    ModelRouter,
    classify_complexity,
)
from echomate.models import ModelEndpoint, QueryComplexity


class TestClassifyComplexity:
    """Tests for classify_complexity function."""

    # --- SIMPLE classification tests ---

    def test_greeting_hello(self):
        messages = [{"role": "user", "content": "Hello"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_greeting_hi(self):
        messages = [{"role": "user", "content": "Hi"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_greeting_good_morning(self):
        messages = [{"role": "user", "content": "Good morning"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_confirmation_yes(self):
        messages = [{"role": "user", "content": "Yes"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_confirmation_ok(self):
        messages = [{"role": "user", "content": "Ok"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_confirmation_thanks(self):
        messages = [{"role": "user", "content": "Thanks!"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_confirmation_bye(self):
        messages = [{"role": "user", "content": "Bye"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_confirmation_got_it(self):
        messages = [{"role": "user", "content": "Got it"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    # --- COMPLEX classification tests ---

    def test_complex_compare(self):
        messages = [{"role": "user", "content": "Compare Python and JavaScript for web development"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    def test_complex_analyze(self):
        messages = [{"role": "user", "content": "Analyze the performance metrics from last week"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    def test_complex_step_by_step(self):
        messages = [{"role": "user", "content": "Explain step by step how to deploy a Docker container"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    def test_complex_synthesize(self):
        messages = [{"role": "user", "content": "Synthesize the key findings from the three reports"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    def test_complex_pros_and_cons(self):
        messages = [{"role": "user", "content": "What are the pros and cons of microservices?"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    def test_complex_walk_me_through(self):
        messages = [{"role": "user", "content": "Walk me through setting up authentication in a React app"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    def test_complex_differences_between(self):
        messages = [{"role": "user", "content": "What are the differences between REST and GraphQL?"}]
        assert classify_complexity(messages) == QueryComplexity.COMPLEX

    # --- MODERATE classification tests ---

    def test_moderate_single_fact_lookup(self):
        messages = [{"role": "user", "content": "What time is it in Tokyo?"}]
        assert classify_complexity(messages) == QueryComplexity.MODERATE

    def test_moderate_single_question(self):
        messages = [{"role": "user", "content": "What's the weather like today?"}]
        assert classify_complexity(messages) == QueryComplexity.MODERATE

    def test_moderate_set_reminder(self):
        messages = [{"role": "user", "content": "Set a reminder for my meeting at 3pm tomorrow"}]
        assert classify_complexity(messages) == QueryComplexity.MODERATE

    def test_moderate_short_but_not_greeting(self):
        """Short message that isn't a greeting should be MODERATE, not SIMPLE."""
        messages = [{"role": "user", "content": "What is Python?"}]
        assert classify_complexity(messages) == QueryComplexity.MODERATE

    # --- Edge cases ---

    def test_empty_messages_list(self):
        messages: list[dict] = []
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_no_user_message(self):
        messages = [{"role": "assistant", "content": "How can I help?"}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_uses_last_user_message(self):
        """Should classify based on the last user message, not earlier ones."""
        messages = [
            {"role": "user", "content": "Compare Python and JavaScript"},
            {"role": "assistant", "content": "Here's a comparison..."},
            {"role": "user", "content": "Thanks!"},
        ]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE

    def test_long_greeting_not_simple(self):
        """A greeting followed by a substantial question should not be SIMPLE."""
        messages = [{"role": "user", "content": "Hello there I was wondering if you could help me understand how to set up a complex microservices architecture with event driven communication between all the services"}]
        # This is long (>20 tokens) even though it starts with hello, so not SIMPLE
        # It doesn't match complex keywords either, so MODERATE
        assert classify_complexity(messages) == QueryComplexity.MODERATE

    def test_empty_content(self):
        messages = [{"role": "user", "content": ""}]
        assert classify_complexity(messages) == QueryComplexity.SIMPLE



# --- ModelRouter Tests ---


def _make_test_models() -> list[ModelEndpoint]:
    """Create a test model registry with predictable endpoints."""
    return [
        ModelEndpoint(
            name="test/fast-primary",
            provider="nvidia_nim",
            model_id="nvidia_nim/test-fast-model",
            tier="fast",
            priority=1,
        ),
        ModelEndpoint(
            name="test/reasoning-primary",
            provider="nvidia_nim",
            model_id="nvidia_nim/test-reasoning-model",
            tier="reasoning",
            priority=1,
        ),
        ModelEndpoint(
            name="test/fast-fallback",
            provider="openrouter_free",
            model_id="openrouter/test-fast-fallback",
            tier="fast",
            priority=2,
        ),
        ModelEndpoint(
            name="test/reasoning-fallback",
            provider="openrouter_free",
            model_id="openrouter/test-reasoning-fallback",
            tier="reasoning",
            priority=2,
        ),
        ModelEndpoint(
            name="test/fast-last-resort",
            provider="openrouter_free",
            model_id="openrouter/test-last-resort",
            tier="fast",
            priority=3,
        ),
    ]


def _make_mock_stream_response(tokens: list[str]):
    """Create a mock async iterator that yields token chunks."""

    async def _stream():
        for token in tokens:
            chunk = MagicMock()
            chunk.choices = [MagicMock()]
            chunk.choices[0].delta = MagicMock()
            chunk.choices[0].delta.content = token
            yield chunk

    return _stream()


class TestModelRouterInit:
    """Tests for ModelRouter initialization."""

    def test_default_registry(self):
        router = ModelRouter()
        models = router.get_available_models()
        assert len(models) == 5

    def test_custom_registry(self):
        custom_models = _make_test_models()[:2]
        router = ModelRouter(models=custom_models)
        models = router.get_available_models()
        assert len(models) == 2


class TestGetAvailableModels:
    """Tests for get_available_models method."""

    def test_filter_by_fast_tier(self):
        router = ModelRouter(models=_make_test_models())
        fast_models = router.get_available_models(tier="fast")
        assert len(fast_models) == 3
        assert all(m.tier == "fast" for m in fast_models)

    def test_filter_by_reasoning_tier(self):
        router = ModelRouter(models=_make_test_models())
        reasoning_models = router.get_available_models(tier="reasoning")
        assert len(reasoning_models) == 2
        assert all(m.tier == "reasoning" for m in reasoning_models)

    def test_no_filter_returns_all(self):
        router = ModelRouter(models=_make_test_models())
        all_models = router.get_available_models()
        assert len(all_models) == 5

    def test_sorted_by_priority(self):
        router = ModelRouter(models=_make_test_models())
        fast_models = router.get_available_models(tier="fast")
        priorities = [m.priority for m in fast_models]
        assert priorities == sorted(priorities)

    def test_health_affects_sort_within_same_priority(self):
        """Among same-priority models, lower error rate sorts first."""
        # Create two fast models with the same priority
        models = [
            ModelEndpoint(
                name="test/fast-a",
                provider="nvidia_nim",
                model_id="nvidia_nim/fast-a",
                tier="fast",
                priority=1,
            ),
            ModelEndpoint(
                name="test/fast-b",
                provider="nvidia_nim",
                model_id="nvidia_nim/fast-b",
                tier="fast",
                priority=1,
            ),
        ]
        router = ModelRouter(models=models, stats_window_seconds=60.0)
        # Make fast-a have a high error rate
        for _ in range(10):
            router.update_stats("nvidia_nim/fast-a", latency_ms=1000, success=False, tokens=0)
        # fast-b has no errors

        fast_models = router.get_available_models(tier="fast")
        # fast-b (0% error) should come before fast-a (100% error) at same priority
        assert fast_models[0].model_id == "nvidia_nim/fast-b"
        assert fast_models[1].model_id == "nvidia_nim/fast-a"


class TestUpdateStats:
    """Tests for update_stats method."""

    def test_records_stats(self):
        router = ModelRouter(models=_make_test_models())
        router.update_stats("nvidia_nim/test-fast-model", 200.0, True, 50)
        # Verify via get_available_models that it doesn't crash
        models = router.get_available_models(tier="fast")
        assert len(models) == 3

    def test_rolling_window_prunes_old_entries(self):
        """Old stats entries should be pruned outside the window."""
        router = ModelRouter(models=_make_test_models(), stats_window_seconds=0.1)
        model_id = "nvidia_nim/test-fast-model"
        # Add some failure stats
        for _ in range(5):
            router.update_stats(model_id, 1000.0, False, 0)

        # Wait for the window to expire
        import time
        time.sleep(0.15)

        # Add a new success stat to trigger pruning
        router.update_stats(model_id, 100.0, True, 10)

        # The error rate should now be 0 since old entries are pruned
        error_rate = router._get_recent_error_rate(model_id)
        assert error_rate == 0.0

    def test_error_rate_calculation(self):
        router = ModelRouter(models=_make_test_models(), stats_window_seconds=60.0)
        model_id = "nvidia_nim/test-fast-model"
        # 3 successes, 2 failures
        for _ in range(3):
            router.update_stats(model_id, 100.0, True, 10)
        for _ in range(2):
            router.update_stats(model_id, 500.0, False, 0)

        error_rate = router._get_recent_error_rate(model_id)
        assert error_rate == pytest.approx(0.4)

    def test_error_rate_zero_when_no_stats(self):
        router = ModelRouter(models=_make_test_models())
        error_rate = router._get_recent_error_rate("nonexistent-model")
        assert error_rate == 0.0


class TestModelRouterRoute:
    """Tests for the route() method."""

    @pytest.mark.asyncio
    async def test_route_simple_query_uses_fast_tier(self):
        """Simple queries should route to fast-tier models."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0)
        messages = [{"role": "user", "content": "Hello"}]

        mock_response = _make_mock_stream_response(["Hi", " there", "!"])

        with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_response

            tokens = []
            async for token in router.route(messages):
                tokens.append(token)

            assert tokens == ["Hi", " there", "!"]
            # Should have called with a fast-tier model
            call_kwargs = mock_acompletion.call_args[1]
            assert "test-fast-model" in call_kwargs["model"]

    @pytest.mark.asyncio
    async def test_route_complex_query_uses_reasoning_tier(self):
        """Complex queries should route to reasoning-tier models."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0)
        messages = [{"role": "user", "content": "Compare Python and JavaScript in detail"}]

        mock_response = _make_mock_stream_response(["Python", " is", " great"])

        with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_response

            tokens = []
            async for token in router.route(messages):
                tokens.append(token)

            assert tokens == ["Python", " is", " great"]
            call_kwargs = mock_acompletion.call_args[1]
            assert "test-reasoning-model" in call_kwargs["model"]

    @pytest.mark.asyncio
    async def test_route_passes_tools(self):
        """Tools should be forwarded to litellm.acompletion."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0)
        messages = [{"role": "user", "content": "What's the weather?"}]
        tools = [{"type": "function", "function": {"name": "get_weather"}}]

        mock_response = _make_mock_stream_response(["Sunny"])

        with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_response

            tokens = []
            async for token in router.route(messages, tools=tools):
                tokens.append(token)

            call_kwargs = mock_acompletion.call_args[1]
            assert call_kwargs["tools"] == tools

    @pytest.mark.asyncio
    async def test_route_fallback_on_error(self):
        """Should fallback to next model when primary fails."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0, max_fallbacks=3)
        messages = [{"role": "user", "content": "Hello"}]

        call_count = 0

        async def mock_acompletion(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Model unavailable")
            return _make_mock_stream_response(["Fallback", " response"])

        with patch("litellm.acompletion", side_effect=mock_acompletion):
            tokens = []
            async for token in router.route(messages):
                tokens.append(token)

            assert tokens == ["Fallback", " response"]
            assert call_count == 2

    @pytest.mark.asyncio
    async def test_route_fallback_on_timeout(self):
        """Should fallback to next model when primary times out."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=0.1, max_fallbacks=3)
        messages = [{"role": "user", "content": "Hello"}]

        call_count = 0

        async def mock_acompletion(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                await asyncio.sleep(1.0)  # Exceed timeout
            return _make_mock_stream_response(["OK"])

        with patch("litellm.acompletion", side_effect=mock_acompletion):
            tokens = []
            async for token in router.route(messages):
                tokens.append(token)

            assert tokens == ["OK"]
            assert call_count == 2

    @pytest.mark.asyncio
    async def test_route_raises_all_models_failed(self):
        """Should raise AllModelsFailedError when all models fail."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0, max_fallbacks=3)
        messages = [{"role": "user", "content": "Hello"}]

        async def mock_acompletion(**kwargs):
            raise Exception("All models down")

        with patch("litellm.acompletion", side_effect=mock_acompletion):
            with pytest.raises(AllModelsFailedError) as exc_info:
                async for _ in router.route(messages):
                    pass

            assert exc_info.value.messages == messages
            assert len(exc_info.value.attempts) > 0

    @pytest.mark.asyncio
    async def test_route_max_fallback_limit(self):
        """Should not exceed max_fallbacks attempts."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0, max_fallbacks=2)
        messages = [{"role": "user", "content": "Hello"}]

        call_count = 0

        async def mock_acompletion(**kwargs):
            nonlocal call_count
            call_count += 1
            raise Exception("Model down")

        with patch("litellm.acompletion", side_effect=mock_acompletion):
            with pytest.raises(AllModelsFailedError) as exc_info:
                async for _ in router.route(messages):
                    pass

            # max_fallbacks=2 means initial + 2 fallbacks = 3 attempts total
            assert call_count == 3
            assert len(exc_info.value.attempts) == 3

    @pytest.mark.asyncio
    async def test_route_updates_stats_on_success(self):
        """Successful route should update model stats."""
        router = ModelRouter(models=_make_test_models(), timeout_seconds=5.0)
        messages = [{"role": "user", "content": "Hello"}]

        mock_response = _make_mock_stream_response(["Hi"])

        with patch("litellm.acompletion", new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_response

            async for _ in router.route(messages):
                pass

        # Stats should have been recorded
        model_id = "nvidia_nim/test-fast-model"
        assert model_id in router._stats
        assert len(router._stats[model_id]) == 1
        assert router._stats[model_id][0].success is True


class TestAllModelsFailedError:
    """Tests for AllModelsFailedError exception."""

    def test_preserves_messages(self):
        messages = [{"role": "user", "content": "test"}]
        attempts = [("model-1", "timeout"), ("model-2", "error")]
        error = AllModelsFailedError(messages, attempts)
        assert error.messages == messages
        assert error.attempts == attempts

    def test_error_message(self):
        messages = [{"role": "user", "content": "test"}]
        attempts = [("model-1", "timeout")]
        error = AllModelsFailedError(messages, attempts)
        assert "model-1" in str(error)
        assert "1 attempts" in str(error)
