import { Room, RoomOptions } from "livekit-client";

export interface LiveKitConfig {
  serverUrl: string;
  token: string;
}

export const DEFAULT_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
};

export async function connectToRoom(config: LiveKitConfig): Promise<Room> {
  const room = new Room(DEFAULT_ROOM_OPTIONS);
  await room.connect(config.serverUrl, config.token, {
    autoSubscribe: true,
  });
  return room;
}

export function getServerUrl(): string {
  return import.meta.env.VITE_LIVEKIT_URL ?? "";
}
