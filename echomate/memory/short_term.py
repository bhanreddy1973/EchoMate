"""Short-term memory module for EchoMate.

Provides a sliding window conversation buffer that maintains recent
conversation history within a configurable token budget. Messages are
stored in OpenAI format and automatically trimmed (oldest first) when
the token budget is exceeded.
"""

from __future__ import annotations


def _estimate_tokens(text: str) -> int:
    """Estimate the token count of a text string.

    Uses a simple heuristic: length of text divided by 4, which
    approximates tokenization for English text.

    Args:
        text: The text to estimate tokens for.

    Returns:
        Estimated number of tokens.
    """
    return max(1, len(text) // 4)


def _message_tokens(message: dict) -> int:
    """Estimate the token count of a single message.

    Accounts for the message content plus a small overhead for
    the role field and message formatting (~4 tokens).

    Args:
        message: An OpenAI-format message dict with 'role' and 'content' keys.

    Returns:
        Estimated number of tokens for the message.
    """
    content = message.get("content", "")
    # Add ~4 tokens overhead per message for role and formatting
    return _estimate_tokens(content) + 4


class ShortTermMemory:
    """Sliding window conversation buffer with token limit.

    Maintains recent conversation history in OpenAI message format,
    automatically trimming oldest messages when the total token count
    exceeds the configured budget.

    Args:
        max_tokens: Maximum token budget for the conversation buffer.
            Defaults to 4000 tokens.

    Attributes:
        max_tokens: The configured maximum token budget.
        messages: The current list of conversation messages.
    """

    def __init__(self, max_tokens: int = 4000) -> None:
        """Initialize short-term memory with a token budget.

        Args:
            max_tokens: Maximum token budget for the conversation buffer.
                Defaults to 4000 tokens.
        """
        self.max_tokens = max_tokens
        self.messages: list[dict] = []
        self._total_tokens: int = 0

    def add(self, message: dict) -> None:
        """Add a message and trim oldest messages if over token budget.

        Appends the message to the buffer, then removes the oldest messages
        (FIFO order) until the total token count is within the budget.

        Args:
            message: An OpenAI-format message dict with 'role' and 'content' keys.
                Example: {"role": "user", "content": "Hello!"}
        """
        tokens = _message_tokens(message)
        self.messages.append(message)
        self._total_tokens += tokens

        # Trim oldest messages until under budget
        while self._total_tokens > self.max_tokens and len(self.messages) > 1:
            removed = self.messages.pop(0)
            self._total_tokens -= _message_tokens(removed)

    def get_messages(self) -> list[dict]:
        """Return current conversation history.

        Returns:
            A copy of the current message list in chronological order.
        """
        return list(self.messages)

    def clear(self) -> None:
        """Reset the conversation buffer, removing all messages."""
        self.messages.clear()
        self._total_tokens = 0

    @property
    def token_count(self) -> int:
        """Return the current estimated total token count.

        Returns:
            The estimated number of tokens across all stored messages.
        """
        return self._total_tokens
