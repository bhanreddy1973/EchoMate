import React from "react";

export type AgentStatus = "idle" | "listening" | "thinking" | "speaking";

interface StatusIndicatorProps {
  status: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#9ca3af",
  listening: "#22c55e",
  thinking: "#f59e0b",
  speaking: "#3b82f6",
};

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <div
      data-testid="status-indicator"
      data-status={status}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        borderRadius: "9999px",
        backgroundColor: "#1f2937",
        color: "#f9fafb",
        fontFamily: "sans-serif",
        fontSize: "14px",
      }}
    >
      <span
        data-testid="status-dot"
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: STATUS_COLORS[status],
          display: "inline-block",
          animation: status !== "idle" ? "pulse 1.5s infinite" : "none",
        }}
      />
      <span data-testid="status-label">{STATUS_LABELS[status]}</span>
    </div>
  );
}
