export interface Attachment {
  id: string;
  name: string;
  type: "pdf" | "image" | "text" | "csv" | "doc" | "other";
  size: number;
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  iconName: string;
  connected: boolean;
  category: string;
  color: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  color: string;
  prompt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  attachments?: Attachment[];
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
