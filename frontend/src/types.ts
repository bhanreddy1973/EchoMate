export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Thread {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  active: boolean;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type AgentStatus = "idle" | "listening" | "thinking" | "speaking";
