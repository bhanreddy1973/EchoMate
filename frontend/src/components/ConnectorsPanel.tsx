import { useEffect } from "react";
import { X, CalendarDays, Mail, Hash, BookOpen, Code2, Music, CheckSquare, FolderOpen, Video, Layers, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { Connector } from "../types";

const ICON_MAP: Record<string, React.ElementType> = {
  CalendarDays, Mail, Hash, BookOpen, Code2, Music, CheckSquare, FolderOpen, Video, Layers,
};

interface ConnectorsPanelProps {
  connectors: Connector[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

export default function ConnectorsPanel({ connectors, onToggle, onClose }: ConnectorsPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const connectedCount = connectors.filter((c) => c.connected).length;

  const categories = Array.from(new Set(connectors.map((c) => c.category)));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-[fade-in_0.15s_ease]"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-[400px] bg-surface-secondary border-l border-border-primary z-50 flex flex-col shadow-depth-md animate-[fade-in_0.2s_ease]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-text-primary tracking-[-0.01em]">Integrations</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {connectedCount > 0
                ? `${connectedCount} connected · EchoMate can access your data`
                : "Connect your tools for a smarter companion"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Connected badge */}
        {connectedCount > 0 && (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-xl bg-accent-green/8 border border-accent-green/20 flex items-center gap-2.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-accent-green shrink-0" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.6)" }} />
            <p className="text-[12px] text-accent-green font-medium">
              {connectedCount} integration{connectedCount !== 1 ? "s" : ""} active
            </p>
          </div>
        )}

        {/* Connector list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{cat}</p>
              <div className="space-y-2">
                {connectors.filter((c) => c.category === cat).map((connector) => {
                  const Icon = ICON_MAP[connector.iconName] ?? ExternalLink;
                  return (
                    <div
                      key={connector.id}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all duration-150",
                        connector.connected
                          ? "bg-surface-tertiary border-border-primary"
                          : "bg-surface-primary/50 border-border-secondary hover:border-border-primary",
                      )}
                    >
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${connector.color}18`, border: `1px solid ${connector.color}30` }}
                      >
                        <Icon size={16} style={{ color: connector.color }} strokeWidth={1.8} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary leading-snug">{connector.name}</p>
                        <p className="text-[11px] text-text-muted truncate">{connector.description}</p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => onToggle(connector.id)}
                        className={clsx(
                          "relative w-10 h-6 rounded-full transition-all duration-200 shrink-0",
                          connector.connected ? "bg-accent-green" : "bg-surface-hover",
                        )}
                        aria-label={connector.connected ? "Disconnect" : "Connect"}
                      >
                        <span
                          className={clsx(
                            "absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
                            connector.connected ? "left-5" : "left-1",
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-secondary shrink-0">
          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            Connections are stored locally. EchoMate never shares your data externally.
          </p>
        </div>
      </aside>
    </>
  );
}
