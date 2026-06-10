"""Unit tests for the ToolRegistry."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from echomate.models import MCPTool, MCPToolResult, ToolResult
from echomate.tools.registry import ToolRegistry


@pytest.fixture
def mock_mcp_manager():
    """Create a mock MCPManager for testing."""
    manager = MagicMock()
    manager.get_tools_as_openai_functions.return_value = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"},
                    },
                    "required": ["location"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_web",
                "description": "Search the web",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                    },
                    "required": ["query"],
                },
            },
        },
    ]
    manager.list_tools = AsyncMock(
        return_value=[
            MCPTool(
                name="get_weather",
                description="Get weather for a location",
                input_schema={"type": "object", "properties": {"location": {"type": "string"}}},
                server_name="weather",
            ),
            MCPTool(
                name="search_web",
                description="Search the web",
                input_schema={"type": "object", "properties": {"query": {"type": "string"}}},
                server_name="web-search",
            ),
        ]
    )
    manager.call_tool = AsyncMock(
        return_value=MCPToolResult(
            success=True,
            data="Sunny, 72°F",
            latency_ms=150.0,
        )
    )
    return manager


@pytest.fixture
def registry(mock_mcp_manager):
    """Create a ToolRegistry with mock MCPManager."""
    return ToolRegistry(mcp_manager=mock_mcp_manager)


class TestGetAllTools:
    """Tests for ToolRegistry.get_all_tools()."""

    def test_returns_mcp_tools(self, registry):
        """MCP tools are included in the combined list."""
        tools = registry.get_all_tools()
        names = [t["function"]["name"] for t in tools]
        assert "get_weather" in names
        assert "search_web" in names

    def test_returns_builtin_tools(self, registry):
        """Registered built-in tools are included in the combined list."""
        registry.register_builtin(
            name="calculate",
            func=lambda expression: eval(expression),
            description="Evaluate a math expression",
            parameters={
                "type": "object",
                "properties": {"expression": {"type": "string"}},
                "required": ["expression"],
            },
        )
        tools = registry.get_all_tools()
        names = [t["function"]["name"] for t in tools]
        assert "calculate" in names

    def test_mcp_tools_appear_first(self, registry):
        """MCP tools appear before built-in tools in the list."""
        registry.register_builtin(
            name="get_time",
            func=lambda: "12:00",
            description="Get current time",
        )
        tools = registry.get_all_tools()
        names = [t["function"]["name"] for t in tools]
        # MCP tools should be first
        assert names.index("get_weather") < names.index("get_time")
        assert names.index("search_web") < names.index("get_time")

    def test_mcp_takes_priority_over_builtin_with_same_name(self, registry):
        """If MCP and built-in share a name, only MCP definition is included."""
        registry.register_builtin(
            name="get_weather",
            func=lambda location: "built-in weather",
            description="Built-in weather (should be excluded)",
        )
        tools = registry.get_all_tools()
        weather_tools = [
            t for t in tools if t["function"]["name"] == "get_weather"
        ]
        # Only one entry for get_weather
        assert len(weather_tools) == 1
        # And it's the MCP version
        assert weather_tools[0]["function"]["description"] == "Get weather for a location"

    def test_returns_empty_when_no_tools(self):
        """Returns empty list when no MCP or built-in tools are available."""
        manager = MagicMock()
        manager.get_tools_as_openai_functions.return_value = []
        reg = ToolRegistry(mcp_manager=manager)
        assert reg.get_all_tools() == []

    def test_builtin_with_default_parameters(self, registry):
        """Built-in tools without parameters get empty object schema."""
        registry.register_builtin(
            name="get_time",
            func=lambda: "12:00",
            description="Get current time",
        )
        tools = registry.get_all_tools()
        time_tool = next(
            t for t in tools if t["function"]["name"] == "get_time"
        )
        assert time_tool["function"]["parameters"] == {
            "type": "object",
            "properties": {},
        }


class TestResolveAndCall:
    """Tests for ToolRegistry.resolve_and_call()."""

    @pytest.mark.asyncio
    async def test_routes_to_mcp_when_tool_exists(self, registry, mock_mcp_manager):
        """Routes to MCP when tool is found in MCP servers."""
        result = await registry.resolve_and_call(
            "get_weather", {"location": "Seattle"}
        )
        assert result.source == "mcp"
        assert result.success is True
        assert result.data == "Sunny, 72°F"
        assert result.tool_name == "get_weather"
        mock_mcp_manager.call_tool.assert_awaited_once_with(
            "get_weather", {"location": "Seattle"}
        )

    @pytest.mark.asyncio
    async def test_routes_to_builtin_when_not_in_mcp(self, registry, mock_mcp_manager):
        """Routes to built-in when tool is not found in MCP."""
        registry.register_builtin(
            name="calculate",
            func=lambda expression: str(eval(expression)),
            description="Evaluate a math expression",
            parameters={
                "type": "object",
                "properties": {"expression": {"type": "string"}},
            },
        )
        result = await registry.resolve_and_call(
            "calculate", {"expression": "2 + 2"}
        )
        assert result.source == "builtin"
        assert result.success is True
        assert result.data == "4"
        assert result.tool_name == "calculate"

    @pytest.mark.asyncio
    async def test_mcp_priority_over_builtin_for_same_name(self, registry, mock_mcp_manager):
        """MCP tool is called even if built-in with same name exists."""
        registry.register_builtin(
            name="get_weather",
            func=lambda location: "built-in weather",
            description="Built-in weather",
        )
        result = await registry.resolve_and_call(
            "get_weather", {"location": "NYC"}
        )
        assert result.source == "mcp"
        mock_mcp_manager.call_tool.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_error_when_tool_not_found(self, registry):
        """Returns error ToolResult when tool doesn't exist anywhere."""
        result = await registry.resolve_and_call(
            "nonexistent_tool", {"arg": "value"}
        )
        assert result.success is False
        assert result.tool_name == "nonexistent_tool"
        assert "not available" in result.error

    @pytest.mark.asyncio
    async def test_handles_mcp_tool_failure(self, registry, mock_mcp_manager):
        """Propagates MCP tool failure as error ToolResult."""
        mock_mcp_manager.call_tool.return_value = MCPToolResult(
            success=False,
            error="Server timeout",
            latency_ms=10000.0,
        )
        result = await registry.resolve_and_call(
            "get_weather", {"location": "Mars"}
        )
        assert result.source == "mcp"
        assert result.success is False
        assert result.error == "Server timeout"

    @pytest.mark.asyncio
    async def test_handles_builtin_exception(self, registry):
        """Catches exceptions from built-in tools and returns error result."""

        def failing_tool(x: str) -> str:
            raise ValueError("Invalid input")

        registry.register_builtin(
            name="fail_tool",
            func=failing_tool,
            description="A tool that fails",
            parameters={
                "type": "object",
                "properties": {"x": {"type": "string"}},
            },
        )
        result = await registry.resolve_and_call("fail_tool", {"x": "bad"})
        assert result.source == "builtin"
        assert result.success is False
        assert "Invalid input" in result.error

    @pytest.mark.asyncio
    async def test_handles_async_builtin(self, registry):
        """Supports async built-in tool callables."""

        async def async_tool(query: str) -> str:
            return f"Result for {query}"

        registry.register_builtin(
            name="async_search",
            func=async_tool,
            description="An async tool",
            parameters={
                "type": "object",
                "properties": {"query": {"type": "string"}},
            },
        )
        result = await registry.resolve_and_call(
            "async_search", {"query": "test"}
        )
        assert result.source == "builtin"
        assert result.success is True
        assert result.data == "Result for test"


class TestRegisterBuiltin:
    """Tests for ToolRegistry.register_builtin()."""

    def test_registers_tool_successfully(self, registry):
        """Tool is registered and available via get_all_tools."""
        registry.register_builtin(
            name="my_tool",
            func=lambda: "hello",
            description="A test tool",
        )
        tools = registry.get_all_tools()
        names = [t["function"]["name"] for t in tools]
        assert "my_tool" in names

    def test_overwrites_existing_registration(self, registry):
        """Re-registering with same name overwrites the previous entry."""
        registry.register_builtin(
            name="my_tool",
            func=lambda: "v1",
            description="Version 1",
        )
        registry.register_builtin(
            name="my_tool",
            func=lambda: "v2",
            description="Version 2",
        )
        tools = registry.get_all_tools()
        my_tools = [t for t in tools if t["function"]["name"] == "my_tool"]
        assert len(my_tools) == 1
        assert my_tools[0]["function"]["description"] == "Version 2"
