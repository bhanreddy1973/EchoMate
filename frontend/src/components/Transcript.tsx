import React from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

interface TranscriptProps {
  messages: Message[];
}

export default function Transcript({ messages }: TranscriptProps) {
  return (
    <div
      data-testid="transcript"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px",
        overflowY: "auto",
        maxHeight: "400px",
      }}
    >
      {messages.length === 0 ? (
        <p data-testid="transcript-empty" style={{ color: "#9ca3af", textAlign: "center" }}>
          Start speaking to see the conversation here.
        </p>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`message-${msg.role}`}
            data-role={msg.role}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              backgroundColor: msg.role === "user" ? "#3b82f6" : "#374151",
              color: "#f9fafb",
              padding: "8px 14px",
              borderRadius: "12px",
              maxWidth: "75%",
              fontFamily: "sans-serif",
              fontSize: "14px",
            }}
          >
            <span data-testid="message-role" style={{ fontWeight: "bold", fontSize: "11px", opacity: 0.7 }}>
              {msg.role === "user" ? "You" : "EchoMate"}
            </span>
            <p style={{ margin: "4px 0 0" }}>{msg.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
