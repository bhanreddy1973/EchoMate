import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import StatusIndicator from "../components/StatusIndicator";
import Transcript from "../components/Transcript";
import ConnectionStatus from "../components/ConnectionStatus";

// ---------------------------------------------------------------------------
// StatusIndicator
// ---------------------------------------------------------------------------

describe("StatusIndicator", () => {
  it("renders listening state", () => {
    render(<StatusIndicator status="listening" />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Listening…");
  });

  it("renders thinking state", () => {
    render(<StatusIndicator status="thinking" />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Thinking…");
  });

  it("renders speaking state", () => {
    render(<StatusIndicator status="speaking" />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Speaking…");
  });

  it("renders idle state", () => {
    render(<StatusIndicator status="idle" />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Idle");
  });

  it("sets data-status attribute", () => {
    render(<StatusIndicator status="listening" />);
    expect(screen.getByTestId("status-indicator")).toHaveAttribute("data-status", "listening");
  });
});

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

describe("Transcript", () => {
  it("shows empty state when no messages", () => {
    render(<Transcript messages={[]} />);
    expect(screen.getByTestId("transcript-empty")).toBeInTheDocument();
  });

  it("renders user and assistant messages", () => {
    const messages = [
      { id: "1", role: "user" as const, content: "Hello EchoMate" },
      { id: "2", role: "assistant" as const, content: "Hello! How can I help?" },
    ];
    render(<Transcript messages={messages} />);
    expect(screen.getByText("Hello EchoMate")).toBeInTheDocument();
    expect(screen.getByText("Hello! How can I help?")).toBeInTheDocument();
  });

  it("distinguishes user vs assistant with data-role", () => {
    const messages = [
      { id: "1", role: "user" as const, content: "Hi" },
    ];
    render(<Transcript messages={messages} />);
    expect(screen.getByTestId("message-user")).toHaveAttribute("data-role", "user");
  });

  it("renders multiple messages in order", () => {
    const messages = [
      { id: "1", role: "user" as const, content: "First" },
      { id: "2", role: "assistant" as const, content: "Second" },
      { id: "3", role: "user" as const, content: "Third" },
    ];
    render(<Transcript messages={messages} />);
    const texts = screen.getAllByText(/First|Second|Third/);
    expect(texts).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// ConnectionStatus
// ---------------------------------------------------------------------------

describe("ConnectionStatus", () => {
  it("shows connected state", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByTestId("connection-label")).toHaveTextContent("Connected");
  });

  it("shows reconnecting state", () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByTestId("connection-label")).toHaveTextContent("Reconnecting…");
  });

  it("shows failed state with reconnect button", () => {
    const onReconnect = vi.fn();
    render(<ConnectionStatus state="failed" onReconnect={onReconnect} />);
    const btn = screen.getByTestId("reconnect-button");
    fireEvent.click(btn);
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it("does not render reconnect button when not failed", () => {
    render(<ConnectionStatus state="connected" onReconnect={vi.fn()} />);
    expect(screen.queryByTestId("reconnect-button")).not.toBeInTheDocument();
  });
});
