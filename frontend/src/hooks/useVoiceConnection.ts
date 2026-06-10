import { useState, useRef, useCallback, useEffect } from "react";
import { Room, RoomEvent, RemoteParticipant, Track } from "livekit-client";
import { ConnectionState, AgentStatus } from "../types";

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

interface UseVoiceConnectionReturn {
  connectionState: ConnectionState;
  agentStatus: AgentStatus;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  room: Room | null;
}

export function useVoiceConnection(): UseVoiceConnectionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const roomRef = useRef<Room | null>(null);

  const serverUrl = import.meta.env.VITE_LIVEKIT_URL ?? "";

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    setConnectionState("connecting");
    setError(null);

    try {
      // Fetch token from the token server
      const resp = await Promise.race([
        fetch("/api/token"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 10_000)
        ),
      ]);

      if (!resp.ok) throw new Error("Failed to get connection token");

      const data = await resp.json();
      const token = data.token;
      const url = data.url || serverUrl;

      if (!url) throw new Error("No LiveKit server URL configured");
      if (!token) throw new Error("No token received from server");

      // Disconnect existing room if any
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      // Create and connect to LiveKit room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        if (!mountedRef.current) return;
        setConnectionState("connected");
        setAgentStatus("listening");
        reconnectAttemptsRef.current = 0;
        backoffRef.current = INITIAL_BACKOFF_MS;
      });

      room.on(RoomEvent.Disconnected, () => {
        if (!mountedRef.current) return;
        setConnectionState("disconnected");
        setAgentStatus("idle");
      });

      room.on(RoomEvent.Reconnecting, () => {
        if (!mountedRef.current) return;
        setConnectionState("reconnecting");
      });

      room.on(RoomEvent.Reconnected, () => {
        if (!mountedRef.current) return;
        setConnectionState("connected");
      });

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log("[EchoMate] Agent connected:", participant.identity);
      });

      room.on(RoomEvent.TrackSubscribed, (track, _publication, _participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          // Attach audio track to play agent's voice
          const audioElement = track.attach();
          document.body.appendChild(audioElement);
          setAgentStatus("speaking");
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => el.remove());
          setAgentStatus("listening");
        }
      });

      // Connect to the room
      await room.connect(url, token, { autoSubscribe: true });

      // Publish local microphone
      await room.localParticipant.setMicrophoneEnabled(true);

      roomRef.current = room;

      if (!mountedRef.current) return;
      setConnectionState("connected");
      setAgentStatus("listening");
      reconnectAttemptsRef.current = 0;
      backoffRef.current = INITIAL_BACKOFF_MS;
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg.includes("Permission") || msg.includes("microphone")) {
        setError(
          "Microphone permission denied. Please allow microphone access and refresh."
        );
        setConnectionState("failed");
      } else {
        scheduleReconnect(msg);
      }
    }
  }, [serverUrl]);

  const disconnect = useCallback(async () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionState("disconnected");
    setAgentStatus("idle");
    setError(null);
  }, []);

  const scheduleReconnect = (reason: string) => {
    if (!mountedRef.current) return;
    const attempts = reconnectAttemptsRef.current;

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionState("failed");
      setError(
        `Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts: ${reason}`
      );
      return;
    }

    setConnectionState("reconnecting");
    reconnectAttemptsRef.current += 1;
    const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
    backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  };

  const handleManualConnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    backoffRef.current = INITIAL_BACKOFF_MS;
    connect();
  }, [connect]);

  // Cleanup on unmount only — no auto-connect
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    connectionState,
    agentStatus,
    error,
    connect: handleManualConnect,
    disconnect,
    room: roomRef.current,
  };
}
