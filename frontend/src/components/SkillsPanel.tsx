import { useEffect } from "react";
import { X, Zap } from "lucide-react";
import clsx from "clsx";
import { Skill } from "../types";

interface SkillsPanelProps {
  skills: Skill[];
  activeSkillId: string | null;
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onClose: () => void;
}

export default function SkillsPanel({ skills, activeSkillId, onActivate, onDeactivate, onClose }: SkillsPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const activeSkill = skills.find((s) => s.id === activeSkillId);
  const categories = Array.from(new Set(skills.map((s) => s.category)));

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-[fade-in_0.15s_ease]"
        onClick={onClose}
      />

      <aside className="fixed right-0 top-0 h-full w-[400px] bg-surface-secondary border-l border-border-primary z-50 flex flex-col shadow-depth-md animate-[fade-in_0.2s_ease]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-text-primary tracking-[-0.01em]">Skill Presets</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {activeSkill
                ? `Active: ${activeSkill.name}`
                : "Choose a mode to specialize EchoMate"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Active skill banner */}
        {activeSkill && (
          <div
            className="mx-5 mt-4 px-4 py-3 rounded-xl border flex items-center gap-3 shrink-0"
            style={{ backgroundColor: `${activeSkill.color}10`, borderColor: `${activeSkill.color}30` }}
          >
            <span className="text-xl">{activeSkill.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary">{activeSkill.name}</p>
              <p className="text-[11px] text-text-muted truncate">{activeSkill.description}</p>
            </div>
            <button
              onClick={onDeactivate}
              className="text-[11px] text-text-muted hover:text-accent-red transition-colors px-2 py-1 rounded-lg hover:bg-accent-red/8"
            >
              Deactivate
            </button>
          </div>
        )}

        {/* Skills list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">{cat}</p>
              <div className="space-y-2">
                {skills.filter((s) => s.category === cat).map((skill) => {
                  const isActive = skill.id === activeSkillId;
                  return (
                    <div
                      key={skill.id}
                      className={clsx(
                        "p-3 rounded-xl border transition-all duration-150",
                        isActive
                          ? "bg-surface-tertiary border-border-primary"
                          : "bg-surface-primary/50 border-border-secondary hover:border-border-primary",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Emoji badge */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: `${skill.color}18`, border: `1px solid ${skill.color}25` }}
                        >
                          {skill.emoji}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-text-primary">{skill.name}</p>
                            {isActive && (
                              <span
                                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                style={{ backgroundColor: `${skill.color}20`, color: skill.color }}
                              >
                                <Zap size={9} strokeWidth={2.5} />
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{skill.description}</p>
                        </div>
                      </div>

                      {/* Action row */}
                      <div className="mt-2.5 flex justify-end">
                        {isActive ? (
                          <button
                            onClick={onDeactivate}
                            className="text-[11px] px-3 py-1.5 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/8 transition-all"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => onActivate(skill.id)}
                            className="text-[11px] px-3 py-1.5 rounded-lg font-medium text-white transition-all"
                            style={{ backgroundColor: skill.color }}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border-secondary shrink-0">
          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            Skills customize EchoMate's persona and response style for your task.
          </p>
        </div>
      </aside>
    </>
  );
}
