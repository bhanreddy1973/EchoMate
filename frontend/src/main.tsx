import React from "react";
import ReactDOM from "react-dom/client";
import VoiceAgent from "./components/VoiceAgent";

async function getToken(): Promise<string> {
  const resp = await fetch("/api/token");
  if (!resp.ok) throw new Error("Failed to get token");
  const data = await resp.json();
  return data.token as string;
}

const serverUrl = import.meta.env.VITE_LIVEKIT_URL ?? "";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div style={{ minHeight: "100vh", backgroundColor: "#111827", display: "flex", alignItems: "center" }}>
      <VoiceAgent serverUrl={serverUrl} getToken={getToken} />
    </div>
  </React.StrictMode>
);
