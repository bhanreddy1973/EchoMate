"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, MessageSquare } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export default function NvidiaVoiceChat() {
  const { accentColor, glowColor, setEmotion } = useEmotion();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setEmotion("listening");
    } catch (err: any) {
      setError("Microphone access denied. Please allow mic permissions.");
      console.error("Mic error:", err);
    }
  }, [setEmotion]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setEmotion("thinking");
    }
  }, [isRecording, setEmotion]);

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setEmotion("thinking");

    try {
      // Convert webm to wav for the API
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("system_prompt", "You are EchoMate, a helpful AI voice companion. Be concise, friendly, and conversational. Keep responses under 3 sentences unless asked for detail.");

      const response = await fetch("/api/voice/chat", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setEmotion("concerned");
        return;
      }

      // Add user message
      if (data.userTranscript) {
        setMessages((prev) => [...prev, {
          id: `user-${Date.now()}`,
          role: "user",
          text: data.userTranscript,
          timestamp: new Date(),
        }]);
      }

      // Add assistant message
      setMessages((prev) => [...prev, {
        id: `asst-${Date.now()}`,
        role: "assistant",
        text: data.text,
        timestamp: new Date(),
      }]);

      // Play audio response
      if (data.audio) {
        setIsPlaying(true);
        setEmotion("speaking");
        const audioUrl = `data:audio/wav;base64,${data.audio}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsPlaying(false);
          setEmotion("idle");
          audioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlaying(false);
          setEmotion("idle");
        };

        await audio.play();
      } else {
        setEmotion("idle");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process voice");
      setEmotion("concerned");
    } finally {
      setIsProcessing(false);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setEmotion("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Voice orb button */}
      <motion.button
        onClick={isRecording ? stopRecording : isPlaying ? stopPlayback : startRecording}
        disabled={isProcessing}
        className="relative w-32 h-32 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
        style={{
          background: isRecording
            ? `radial-gradient(circle, ${accentColor}40, ${accentColor}10)`
            : isPlaying
            ? `radial-gradient(circle, #10b98140, #10b98110)`
            : "radial-gradient(circle, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          border: `2px solid ${isRecording ? accentColor : isPlaying ? "#10b981" : "rgba(255,255,255,0.1)"}`,
          boxShadow: isRecording
            ? `0 0 40px ${glowColor}, 0 0 80px ${glowColor}`
            : isPlaying
            ? "0 0 40px rgba(16,185,129,0.3)"
            : "none",
        }}
        animate={isRecording ? { scale: [1, 1.05, 1] } : isProcessing ? { rotate: 360 } : {}}
        transition={isRecording ? { duration: 1.5, repeat: Infinity } : isProcessing ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
      >
        {isProcessing ? (
          <Loader2 size={36} style={{ color: accentColor }} />
        ) : isRecording ? (
          <MicOff size={36} style={{ color: accentColor }} />
        ) : isPlaying ? (
          <Volume2 size={36} className="text-emerald-400" />
        ) : (
          <Mic size={36} className="text-text-muted" />
        )}
      </motion.button>

      {/* Status text */}
      <p className="text-[12px] text-text-muted">
        {isProcessing ? "Processing with Nemotron VoiceChat..." :
         isRecording ? "Listening... tap to stop" :
         isPlaying ? "Speaking... tap to stop" :
         "Tap to speak"}
      </p>

      {/* Model badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "rgba(118,185,0,0.1)", border: "1px solid rgba(118,185,0,0.2)" }}>
        <div className="w-2 h-2 rounded-full bg-[#76b900]" />
        <span className="text-[10px] font-medium text-[#76b900]">NVIDIA Nemotron VoiceChat</span>
      </div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] text-red-400/80 text-center max-w-xs"
        >
          {error}
        </motion.p>
      )}

      {/* Conversation history */}
      {messages.length > 0 && (
        <div className="w-full max-w-md space-y-2 mt-4 max-h-[300px] overflow-y-auto smooth-scroll px-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare size={10} className="text-text-ghost" />
            <span className="text-[9px] text-text-ghost uppercase tracking-wider">Conversation</span>
          </div>
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed"
                  style={msg.role === "user" ? {
                    background: `${accentColor}20`,
                    color: accentColor,
                    border: `1px solid ${accentColor}30`,
                  } : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
