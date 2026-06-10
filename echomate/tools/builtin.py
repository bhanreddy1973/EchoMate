"""Built-in tools for EchoMate Voice Companion.

Provides fallback tool implementations for common operations when no
MCP server exposes a matching tool. Includes timer creation, safe math
evaluation, and date/time utilities.
"""

from __future__ import annotations

import ast
import math
import operator
from datetime import datetime, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def timer_tool(duration_seconds: int) -> dict[str, Any]:
    """Create a timer for the specified duration.

    Args:
        duration_seconds: The timer duration in seconds. Must be positive.

    Returns:
        A dict with a confirmation message and the duration details.
    """
    if duration_seconds <= 0:
        return {
            "success": False,
            "error": "Duration must be a positive number of seconds.",
        }

    minutes, seconds = divmod(duration_seconds, 60)
    hours, minutes = divmod(minutes, 60)

    parts = []
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    if seconds > 0:
        parts.append(f"{seconds} second{'s' if seconds != 1 else ''}")

    duration_str = ", ".join(parts) if parts else "0 seconds"

    return {
        "success": True,
        "message": f"Timer set for {duration_str}.",
        "duration_seconds": duration_seconds,
    }


# Safe math operators allowed in expression evaluation
_SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

# Safe math functions and constants available in expressions
_SAFE_NAMES: dict[str, Any] = {
    "pi": math.pi,
    "e": math.e,
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log,
    "log10": math.log10,
    "ceil": math.ceil,
    "floor": math.floor,
}


def _safe_eval_node(node: ast.AST) -> Any:
    """Recursively evaluate an AST node using only safe operations.

    Args:
        node: An AST node from a parsed expression.

    Returns:
        The computed numeric result.

    Raises:
        ValueError: If the expression contains unsupported operations.
    """
    if isinstance(node, ast.Expression):
        return _safe_eval_node(node.body)
    elif isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value).__name__}")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _SAFE_OPERATORS:
            raise ValueError(f"Unsupported operator: {op_type.__name__}")
        left = _safe_eval_node(node.left)
        right = _safe_eval_node(node.right)
        op_func = _SAFE_OPERATORS[op_type]
        if op_type == ast.Pow and right > 1000:
            raise ValueError("Exponent too large (max 1000).")
        return op_func(left, right)
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _SAFE_OPERATORS:
            raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
        operand = _safe_eval_node(node.operand)
        return _SAFE_OPERATORS[op_type](operand)
    elif isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only simple function calls are supported.")
        func_name = node.func.id
        if func_name not in _SAFE_NAMES or not callable(_SAFE_NAMES[func_name]):
            raise ValueError(f"Unsupported function: {func_name}")
        args = [_safe_eval_node(arg) for arg in node.args]
        return _SAFE_NAMES[func_name](*args)
    elif isinstance(node, ast.Name):
        if node.id not in _SAFE_NAMES:
            raise ValueError(f"Unknown name: {node.id}")
        value = _SAFE_NAMES[node.id]
        if callable(value):
            raise ValueError(f"'{node.id}' is a function, not a value.")
        return value
    else:
        raise ValueError(f"Unsupported expression element: {type(node).__name__}")


def math_calculate(expression: str) -> dict[str, Any]:
    """Safely evaluate a mathematical expression.

    Supports basic arithmetic (+, -, *, /, //, %, **), common math
    functions (sqrt, sin, cos, tan, log, log10, ceil, floor, abs, round),
    and constants (pi, e).

    Args:
        expression: A mathematical expression string to evaluate.

    Returns:
        A dict with the result or an error message.
    """
    if not expression or not expression.strip():
        return {
            "success": False,
            "error": "Expression cannot be empty.",
        }

    try:
        tree = ast.parse(expression.strip(), mode="eval")
        result = _safe_eval_node(tree)
        return {
            "success": True,
            "expression": expression.strip(),
            "result": result,
        }
    except (ValueError, TypeError, ZeroDivisionError, OverflowError) as e:
        return {
            "success": False,
            "expression": expression.strip(),
            "error": str(e),
        }
    except SyntaxError:
        return {
            "success": False,
            "expression": expression.strip(),
            "error": "Invalid mathematical expression.",
        }


def get_current_datetime(timezone_name: str = "UTC") -> dict[str, Any]:
    """Get the current date and time in a specified timezone.

    Args:
        timezone_name: An IANA timezone name (e.g., "UTC", "US/Eastern",
            "Europe/London"). Defaults to "UTC".

    Returns:
        A dict with the formatted datetime information or an error.
    """
    try:
        if timezone_name.upper() == "UTC":
            tz = timezone.utc
        else:
            tz = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, KeyError):
        return {
            "success": False,
            "error": f"Unknown timezone: '{timezone_name}'. Use IANA timezone names like 'US/Eastern', 'Europe/London', 'Asia/Tokyo'.",
        }

    now = datetime.now(tz)
    return {
        "success": True,
        "timezone": timezone_name,
        "datetime": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "day_of_week": now.strftime("%A"),
    }


def get_date_info() -> dict[str, Any]:
    """Get today's date information in UTC.

    Returns:
        A dict with today's date, day of week, day of year, and week number.
    """
    now = datetime.now(timezone.utc)
    return {
        "success": True,
        "date": now.strftime("%Y-%m-%d"),
        "day_of_week": now.strftime("%A"),
        "day_of_year": now.timetuple().tm_yday,
        "week_number": int(now.strftime("%W")),
        "month_name": now.strftime("%B"),
        "year": now.year,
        "is_weekend": now.weekday() >= 5,
    }


# Registry mapping tool names to their implementation functions
BUILTIN_TOOLS: dict[str, Callable[..., dict[str, Any]]] = {
    "timer": timer_tool,
    "math_calculate": math_calculate,
    "get_current_datetime": get_current_datetime,
    "get_date_info": get_date_info,
}

# OpenAI function-calling format schemas for built-in tools
BUILTIN_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "timer",
            "description": "Set a timer for a specified number of seconds. Returns a confirmation message with the formatted duration.",
            "parameters": {
                "type": "object",
                "properties": {
                    "duration_seconds": {
                        "type": "integer",
                        "description": "The timer duration in seconds. Must be a positive integer.",
                    }
                },
                "required": ["duration_seconds"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "math_calculate",
            "description": "Safely evaluate a mathematical expression. Supports arithmetic (+, -, *, /, //, %, **), functions (sqrt, sin, cos, tan, log, log10, ceil, floor, abs, round), and constants (pi, e).",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "A mathematical expression to evaluate, e.g. '2 + 3 * 4', 'sqrt(16)', 'sin(pi/2)'.",
                    }
                },
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_datetime",
            "description": "Get the current date and time in a specified timezone. Returns formatted date, time, and day of week.",
            "parameters": {
                "type": "object",
                "properties": {
                    "timezone_name": {
                        "type": "string",
                        "description": "An IANA timezone name (e.g., 'UTC', 'US/Eastern', 'Europe/London', 'Asia/Tokyo'). Defaults to 'UTC'.",
                        "default": "UTC",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_date_info",
            "description": "Get today's date information including date, day of week, day of year, week number, and whether it's a weekend.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]
