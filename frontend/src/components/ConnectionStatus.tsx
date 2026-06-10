

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";

interface ConnectionStatusProps {
  state: ConnectionState;
  onReconnect?: () => void;
}

const STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  failed: "Connection failed",
};

const STATE_COLORS: Record<ConnectionState, string> = {
  disconnected: "#9ca3af",
  connecting: "#f59e0b",
  connected: "#22c55e",
  reconnecting: "#f59e0b",
  failed: "#ef4444",
};

export default function ConnectionStatus({ state, onReconnect }: ConnectionStatusProps) {
  return (
    <div
      data-testid="connection-status"
      data-state={state}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        fontFamily: "sans-serif",
        color: STATE_COLORS[state],
      }}
    >
      <span data-testid="connection-label">{STATE_LABELS[state]}</span>
      {state === "failed" && onReconnect && (
        <button
          data-testid="reconnect-button"
          onClick={onReconnect}
          style={{
            padding: "2px 8px",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "11px",
          }}
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
