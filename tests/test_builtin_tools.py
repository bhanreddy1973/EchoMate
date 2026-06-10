"""Unit tests for built-in tools module."""

from __future__ import annotations

import math

import pytest

from echomate.tools.builtin import (
    BUILTIN_TOOL_SCHEMAS,
    BUILTIN_TOOLS,
    get_current_datetime,
    get_date_info,
    math_calculate,
    timer_tool,
)


class TestTimerTool:
    """Tests for the timer_tool function."""

    def test_valid_seconds(self):
        result = timer_tool(30)
        assert result["success"] is True
        assert "30 second" in result["message"]
        assert result["duration_seconds"] == 30

    def test_valid_minutes(self):
        result = timer_tool(120)
        assert result["success"] is True
        assert "2 minutes" in result["message"]
        assert result["duration_seconds"] == 120

    def test_valid_hours_minutes_seconds(self):
        result = timer_tool(3661)
        assert result["success"] is True
        assert "1 hour" in result["message"]
        assert "1 minute" in result["message"]
        assert "1 second" in result["message"]

    def test_zero_duration(self):
        result = timer_tool(0)
        assert result["success"] is False
        assert "positive" in result["error"].lower()

    def test_negative_duration(self):
        result = timer_tool(-5)
        assert result["success"] is False
        assert "positive" in result["error"].lower()


class TestMathCalculate:
    """Tests for the math_calculate function."""

    def test_basic_addition(self):
        result = math_calculate("2 + 3")
        assert result["success"] is True
        assert result["result"] == 5

    def test_multiplication(self):
        result = math_calculate("4 * 5")
        assert result["success"] is True
        assert result["result"] == 20

    def test_division(self):
        result = math_calculate("10 / 4")
        assert result["success"] is True
        assert result["result"] == 2.5

    def test_floor_division(self):
        result = math_calculate("10 // 3")
        assert result["success"] is True
        assert result["result"] == 3

    def test_modulo(self):
        result = math_calculate("10 % 3")
        assert result["success"] is True
        assert result["result"] == 1

    def test_power(self):
        result = math_calculate("2 ** 10")
        assert result["success"] is True
        assert result["result"] == 1024

    def test_negative_number(self):
        result = math_calculate("-5 + 3")
        assert result["success"] is True
        assert result["result"] == -2

    def test_sqrt_function(self):
        result = math_calculate("sqrt(16)")
        assert result["success"] is True
        assert result["result"] == 4.0

    def test_pi_constant(self):
        result = math_calculate("pi")
        assert result["success"] is True
        assert abs(result["result"] - math.pi) < 1e-10

    def test_complex_expression(self):
        result = math_calculate("2 * (3 + 4)")
        assert result["success"] is True
        assert result["result"] == 14

    def test_division_by_zero(self):
        result = math_calculate("1 / 0")
        assert result["success"] is False
        assert "error" in result

    def test_empty_expression(self):
        result = math_calculate("")
        assert result["success"] is False

    def test_invalid_expression(self):
        result = math_calculate("hello + world")
        assert result["success"] is False

    def test_unsafe_operation_blocked(self):
        result = math_calculate("__import__('os').system('ls')")
        assert result["success"] is False

    def test_large_exponent_blocked(self):
        result = math_calculate("2 ** 1001")
        assert result["success"] is False
        assert "too large" in result["error"].lower()


class TestGetCurrentDatetime:
    """Tests for the get_current_datetime function."""

    def test_utc_default(self):
        result = get_current_datetime()
        assert result["success"] is True
        assert result["timezone"] == "UTC"
        assert "datetime" in result
        assert "date" in result
        assert "time" in result
        assert "day_of_week" in result

    def test_utc_explicit(self):
        result = get_current_datetime("UTC")
        assert result["success"] is True
        assert result["timezone"] == "UTC"

    def test_valid_timezone(self):
        result = get_current_datetime("US/Eastern")
        assert result["success"] is True
        assert result["timezone"] == "US/Eastern"

    def test_invalid_timezone(self):
        result = get_current_datetime("Invalid/Timezone")
        assert result["success"] is False
        assert "Unknown timezone" in result["error"]


class TestGetDateInfo:
    """Tests for the get_date_info function."""

    def test_returns_all_fields(self):
        result = get_date_info()
        assert result["success"] is True
        assert "date" in result
        assert "day_of_week" in result
        assert "day_of_year" in result
        assert "week_number" in result
        assert "month_name" in result
        assert "year" in result
        assert "is_weekend" in result

    def test_year_is_current(self):
        from datetime import datetime, timezone

        result = get_date_info()
        assert result["year"] == datetime.now(timezone.utc).year

    def test_is_weekend_is_boolean(self):
        result = get_date_info()
        assert isinstance(result["is_weekend"], bool)


class TestBuiltinToolsRegistry:
    """Tests for the BUILTIN_TOOLS dict and BUILTIN_TOOL_SCHEMAS."""

    def test_all_tools_registered(self):
        assert "timer" in BUILTIN_TOOLS
        assert "math_calculate" in BUILTIN_TOOLS
        assert "get_current_datetime" in BUILTIN_TOOLS
        assert "get_date_info" in BUILTIN_TOOLS

    def test_tools_are_callable(self):
        for name, func in BUILTIN_TOOLS.items():
            assert callable(func), f"Tool '{name}' is not callable"

    def test_schemas_count_matches_tools(self):
        assert len(BUILTIN_TOOL_SCHEMAS) == len(BUILTIN_TOOLS)

    def test_schemas_have_correct_format(self):
        for schema in BUILTIN_TOOL_SCHEMAS:
            assert schema["type"] == "function"
            assert "function" in schema
            func_def = schema["function"]
            assert "name" in func_def
            assert "description" in func_def
            assert "parameters" in func_def
            assert func_def["parameters"]["type"] == "object"

    def test_schema_names_match_registry(self):
        schema_names = {s["function"]["name"] for s in BUILTIN_TOOL_SCHEMAS}
        assert schema_names == set(BUILTIN_TOOLS.keys())
