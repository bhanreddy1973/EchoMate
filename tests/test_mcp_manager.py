"""Tests for MCP Manager module.

Tests cover MCPServerConfig, MCPServerState, environment variable expansion,
tool listing, tool calling, server status, and graceful failure handling.
"""

from __future__ import annotations

import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from echomate.mcp_manager import (
    MCPManager,
    MCPServerConfig,
    MCPServerState,
    _ServerConnection,
    _expand_env_vars,
)
from echomate.models import MCPTool, MCPToolResult


class TestMCPServerConfig:
    """Tests for MCPServerConfig model."""

    def test_default_values(self) -> None:
        config = MCPServerConfig(name="test", command="echo")
        assert config.name == "test"
        assert config.command == "echo"
        assert config.args == []
        assert config.env == {}
        assert config.timeout_seconds == 15
        assert config.enabled is True

    def test_custom_values(self) -> None:
        config = MCPServerConfig(
            name="weather",
            command="uvx",
            args=["weather-mcp-server"],
            env={"API_KEY": "${WEATHER_API_KEY}"},
            timeout_seconds=20,
            enabled=False,
        )
        assert config.name == "weather"
        assert config.command == "uvx"
        assert config.args == ["weather-mcp-server"]
        assert config.env == {"API_KEY": "${WEATHER_API_KEY}"}
        assert config.timeout_seconds == 20
        assert config.enabled is False


class TestMCPServerState:
    """Tests for MCPServerState enum."""

    def test_values(self) -> None:
        assert MCPServerState.CONNECTED.value == "connected"
        assert MCPServerState.DISCONNECTED.value == "disconnected"
        assert MCPServerState.ERROR.value == "error"


class TestExpandEnvVars:
    """Tests for environment variable expansion."""

    def test_simple_expansion(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MY_KEY", "secret123")
        result = _expand_env_vars({"API_KEY": "${MY_KEY}"})
        assert result == {"API_KEY": "secret123"}

    def test_multiple_vars_in_value(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HOST", "localhost")
        monkeypatch.setenv("PORT", "8080")
        result = _expand_env_vars({"URL": "http://${HOST}:${PORT}"})
        assert result == {"URL": "http://localhost:8080"}

    def test_unset_var_becomes_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("NONEXISTENT_VAR", raising=False)
        result = _expand_env_vars({"KEY": "${NONEXISTENT_VAR}"})
        assert result == {"KEY": ""}

    def test_no_expansion_needed(self) -> None:
        result = _expand_env_vars({"KEY": "plain_value"})
        assert result == {"KEY": "plain_value"}

    def test_empty_env(self) -> None:
        result = _expand_env_vars({})
        assert result == {}


class TestMCPManagerInit:
    """Tests for MCPManager initialization."""

    def test_default_timeout(self) -> None:
        manager = MCPManager()
        assert manager._tool_call_timeout == 10

    def test_custom_timeout(self) -> None:
        manager = MCPManager(tool_call_timeout=30)
        assert manager._tool_call_timeout == 30


class TestMCPManagerInitialize:
    """Tests for MCPManager.initialize() method."""

    @pytest.mark.asyncio
    async def test_disabled_server_skipped(self) -> None:
        manager = MCPManager()
        config = MCPServerConfig(name="disabled", command="echo", enabled=False)

        await manager.initialize([config])

        status = manager.get_server_status()
        assert status["disabled"] == MCPServerState.DISCONNECTED

    @pytest.mark.asyncio
    async def test_connection_failure_marks_error(self) -> None:
        manager = MCPManager()
        config = MCPServerConfig(
            name="bad_server",
            command="nonexistent_command_xyz_12345",
            timeout_seconds=2,
        )

        await manager.initialize([config])

        status = manager.get_server_status()
        assert status["bad_server"] == MCPServerState.ERROR

    @pytest.mark.asyncio
    async def test_multiple_servers_with_failure(self) -> None:
        """When one server fails, others should still be attempted."""
        manager = MCPManager()
        configs = [
            MCPServerConfig(name="bad", command="nonexistent_xyz", timeout_seconds=2),
            MCPServerConfig(name="disabled", command="echo", enabled=False),
        ]

        await manager.initialize(configs)

        status = manager.get_server_status()
        assert status["bad"] == MCPServerState.ERROR
        assert status["disabled"] == MCPServerState.DISCONNECTED


class TestMCPManagerListTools:
    """Tests for MCPManager.list_tools() method."""

    @pytest.mark.asyncio
    async def test_no_servers_returns_empty(self) -> None:
        manager = MCPManager()
        await manager.initialize([])
        tools = await manager.list_tools()
        assert tools == []

    @pytest.mark.asyncio
    async def test_only_connected_servers_tools_returned(self) -> None:
        """Tools from disconnected/error servers should not be returned."""
        manager = MCPManager()
        manager._servers = [
            _make_connected_server("server1", [
                MCPTool(name="tool_a", description="A", input_schema={}, server_name="server1"),
            ]),
            _make_error_server("server2", [
                MCPTool(name="tool_b", description="B", input_schema={}, server_name="server2"),
            ]),
        ]

        tools = await manager.list_tools()
        assert len(tools) == 1
        assert tools[0].name == "tool_a"


class TestMCPManagerCallTool:
    """Tests for MCPManager.call_tool() method."""

    @pytest.mark.asyncio
    async def test_tool_not_found(self) -> None:
        manager = MCPManager()
        manager._servers = []

        result = await manager.call_tool("nonexistent", {})

        assert result.success is False
        assert "not found" in result.error  # type: ignore[operator]
        assert result.latency_ms >= 0

    @pytest.mark.asyncio
    async def test_tool_call_success(self) -> None:
        """Successful tool call returns data."""
        from mcp.types import CallToolResult as MCPCallToolResult, TextContent

        manager = MCPManager()
        mock_session = AsyncMock()
        mock_session.call_tool.return_value = MCPCallToolResult(
            content=[TextContent(type="text", text="sunny, 72F")],
            isError=False,
        )

        conn = _make_connected_server(
            "weather",
            [MCPTool(name="get_weather", description="Get weather", input_schema={}, server_name="weather")],
        )
        conn.session = mock_session
        manager._servers = [conn]

        result = await manager.call_tool("get_weather", {"city": "Seattle"})

        assert result.success is True
        assert result.data == "sunny, 72F"
        assert result.latency_ms >= 0
        mock_session.call_tool.assert_called_once_with(
            name="get_weather", arguments={"city": "Seattle"}
        )

    @pytest.mark.asyncio
    async def test_tool_call_error_result(self) -> None:
        """When the server returns isError=True, result should indicate failure."""
        from mcp.types import CallToolResult as MCPCallToolResult, TextContent

        manager = MCPManager()
        mock_session = AsyncMock()
        mock_session.call_tool.return_value = MCPCallToolResult(
            content=[TextContent(type="text", text="API key invalid")],
            isError=True,
        )

        conn = _make_connected_server(
            "weather",
            [MCPTool(name="get_weather", description="", input_schema={}, server_name="weather")],
        )
        conn.session = mock_session
        manager._servers = [conn]

        result = await manager.call_tool("get_weather", {})

        assert result.success is False
        assert "API key invalid" in result.error  # type: ignore[operator]

    @pytest.mark.asyncio
    async def test_tool_call_timeout(self) -> None:
        """Tool call that exceeds timeout returns error."""
        manager = MCPManager(tool_call_timeout=1)
        mock_session = AsyncMock()

        async def slow_call(*args: object, **kwargs: object) -> None:
            await asyncio.sleep(5)

        mock_session.call_tool = slow_call

        conn = _make_connected_server(
            "slow",
            [MCPTool(name="slow_tool", description="", input_schema={}, server_name="slow")],
        )
        conn.session = mock_session
        manager._servers = [conn]

        result = await manager.call_tool("slow_tool", {})

        assert result.success is False
        assert "timed out" in result.error  # type: ignore[operator]

    @pytest.mark.asyncio
    async def test_tool_resolution_first_match_wins(self) -> None:
        """When multiple servers have same tool, first in config order wins."""
        from mcp.types import CallToolResult as MCPCallToolResult, TextContent

        manager = MCPManager()

        mock_session_1 = AsyncMock()
        mock_session_1.call_tool.return_value = MCPCallToolResult(
            content=[TextContent(type="text", text="from server1")],
            isError=False,
        )

        mock_session_2 = AsyncMock()
        mock_session_2.call_tool.return_value = MCPCallToolResult(
            content=[TextContent(type="text", text="from server2")],
            isError=False,
        )

        conn1 = _make_connected_server(
            "server1",
            [MCPTool(name="shared_tool", description="", input_schema={}, server_name="server1")],
        )
        conn1.session = mock_session_1

        conn2 = _make_connected_server(
            "server2",
            [MCPTool(name="shared_tool", description="", input_schema={}, server_name="server2")],
        )
        conn2.session = mock_session_2

        manager._servers = [conn1, conn2]

        result = await manager.call_tool("shared_tool", {})

        assert result.success is True
        assert result.data == "from server1"
        mock_session_1.call_tool.assert_called_once()
        mock_session_2.call_tool.assert_not_called()


class TestMCPManagerOpenAIFunctions:
    """Tests for get_tools_as_openai_functions()."""

    def test_empty_when_no_servers(self) -> None:
        manager = MCPManager()
        manager._servers = []
        assert manager.get_tools_as_openai_functions() == []

    def test_converts_tools_correctly(self) -> None:
        manager = MCPManager()
        manager._servers = [
            _make_connected_server("server1", [
                MCPTool(
                    name="get_weather",
                    description="Get current weather",
                    input_schema={
                        "type": "object",
                        "properties": {"city": {"type": "string"}},
                        "required": ["city"],
                    },
                    server_name="server1",
                ),
            ]),
        ]

        functions = manager.get_tools_as_openai_functions()

        assert len(functions) == 1
        fn = functions[0]
        assert fn["type"] == "function"
        assert fn["function"]["name"] == "get_weather"
        assert fn["function"]["description"] == "Get current weather"
        assert fn["function"]["parameters"]["type"] == "object"
        assert "city" in fn["function"]["parameters"]["properties"]

    def test_deduplicates_by_name_first_wins(self) -> None:
        """Only the first tool with a given name should appear."""
        manager = MCPManager()
        manager._servers = [
            _make_connected_server("server1", [
                MCPTool(name="tool_a", description="From S1", input_schema={}, server_name="server1"),
            ]),
            _make_connected_server("server2", [
                MCPTool(name="tool_a", description="From S2", input_schema={}, server_name="server2"),
            ]),
        ]

        functions = manager.get_tools_as_openai_functions()

        assert len(functions) == 1
        assert functions[0]["function"]["description"] == "From S1"

    def test_skips_disconnected_servers(self) -> None:
        manager = MCPManager()
        manager._servers = [
            _make_error_server("bad", [
                MCPTool(name="tool_x", description="", input_schema={}, server_name="bad"),
            ]),
        ]

        functions = manager.get_tools_as_openai_functions()
        assert functions == []


class TestMCPManagerServerStatus:
    """Tests for get_server_status()."""

    def test_returns_all_servers(self) -> None:
        manager = MCPManager()
        manager._servers = [
            _make_connected_server("s1", []),
            _make_error_server("s2", []),
        ]

        status = manager.get_server_status()

        assert status == {
            "s1": MCPServerState.CONNECTED,
            "s2": MCPServerState.ERROR,
        }


class TestMCPManagerReconnect:
    """Tests for reconnect_server()."""

    @pytest.mark.asyncio
    async def test_reconnect_unknown_server(self) -> None:
        manager = MCPManager()
        manager._servers = []

        result = await manager.reconnect_server("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_reconnect_failure(self) -> None:
        """Reconnection attempt that fails marks server as error."""
        manager = MCPManager()
        conn = _ServerConnection(
            MCPServerConfig(name="bad", command="nonexistent_xyz_999", timeout_seconds=2)
        )
        conn.state = MCPServerState.ERROR
        manager._servers = [conn]

        result = await manager.reconnect_server("bad")

        assert result is False
        assert conn.state == MCPServerState.ERROR


class TestMCPManagerShutdown:
    """Tests for shutdown()."""

    @pytest.mark.asyncio
    async def test_shutdown_clears_state(self) -> None:
        manager = MCPManager()
        manager._servers = [
            _make_connected_server("s1", [
                MCPTool(name="tool_a", description="", input_schema={}, server_name="s1"),
            ]),
        ]

        await manager.shutdown()

        status = manager.get_server_status()
        assert status["s1"] == MCPServerState.DISCONNECTED
        assert manager._servers[0].tools == []


# ---------- Test helpers ----------


def _make_connected_server(name: str, tools: list[MCPTool]) -> _ServerConnection:
    """Create a mock connected server connection for testing."""
    conn = _ServerConnection(MCPServerConfig(name=name, command="echo"))
    conn.state = MCPServerState.CONNECTED
    conn.tools = tools
    conn.session = AsyncMock()
    return conn


def _make_error_server(name: str, tools: list[MCPTool]) -> _ServerConnection:
    """Create a mock error-state server connection for testing."""
    conn = _ServerConnection(MCPServerConfig(name=name, command="echo"))
    conn.state = MCPServerState.ERROR
    conn.tools = tools
    conn.session = None
    return conn
