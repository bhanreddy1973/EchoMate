"""MCP Manager for EchoMate Voice Companion.

Manages connections to external MCP (Model Context Protocol) servers,
discovers available tools, and routes tool calls to the correct server.
Handles server failures gracefully by marking unavailable servers and
continuing with remaining connected servers.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from contextlib import AsyncExitStack
from datetime import timedelta
from enum import Enum
from typing import Any

from pydantic import BaseModel

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.types import TextContent

from echomate.models import MCPTool, MCPToolResult

logger = logging.getLogger(__name__)


class MCPServerConfig(BaseModel):
    """Configuration for a single MCP server.

    Attributes:
        name: Unique server identifier.
        command: Server launch command (e.g., "uvx", "npx").
        args: Command-line arguments for the server process.
        env: Environment variables for the server process.
            Supports ${VAR} expansion from the host environment.
        timeout_seconds: Connection timeout in seconds.
        enabled: Whether this server should be connected at startup.
    """

    name: str
    command: str
    args: list[str] = []
    env: dict[str, str] = {}
    timeout_seconds: int = 15
    enabled: bool = True


class MCPServerState(Enum):
    """Connection state of an MCP server.

    Values:
        CONNECTED: Server is connected and tools are available.
        DISCONNECTED: Server is not connected (initial or cleanly shut down).
        ERROR: Server connection failed or was lost.
    """

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


def _expand_env_vars(env: dict[str, str]) -> dict[str, str]:
    """Expand ${VAR} references in environment variable values.

    Args:
        env: Dictionary of environment variables, possibly containing
            ${VAR_NAME} references to host environment variables.

    Returns:
        A new dictionary with all ${VAR} references replaced by their
        values from os.environ. Unresolved references are replaced
        with empty strings.
    """
    pattern = re.compile(r"\$\{([^}]+)\}")
    expanded: dict[str, str] = {}
    for key, value in env.items():
        expanded[key] = pattern.sub(
            lambda m: os.environ.get(m.group(1), ""), value
        )
    return expanded


class _ServerConnection:
    """Internal state for a single MCP server connection.

    Attributes:
        config: The server's configuration.
        state: Current connection state.
        session: Active MCP client session (if connected).
        tools: Tools discovered from this server.
        exit_stack: Async context manager stack for cleanup.
    """

    def __init__(self, config: MCPServerConfig) -> None:
        self.config = config
        self.state: MCPServerState = MCPServerState.DISCONNECTED
        self.session: ClientSession | None = None
        self.tools: list[MCPTool] = []
        self.exit_stack: AsyncExitStack | None = None


class MCPManager:
    """Discovers, connects to, and manages MCP servers and tools.

    The MCPManager is responsible for:
    - Connecting to configured MCP servers via stdio transport
    - Discovering available tools from each server
    - Routing tool calls to the correct server (first match in config order)
    - Handling server failures gracefully
    - Providing tools in OpenAI function-calling format for LLM integration

    Attributes:
        _servers: Ordered list of server connections (config order preserved).
        _tool_call_timeout: Timeout in seconds for individual tool calls.
    """

    def __init__(self, tool_call_timeout: int = 10) -> None:
        """Initialize the MCP Manager.

        Args:
            tool_call_timeout: Timeout in seconds for individual tool calls.
                Defaults to 10 seconds per requirement 4.4.
        """
        self._servers: list[_ServerConnection] = []
        self._tool_call_timeout = tool_call_timeout

    async def initialize(self, servers: list[MCPServerConfig]) -> None:
        """Connect to all configured MCP servers and discover tools.

        Iterates through the server configurations in order, connecting
        to each enabled server with a per-server timeout. Servers that
        fail to connect are marked as ERROR and skipped; remaining
        servers proceed normally.

        Args:
            servers: List of MCP server configurations to connect to.
                Order matters for tool resolution priority.
        """
        self._servers = []

        for config in servers:
            conn = _ServerConnection(config)

            if not config.enabled:
                logger.info(
                    "MCP server '%s' is disabled, skipping",
                    config.name,
                )
                conn.state = MCPServerState.DISCONNECTED
                self._servers.append(conn)
                continue

            try:
                await asyncio.wait_for(
                    self._connect_server(conn),
                    timeout=config.timeout_seconds,
                )
                logger.info(
                    "MCP server '%s' connected, discovered %d tools",
                    config.name,
                    len(conn.tools),
                )
            except asyncio.TimeoutError:
                conn.state = MCPServerState.ERROR
                logger.warning(
                    "MCP server '%s' connection timed out after %ds",
                    config.name,
                    config.timeout_seconds,
                )
            except Exception as exc:
                conn.state = MCPServerState.ERROR
                logger.warning(
                    "MCP server '%s' connection failed: %s",
                    config.name,
                    str(exc),
                )

            self._servers.append(conn)

    async def _connect_server(self, conn: _ServerConnection) -> None:
        """Establish connection to a single MCP server and discover tools.

        Creates a subprocess via stdio transport, initializes the MCP
        session, and lists available tools from the server.

        Args:
            conn: The server connection state object to populate.
        """
        config = conn.config
        expanded_env = _expand_env_vars(config.env)

        # Merge with current environment so the subprocess inherits PATH etc.
        server_env = {**os.environ, **expanded_env} if expanded_env else None

        server_params = StdioServerParameters(
            command=config.command,
            args=config.args,
            env=server_env,
        )

        exit_stack = AsyncExitStack()
        conn.exit_stack = exit_stack

        transport = await exit_stack.enter_async_context(
            stdio_client(server_params)
        )

        # stdio_client yields (read_stream, write_stream)
        read_stream, write_stream = transport

        session = await exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )

        await session.initialize()
        conn.session = session
        conn.state = MCPServerState.CONNECTED

        # Discover tools
        result = await session.list_tools()
        conn.tools = [
            MCPTool(
                name=tool.name,
                description=tool.description or "",
                input_schema=tool.inputSchema if tool.inputSchema else {},
                server_name=config.name,
            )
            for tool in result.tools
        ]

    async def list_tools(self) -> list[MCPTool]:
        """Return all available tools across connected servers.

        Tools are returned in config order (server order preserved),
        which determines resolution priority when multiple servers
        expose tools with the same name.

        Returns:
            List of MCPTool objects from all connected servers.
        """
        tools: list[MCPTool] = []
        for conn in self._servers:
            if conn.state == MCPServerState.CONNECTED:
                tools.extend(conn.tools)
        return tools

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> MCPToolResult:
        """Invoke a tool by name, routing to the correct server.

        Resolution order: first matching server in config order.
        If the tool is found on a server that is currently disconnected,
        an attempt to reconnect is made before failing.

        Args:
            tool_name: The MCP tool name to invoke.
            arguments: Tool arguments as a dictionary.

        Returns:
            MCPToolResult with success/error status, data, and latency.
        """
        start_time = time.perf_counter()

        # Find the server that provides this tool (first match in config order)
        target_conn: _ServerConnection | None = None
        for conn in self._servers:
            if any(t.name == tool_name for t in conn.tools):
                target_conn = conn
                break

        if target_conn is None:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return MCPToolResult(
                success=False,
                error=f"Tool '{tool_name}' not found on any connected server",
                latency_ms=elapsed_ms,
            )

        # If server is in error state, attempt reconnection
        if target_conn.state != MCPServerState.CONNECTED:
            reconnected = await self.reconnect_server(target_conn.config.name)
            if not reconnected:
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                return MCPToolResult(
                    success=False,
                    error=f"Server '{target_conn.config.name}' is unavailable for tool '{tool_name}'",
                    latency_ms=elapsed_ms,
                )

        # Call the tool with timeout
        try:
            result = await asyncio.wait_for(
                target_conn.session.call_tool(  # type: ignore[union-attr]
                    name=tool_name,
                    arguments=arguments,
                ),
                timeout=self._tool_call_timeout,
            )

            elapsed_ms = (time.perf_counter() - start_time) * 1000

            # Check for error in result
            if result.isError:
                error_text = ""
                for content in result.content:
                    if isinstance(content, TextContent):
                        error_text += content.text
                return MCPToolResult(
                    success=False,
                    error=error_text or f"Tool '{tool_name}' returned an error",
                    latency_ms=elapsed_ms,
                )

            # Extract data from content
            data = self._extract_result_data(result.content)
            return MCPToolResult(
                success=True,
                data=data,
                latency_ms=elapsed_ms,
            )

        except asyncio.TimeoutError:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.warning(
                "MCP tool call '%s' timed out after %ds",
                tool_name,
                self._tool_call_timeout,
            )
            return MCPToolResult(
                success=False,
                error=f"Tool '{tool_name}' timed out after {self._tool_call_timeout}s",
                latency_ms=elapsed_ms,
            )
        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            # Mark server as error on unexpected failure
            target_conn.state = MCPServerState.ERROR
            logger.warning(
                "MCP tool call '%s' failed: %s",
                tool_name,
                str(exc),
            )
            return MCPToolResult(
                success=False,
                error=f"Tool '{tool_name}' failed: {str(exc)}",
                latency_ms=elapsed_ms,
            )

    def _extract_result_data(self, content: Any) -> Any:
        """Extract usable data from MCP tool result content.

        Handles TextContent and other content types, returning a simple
        string or list of strings depending on the content.

        Args:
            content: The content list from a CallToolResult.

        Returns:
            Extracted data as a string (single content) or list (multiple).
        """
        if not content:
            return None

        texts: list[str] = []
        for item in content:
            if isinstance(item, TextContent):
                texts.append(item.text)
            else:
                # For non-text content, use string representation
                texts.append(str(item))

        if len(texts) == 1:
            return texts[0]
        return texts

    def get_tools_as_openai_functions(self) -> list[dict[str, Any]]:
        """Convert MCP tools to OpenAI function-calling format for LLM.

        Returns tools in the format expected by OpenAI-compatible APIs
        for function calling, suitable for passing to LiteLLM.

        Returns:
            List of tool definitions in OpenAI function-calling format.
        """
        functions: list[dict[str, Any]] = []
        seen_names: set[str] = set()

        for conn in self._servers:
            if conn.state != MCPServerState.CONNECTED:
                continue
            for tool in conn.tools:
                # Only include first occurrence (config order priority)
                if tool.name in seen_names:
                    continue
                seen_names.add(tool.name)

                function_def: dict[str, Any] = {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.input_schema
                        if tool.input_schema
                        else {"type": "object", "properties": {}},
                    },
                }
                functions.append(function_def)

        return functions

    async def reconnect_server(self, server_name: str) -> bool:
        """Attempt reconnection to a failed or disconnected server.

        Cleans up any existing connection resources and attempts a fresh
        connection with the original configuration timeout.

        Args:
            server_name: Name of the server to reconnect.

        Returns:
            True if reconnection succeeded, False otherwise.
        """
        target_conn: _ServerConnection | None = None
        for conn in self._servers:
            if conn.config.name == server_name:
                target_conn = conn
                break

        if target_conn is None:
            logger.warning(
                "Cannot reconnect: server '%s' not found in configuration",
                server_name,
            )
            return False

        # Clean up existing connection
        await self._cleanup_connection(target_conn)

        try:
            await asyncio.wait_for(
                self._connect_server(target_conn),
                timeout=target_conn.config.timeout_seconds,
            )
            logger.info(
                "MCP server '%s' reconnected, discovered %d tools",
                server_name,
                len(target_conn.tools),
            )
            return True
        except asyncio.TimeoutError:
            target_conn.state = MCPServerState.ERROR
            logger.warning(
                "MCP server '%s' reconnection timed out after %ds",
                server_name,
                target_conn.config.timeout_seconds,
            )
            return False
        except Exception as exc:
            target_conn.state = MCPServerState.ERROR
            logger.warning(
                "MCP server '%s' reconnection failed: %s",
                server_name,
                str(exc),
            )
            return False

    def get_server_status(self) -> dict[str, MCPServerState]:
        """Return connection status of all configured servers.

        Returns:
            Dictionary mapping server name to its current connection state.
        """
        return {conn.config.name: conn.state for conn in self._servers}

    async def _cleanup_connection(self, conn: _ServerConnection) -> None:
        """Clean up resources for a server connection.

        Args:
            conn: The server connection to clean up.
        """
        if conn.exit_stack is not None:
            try:
                await conn.exit_stack.aclose()
            except Exception as exc:
                logger.debug(
                    "Error cleaning up connection to '%s': %s",
                    conn.config.name,
                    str(exc),
                )
            conn.exit_stack = None
        conn.session = None

    async def shutdown(self) -> None:
        """Shut down all MCP server connections and release resources."""
        for conn in self._servers:
            await self._cleanup_connection(conn)
            conn.state = MCPServerState.DISCONNECTED
            conn.tools = []
        logger.info("MCP Manager shut down, all servers disconnected")
