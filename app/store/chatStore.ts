import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  emotion?: string;
  isThinking?: boolean;
  thinkingContent?: string;
  attachments?: { name: string; type: string; size: number }[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  pinned?: boolean;
}

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;

  // Actions
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateLastAssistantMessage: (conversationId: string, content: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  getActiveConversation: () => Conversation | undefined;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  sidebarOpen: true,
  rightSidebarOpen: false,

  createConversation: () => {
    const id = uuidv4();
    const conversation: Conversation = {
      id,
      title: "New Conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id,
    }));
    return id;
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
  },

  addMessage: (conversationId, message) => {
    const msg: ChatMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, msg],
              updatedAt: new Date(),
              title:
                conv.messages.length === 0 && message.role === "user"
                  ? message.content.slice(0, 40) + (message.content.length > 40 ? "..." : "")
                  : conv.title,
            }
          : conv
      ),
    }));
  },

  updateLastAssistantMessage: (conversationId, content) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg, i) =>
                i === conv.messages.length - 1 && msg.role === "assistant"
                  ? { ...msg, content }
                  : msg
              ),
            }
          : conv
      ),
    }));
  },

  deleteConversation: (id) => {
    set((state) => {
      const filtered = state.conversations.filter((c) => c.id !== id);
      return {
        conversations: filtered,
        activeConversationId:
          state.activeConversationId === id
            ? filtered[0]?.id ?? null
            : state.activeConversationId,
      };
    });
  },

  renameConversation: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),

  getActiveConversation: () => {
    const state = get();
    return state.conversations.find((c) => c.id === state.activeConversationId);
  },
}));
