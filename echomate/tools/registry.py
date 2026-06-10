"""Tool Registry for EchoMate Voice Companion.

Provides a unified interface for resolving and invoking tools from
both MCP servers and built-in tool implementations. The registry
combines tool definitions from all sources into OpenAI function-calling
format for LLM integration, and routes tool calls to the appropriate
handler based on resolution priority (MCP first, then built-in).
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from typing import Any, Callable

from echomate.mcp_manager import MCPManager
from echomate.models import ToolResult

logger = logging.getLogger(__name__)


class BuiltinToolDefinition:
    """Registration entry for a built-in tool.

    Stores both the callable implementation and its OpenAI function
    schema so the tool can be advertised to the LLM and invoked.

    Attributes:
        name: The tool's registered name.
        func: The callable implementing the tool logic.
        schema: OpenAI function-calling format definition for this tool.
    """

    def __init__(
        self,
        name: str,
        func: Callable[..., Any],
        schema: dict[str, Any],
    ) -> None:
        self.name = name
        self.func = func
        self.schema = schema


class ToolRegistry:
    """Unified tool resolution across MCP and built-in tools.

    The ToolRegistry combines tools from external MCP servers (managed
    by MCPManager) with locally registered built-in tools. It provides:

    - A single list of all available tools in OpenAI function format for LLM
    - Unified tool invocation that routes to the correct backend
    - Resolution priority: MCP tools checked first, then built-in tools

    Attributes:
        mcp_manager: The MCPManager instance providing MCP tool access.
        _builtin_tools: Internal registry of built-in tool definitions.
    """

    def __init__(self, mcp_manager: MCPManager) -> None:
        """Initialize the ToolRegistry.

        Args:
            mcp_manager: An initialized MCPManager for MCP tool access.
        """
        self.mcp_manager = mcp_manager
        self._builtin_tools: dict[str, BuiltinToolDefinition] = {}

    def register_builtin(
        self,
        name: str,
        func: Callable[..., Any],
        description: str,
        parameters: dict[str, Any] | None = None,
    ) -> None:
        """Register a built-in tool with its schema.

        Args:
            name: Unique name for the tool (used in LLM function calls).
            func: The callable implementing the tool. Can be sync or async.
            description: Human-readable description of the tool's purpose.
            parameters: JSON Schema defining the tool's parameters. Defaults
                to an empty object schema if not provided.
        """
        schema: dict[str, Any] = {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters
                if parameters
                else {"type": "object", "properties": {}},
            },
        }

        self._builtin_tools[name] = BuiltinToolDefinition(
            name=name,
            func=func,
            schema=schema,
        )
        logger.info("Registered built-in tool: %s", name)

    def get_all_tools(self) -> list[dict[str, Any]]:
        """Get combined tool definitions for LLM (MCP + built-in).

        Returns tools in OpenAI function-calling format, combining
        MCP tools from connected servers with locally registered
        built-in tools. MCP tools appear first in the list.

        If an MCP tool and a built-in tool share the same name,
        only the MCP tool definition is included (MCP takes priority).

        Returns:
            List of tool definitions in OpenAI function-calling format.
        """
        # Get MCP tools first (they have priority)
        mcp_tools = self.mcp_manager.get_tools_as_openai_functions()

        # Collect names already covered by MCP
        mcp_names: set[str] = set()
        for tool_def in mcp_tools:
            func_info = tool_def.get("function", {})
            tool_name = func_info.get("name", "")
            if tool_name:
                mcp_names.add(tool_name)

        # Add built-in tools that don't conflict with MCP names
        combined = list(mcp_tools)
        for name, builtin in self._builtin_tools.items():
            if name not in mcp_names:
                combined.append(builtin.schema)

        return combined

    async def resolve_and_call(
        self, tool_name: str, arguments: dict[str, Any]
    ) -> ToolResult:
        """Resolve tool to MCP or built-in, execute, and return result.

        Resolution priority:
        1. Check if tool exists in MCP (any connected server)
        2. Check if tool exists in built-in registry
        3. Return error if tool not found in either source

        Args:
            tool_name: The name of the tool to invoke.
            arguments: Tool arguments as a dictionary.

        Returns:
            ToolResult with the tool name, source (mcp/builtin),
            success status, and data or error message.
        """
        # Check MCP tools first
        mcp_tools = await self.mcp_manager.list_tools()
        mcp_tool_names = {tool.name for tool in mcp_tools}

        if tool_name in mcp_tool_names:
            logger.debug("Routing tool '%s' to MCP", tool_name)
            mcp_result = await self.mcp_manager.call_tool(tool_name, arguments)
            return ToolResult(
                tool_name=tool_name,
                source="mcp",
                success=mcp_result.success,
                data=mcp_result.data,
                error=mcp_result.error,
            )

        # Check built-in tools
        if tool_name in self._builtin_tools:
            logger.debug("Routing tool '%s' to built-in", tool_name)
            return await self._call_builtin(tool_name, arguments)

        # Tool not found in either source
        logger.warning("Tool '%s' not found in MCP or built-in registry", tool_name)
        return ToolResult(
            tool_name=tool_name,
            source="builtin",
            success=False,
            error=f"Tool '{tool_name}' is not available. No MCP server or built-in tool provides this capability.",
        )

    async def _call_builtin(
        self, tool_name: str, arguments: dict[str, Any]
    ) -> ToolResult:
        """Execute a built-in tool and wrap result in ToolResult.

        Handles both sync and async callables. Catches exceptions
        and returns them as error results.

        Args:
            tool_name: The registered built-in tool name.
            arguments: Tool arguments as a dictionary.

        Returns:
            ToolResult with source="builtin" and execution outcome.
        """
        builtin = self._builtin_tools[tool_name]

        try:
            if inspect.iscoroutinefunction(builtin.func):
                result = await builtin.func(**arguments)
            else:
                result = builtin.func(**arguments)

            return ToolResult(
                tool_name=tool_name,
                source="builtin",
                success=True,
                data=result,
            )
        except Exception as exc:
            logger.warning(
                "Built-in tool '%s' failed: %s",
                tool_name,
                str(exc),
            )
            return ToolResult(
                tool_name=tool_name,
                source="builtin",
                success=False,
                error=f"Built-in tool '{tool_name}' failed: {str(exc)}",
            )
