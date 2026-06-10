import { Wifi, WifiOff, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { ConnectionState } from "../types";

interface ConnectionBadgeProps {
  state: ConnectionState;
  onReconnect: () => void;
}

const CONFIG: Record<
  ConnectionState,
  { label: string; dotClass: string; textClass: string; icon: typeof Wifi; spin: boolean }
> = {
  disconnected: {
    label:     "Offline",
    dotClass:  "bg-text-muted",
    textClass: "text-text-muted",
    icon:      WifiOff,
    spin:      false,
  },
  connecting: {
    label:     "Connecting",
    dotClass:  "bg-accent-amber",
    textClass: "text-accent-amber",
    icon:      Loader2,
    spin:      true,
  },
  connected: {
    label:     "Live",
    dotClass:  "bg-accent-green",
    textClass: "text-accent-green",
    icon:      Wifi,
    spin:      false,
  },
  reconnecting: {
    label:     "Reconnecting",
    dotClass:  "bg-accent-amber",
    textClass: "text-accent-amber",
    icon:      Loader2,
    spin:      true,
  },
  failed: {
    label:     "Failed",
    dotClass:  "bg-accent-red",
    textClass: "text-accent-red",
    icon:      WifiOff,
    spin:      false,
  },
};

export default function ConnectionBadge({ state, onReconnect }: ConnectionBadgeProps) {
  const cfg = CONFIG[state];
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-1.5">
      {/* Badge chip */}
      <div
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
          "bg-surface-tertiary border border-border-primary",
          cfg.textClass,
        )}
      >
        {/* Status dot */}
        <span
          className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotClass)}
          style={
            state === "connected"
              ? { animation: "dot-pulse 2.5s ease-in-out infinite" }
              : undefined
          }
        />
        {/* Icon */}
        <Icon
          size={11}
          strokeWidth={2}
          className={cfg.spin ? "animate-spin" : ""}
        />
        {/* Label */}
        <span>{cfg.label}</span>
      </div>

      {/* Reconnect button — only when failed */}
      {state === "failed" && (
        <button
          onClick={onReconnect}
          className="
            w-7 h-7 flex items-center justify-center rounded-lg
            text-text-muted hover:text-accent-blue hover:bg-surface-hover
            transition-all duration-150
          "
          aria-label="Reconnect"
        >
          <RefreshCw size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
