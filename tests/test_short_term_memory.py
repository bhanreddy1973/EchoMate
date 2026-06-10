"""Unit tests for ShortTermMemory."""

import pytest

from echomate.memory.short_term import ShortTermMemory, _estimate_tokens, _message_tokens


class TestEstimateTokens:
    """Tests for the token estimation helper."""

    def test_empty_string(self):
        assert _estimate_tokens("") == 1  # Minimum of 1

    def test_short_string(self):
        # "Hello" = 5 chars / 4 = 1
        assert _estimate_tokens("Hello") == 1

    def test_longer_string(self):
        # 100 chars / 4 = 25
        text = "a" * 100
        assert _estimate_tokens(text) == 25

    def test_minimum_one_token(self):
        assert _estimate_tokens("ab") == 1


class TestMessageTokens:
    """Tests for the message token estimation."""

    def test_message_includes_overhead(self):
        msg = {"role": "user", "content": "Hello"}
        # content tokens (5/4=1) + 4 overhead = 5
        assert _message_tokens(msg) == 5

    def test_empty_content(self):
        msg = {"role": "assistant", "content": ""}
        # 1 (min) + 4 overhead = 5
        assert _message_tokens(msg) == 5

    def test_missing_content_key(self):
        msg = {"role": "user"}
        # empty string -> 1 + 4 = 5
        assert _message_tokens(msg) == 5


class TestShortTermMemory:
    """Tests for the ShortTermMemory class."""

    def test_init_defaults(self):
        stm = ShortTermMemory()
        assert stm.max_tokens == 4000
        assert stm.messages == []
        assert stm.token_count == 0

    def test_init_custom_max_tokens(self):
        stm = ShortTermMemory(max_tokens=2000)
        assert stm.max_tokens == 2000

    def test_add_single_message(self):
        stm = ShortTermMemory()
        msg = {"role": "user", "content": "Hello!"}
        stm.add(msg)
        assert len(stm.messages) == 1
        assert stm.messages[0] == msg
        assert stm.token_count > 0

    def test_add_preserves_order(self):
        stm = ShortTermMemory()
        msgs = [
            {"role": "user", "content": "First"},
            {"role": "assistant", "content": "Second"},
            {"role": "user", "content": "Third"},
        ]
        for msg in msgs:
            stm.add(msg)
        assert stm.get_messages() == msgs

    def test_get_messages_returns_copy(self):
        stm = ShortTermMemory()
        stm.add({"role": "user", "content": "Hello"})
        result = stm.get_messages()
        result.append({"role": "assistant", "content": "extra"})
        assert len(stm.messages) == 1

    def test_clear(self):
        stm = ShortTermMemory()
        stm.add({"role": "user", "content": "Hello"})
        stm.add({"role": "assistant", "content": "Hi there"})
        stm.clear()
        assert stm.messages == []
        assert stm.token_count == 0

    def test_trim_removes_oldest_when_over_budget(self):
        # Use a very small budget to trigger trimming
        stm = ShortTermMemory(max_tokens=20)
        # Each message with ~100 chars content = 100/4 + 4 = 29 tokens
        msg1 = {"role": "user", "content": "a" * 100}
        msg2 = {"role": "assistant", "content": "b" * 100}

        stm.add(msg1)
        # msg1 alone exceeds 20 tokens, but we keep at least 1 message
        assert len(stm.messages) == 1
        assert stm.messages[0] == msg1

        stm.add(msg2)
        # Now msg2 is added, total exceeds budget, oldest (msg1) should be removed
        assert len(stm.messages) == 1
        assert stm.messages[0] == msg2

    def test_trim_keeps_most_recent_messages(self):
        # Budget of 50 tokens, messages of ~29 tokens each
        stm = ShortTermMemory(max_tokens=50)
        msgs = [
            {"role": "user", "content": "a" * 100},     # ~29 tokens
            {"role": "assistant", "content": "b" * 100},  # ~29 tokens
            {"role": "user", "content": "c" * 100},      # ~29 tokens
        ]
        for msg in msgs:
            stm.add(msg)

        # Only most recent message(s) should remain to stay under 50
        assert stm.token_count <= 50
        # At least the last message should be present
        assert stm.messages[-1] == msgs[-1]

    def test_always_keeps_at_least_one_message(self):
        # Budget of 1 token - impossible to satisfy with any real message
        stm = ShortTermMemory(max_tokens=1)
        msg = {"role": "user", "content": "This is a long message that exceeds the budget"}
        stm.add(msg)
        # Should still keep the most recent message even if over budget
        assert len(stm.messages) == 1
        assert stm.messages[0] == msg

    def test_token_count_tracks_correctly(self):
        stm = ShortTermMemory(max_tokens=10000)
        msg1 = {"role": "user", "content": "Hello"}
        msg2 = {"role": "assistant", "content": "World"}

        stm.add(msg1)
        tokens_after_one = stm.token_count

        stm.add(msg2)
        tokens_after_two = stm.token_count

        assert tokens_after_two > tokens_after_one

    def test_many_messages_within_budget(self):
        stm = ShortTermMemory(max_tokens=4000)
        for i in range(10):
            stm.add({"role": "user", "content": f"Message {i}"})
            stm.add({"role": "assistant", "content": f"Response {i}"})

        # All 20 messages should fit within 4000 tokens
        assert len(stm.messages) == 20
        assert stm.token_count <= 4000
