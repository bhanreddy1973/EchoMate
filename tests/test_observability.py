"""Unit tests for echomate.observability module."""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from echomate.models import MCPServerStats, ModelStats, PipelineMetrics
from echomate.observability import MetricsCollector, StructuredLogger


class TestStructuredLogger:
    """Tests for the StructuredLogger class."""

    def test_info_outputs_json(self, capfd):
        logger = StructuredLogger("test_info_json", level="INFO")
        logger.info("test_event", key="value", count=42)
        captured = capfd.readouterr()
        log_data = json.loads(captured.err.strip())
        assert log_data["level"] == "INFO"
        assert log_data["event"] == "test_event"
        assert log_data["key"] == "value"
        assert log_data["count"] == 42
        assert "timestamp" in log_data

    def test_warning_outputs_json(self, capfd):
        logger = StructuredLogger("test_warn_json", level="WARNING")
        logger.warning("budget_exceeded", component="ASR", measured=350)
        captured = capfd.readouterr()
        log_data = json.loads(captured.err.strip())
        assert log_data["level"] == "WARNING"
        assert log_data["event"] == "budget_exceeded"
        assert log_data["component"] == "ASR"

    def test_error_outputs_json(self, capfd):
        logger = StructuredLogger("test_error_json", level="ERROR")
        logger.error("pipeline_failed", reason="timeout")
        captured = capfd.readouterr()
        log_data = json.loads(captured.err.strip())
        assert log_data["level"] == "ERROR"
        assert log_data["event"] == "pipeline_failed"

    def test_debug_filtered_at_info_level(self, capfd):
        logger = StructuredLogger("test_debug_filter", level="INFO")
        logger.debug("should_not_appear")
        captured = capfd.readouterr()
        assert captured.err == ""

    def test_debug_visible_at_debug_level(self, capfd):
        logger = StructuredLogger("test_debug_visible", level="DEBUG")
        logger.debug("should_appear", detail="yes")
        captured = capfd.readouterr()
        log_data = json.loads(captured.err.strip())
        assert log_data["level"] == "DEBUG"
        assert log_data["event"] == "should_appear"

    def test_timestamp_is_utc_iso_format(self, capfd):
        logger = StructuredLogger("test_utc", level="INFO")
        logger.info("timestamp_check")
        captured = capfd.readouterr()
        log_data = json.loads(captured.err.strip())
        ts = log_data["timestamp"]
        # Should be parseable and include timezone info
        parsed = datetime.fromisoformat(ts)
        assert parsed.tzinfo is not None


class TestMetricsCollector:
    """Tests for the MetricsCollector class."""

    def test_start_request_returns_uuid4(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        # UUID4 format: 8-4-4-4-12 hex chars
        assert len(req_id) == 36
        parts = req_id.split("-")
        assert len(parts) == 5

    def test_complete_request_produces_pipeline_metrics(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_asr_latency(req_id, 150.0)
        collector.record_llm_metrics(req_id, "nvidia/nemotron", 320.0, 45)
        collector.record_tts_latency(req_id, 180.0)

        metrics = collector.complete_request(req_id)

        assert isinstance(metrics, PipelineMetrics)
        assert metrics.request_id == req_id
        assert metrics.asr_latency_ms == 150.0
        assert metrics.llm_model == "nvidia/nemotron"
        assert metrics.llm_ttft_ms == 320.0
        assert metrics.llm_tokens == 45
        assert metrics.tts_latency_ms == 180.0
        assert metrics.total_v2v_ms is not None
        assert metrics.total_v2v_ms >= 0
        assert metrics.success is True

    def test_failed_request_produces_metrics_entry(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_asr_latency(req_id, 200.0)

        metrics = collector.complete_request(
            req_id, success=False, error_component="LLM", error_category="timeout"
        )

        assert metrics.success is False
        assert metrics.error_component == "LLM"
        assert metrics.error_category == "timeout"
        assert metrics.asr_latency_ms == 200.0

    def test_unknown_request_still_produces_metrics(self):
        collector = MetricsCollector()
        metrics = collector.complete_request("nonexistent-id")

        assert isinstance(metrics, PipelineMetrics)
        assert metrics.success is False
        assert metrics.error_category == "unknown_request"

    def test_record_mcp_call(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_mcp_call(req_id, "weather", "get_forecast", 250.0, True)
        collector.record_mcp_call(req_id, "calendar", "list_events", 180.0, False)

        metrics = collector.complete_request(req_id)
        assert metrics is not None

    def test_check_latency_budgets_no_violations(self):
        collector = MetricsCollector()
        metrics = PipelineMetrics(
            request_id="test-ok",
            timestamp=datetime.now(tz=timezone.utc),
            asr_latency_ms=200.0,
            llm_ttft_ms=400.0,
            tts_latency_ms=150.0,
        )
        violations = collector.check_latency_budgets(metrics)
        assert violations == []

    def test_check_latency_budgets_asr_exceeded(self):
        collector = MetricsCollector()
        metrics = PipelineMetrics(
            request_id="test-asr",
            timestamp=datetime.now(tz=timezone.utc),
            asr_latency_ms=350.0,
        )
        violations = collector.check_latency_budgets(metrics)
        assert len(violations) == 1
        assert "ASR" in violations[0]
        assert "350.0" in violations[0]

    def test_check_latency_budgets_llm_exceeded(self):
        collector = MetricsCollector()
        metrics = PipelineMetrics(
            request_id="test-llm",
            timestamp=datetime.now(tz=timezone.utc),
            llm_ttft_ms=600.0,
        )
        violations = collector.check_latency_budgets(metrics)
        assert len(violations) == 1
        assert "LLM" in violations[0]

    def test_check_latency_budgets_tts_exceeded(self):
        collector = MetricsCollector()
        metrics = PipelineMetrics(
            request_id="test-tts",
            timestamp=datetime.now(tz=timezone.utc),
            tts_latency_ms=250.0,
        )
        violations = collector.check_latency_budgets(metrics)
        assert len(violations) == 1
        assert "TTS" in violations[0]

    def test_check_latency_budgets_all_exceeded(self):
        collector = MetricsCollector()
        metrics = PipelineMetrics(
            request_id="test-all",
            timestamp=datetime.now(tz=timezone.utc),
            asr_latency_ms=400.0,
            llm_ttft_ms=700.0,
            tts_latency_ms=300.0,
        )
        violations = collector.check_latency_budgets(metrics)
        assert len(violations) == 3

    def test_check_latency_budgets_none_values_no_violations(self):
        collector = MetricsCollector()
        metrics = PipelineMetrics(
            request_id="test-none",
            timestamp=datetime.now(tz=timezone.utc),
        )
        violations = collector.check_latency_budgets(metrics)
        assert violations == []

    def test_get_model_stats_within_window(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_llm_metrics(req_id, "model-a", 200.0, 30)
        collector.complete_request(req_id)

        req_id2 = collector.start_request()
        collector.record_llm_metrics(req_id2, "model-a", 300.0, 50)
        collector.complete_request(req_id2)

        stats = collector.get_model_stats(window_seconds=300)
        assert "model-a" in stats
        assert stats["model-a"].total_requests == 2
        assert stats["model-a"].avg_latency_ms == 250.0
        assert stats["model-a"].error_rate == 0.0

    def test_get_model_stats_excludes_old_records(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_llm_metrics(req_id, "model-old", 200.0, 30)
        collector.complete_request(req_id)

        # Manually age the record
        collector._llm_records[-1].timestamp = time.time() - 600

        stats = collector.get_model_stats(window_seconds=300)
        assert "model-old" not in stats

    def test_get_mcp_stats_within_window(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_mcp_call(req_id, "weather", "get_forecast", 100.0, True)
        collector.record_mcp_call(req_id, "weather", "get_forecast", 200.0, True)
        collector.record_mcp_call(req_id, "weather", "get_current", 150.0, False)
        collector.complete_request(req_id)

        stats = collector.get_mcp_stats(window_seconds=300)
        assert "weather" in stats
        weather_stats = stats["weather"]
        assert weather_stats.avg_latency_ms == 150.0
        assert weather_stats.error_rate == pytest.approx(1 / 3, abs=0.01)
        assert weather_stats.tool_usage["get_forecast"] == 2
        assert weather_stats.tool_usage["get_current"] == 1

    def test_get_mcp_stats_excludes_old_records(self):
        collector = MetricsCollector()
        req_id = collector.start_request()
        collector.record_mcp_call(req_id, "old-server", "tool", 100.0, True)
        collector.complete_request(req_id)

        # Manually age the record
        collector._mcp_records[-1].timestamp = time.time() - 600

        stats = collector.get_mcp_stats(window_seconds=300)
        assert "old-server" not in stats

    def test_every_request_produces_metrics_entry(self):
        """Property 7: Every request produces a metrics entry."""
        collector = MetricsCollector()

        # Success case
        req_id1 = collector.start_request()
        collector.complete_request(req_id1)

        # Failure case
        req_id2 = collector.start_request()
        collector.complete_request(req_id2, success=False, error_component="TTS")

        # Unknown request case
        collector.complete_request("unknown-xyz")

        assert len(collector._completed_metrics) == 3
        assert collector._completed_metrics[0].request_id == req_id1
        assert collector._completed_metrics[1].request_id == req_id2
        assert collector._completed_metrics[2].request_id == "unknown-xyz"
