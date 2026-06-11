export type EmotionState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "concerned"
  | "excited"
  | "calm";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  text: string;
  priority: TaskPriority;
  dueDate?: Date;
  completed: boolean;
  completedAt?: Date;
  addedByVoice?: boolean;
}

export interface CompletedItem {
  id: string;
  text: string;
  completedAt: Date;
  category: "task" | "habit" | "goal" | "note";
}

export interface MemoryCard {
  id: string;
  content: string;
  date: Date;
  tags: string[];
  pinned: boolean;
  emotion?: EmotionState;
}

export interface MoodPoint {
  date: Date;
  score: number;
  emotion: EmotionState;
}

export interface ConversationBubble {
  id: string;
  text: string;
  role: "user" | "assistant";
  emotion?: EmotionState;
  timestamp: Date;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  prompt: string;
}

export interface DailyBrief {
  greeting: string;
  weather?: { condition: string; temp: string; icon: string };
  nextEvent?: { title: string; time: string };
  suggestion: string;
}

export interface EmotionMetrics {
  current: EmotionState;
  confidence: number;
  latencyMs: number;
  modelName: string;
  connectionState: ConnectionState;
}

export type ReadingCategory = "tech" | "design" | "health" | "finance" | "science" | "other";

export interface ReadingItem {
  id: string;
  title: string;
  url: string;
  category: ReadingCategory;
  addedAt: Date;
  read: boolean;
}

export interface SkillAction {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: string;
}

export interface ConnectorStatus {
  id: string;
  name: string;
  connected: boolean;
  color: string;
}
