"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/store/chatStore";
import { useEmotion } from "@/context/EmotionContext";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import WelcomeScreen from "./WelcomeScreen";
import ParticleField from "./ParticleField";
import FloatingOrb from "./FloatingOrb";

interface ChatLayoutProps {
  onSpatialView?: () => void;
}

export default function ChatLayout({ onSpatialView }: ChatLayoutProps) {
  const {
    conversations,
    activeConversationId,
    createConversation,
    addMessage,
    getActiveConversation,
  } = useChatStore();
  const { setEmotion } = useEmotion();
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  const activeConversation = getActiveConversation();
  const messages = activeConversation?.messages ?? [];

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isLoading]);

  const handleSend = useCallback(
    async (text: string, attachments?: File[]) => {
      let convId = activeConversationId;
      if (!convId) {
        convId = createConversation();
      }

      // Add user message
      addMessage(convId, {
        role: "user",
        content: text,
        attachments: attachments?.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      });

      // Start loading
      setIsLoading(true);
      setEmotion("thinking");

      try {
        const conversation = useChatStore.getState().conversations.find((c) => c.id === convId);
        const messageHistory = conversation?.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })) ?? [];

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messageHistory,
            sessionId: sessionIdRef.current,
          }),
        });

        const data = await res.json();
        if (data.sessionId) sessionIdRef.current = data.sessionId;

        addMessage(convId, {
          role: "assistant",
          content: data.response ?? "Sorry, I couldn't get a response.",
        });

        setEmotion("speaking");
        setTimeout(() => setEmotion("idle"), 2000);
      } catch {
        addMessage(convId, {
          role: "assistant",
          content: "⚠️ Connection failed. Please check that the backend is running.",
        });
        setEmotion("concerned");
        setTimeout(() => setEmotion("idle"), 3000);
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, createConversation, addMessage, setEmotion]
  );

  const handleSuggestionClick = (prompt: string) => {
    handleSend(prompt);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Background ambient effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.03) 0%, transparent 60%),
              radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.02) 0%, transparent 50%)
            `,
          }}
        />
        {/* Particle field */}
        <ParticleField />

        {/* Header */}
        <ChatHeader onSpatialView={onSpatialView} />

        {/* Messages or Welcome */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative smooth-scroll"
          style={{ scrollBehavior: "smooth" }}
        >
          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isLatest={i === messages.length - 1 && msg.role === "assistant"}
                  />
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              <AnimatePresence>
                {isLoading && <TypingIndicator />}
              </AnimatePresence>

              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 relative">
          {/* Gradient fade above input */}
          <div
            className="absolute -top-16 inset-x-0 h-16 pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, transparent, rgba(4,4,10,0.9))",
            }}
          />
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={messages.length === 0 ? "Ask EchoMate anything..." : undefined}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <RightSidebar />

      {/* Floating Voice Orb */}
      <FloatingOrb />
    </div>
  );
}
