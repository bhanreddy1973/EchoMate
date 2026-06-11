"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, X, FileText, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";

export interface ChatSkill {
  id: string;
  label: string;
  color: string;
  prefix: string;
  description: string;
  mdContent?: string;
  mdFileName?: string;
}

const PALETTE = ["#60a5fa","#a78bfa","#34d399","#f87171","#fbbf24","#e879f9","#fb923c","#38bdf8"];

export const DEFAULT_SKILLS: ChatSkill[] = [
  { id: "summarise", label: "Summarise", color: "#60a5fa", prefix: "Summarise this: ",          description: "Condense text into key points"  },
  { id: "write",     label: "Write",     color: "#a78bfa", prefix: "Write a ",                  description: "Draft emails, docs or messages" },
  { id: "research",  label: "Research",  color: "#34d399", prefix: "Research ",                 description: "Deep-dive into any topic"       },
  { id: "code",      label: "Code",      color: "#f87171", prefix: "Write code to ",            description: "Generate or explain code"       },
  { id: "explain",   label: "Explain",   color: "#fbbf24", prefix: "Explain in simple terms: ", description: "Break down complex ideas"       },
  { id: "translate", label: "Translate", color: "#e879f9", prefix: "Translate to English: ",    description: "Translate any language"         },
];

interface Props {
  skills: ChatSkill[];
  onSkillsChange: (skills: ChatSkill[]) => void;
  onUse: (skill: ChatSkill) => void;
  onClose: () => void;
}

export default function SkillsPanel({ skills, onSkillsChange, onUse, onClose }: Props) {
  const { accentColor } = useEmotion();
  const [addOpen, setAddOpen]           = useState(false);
  const [label, setLabel]               = useState("");
  const [prefix, setPrefix]             = useState("");
  const [desc, setDesc]                 = useState("");
  const [color, setColor]               = useState(PALETTE[0]);
  const [mdContent, setMdContent]       = useState<string | undefined>();
  const [mdFileName, setMdFileName]     = useState<string | undefined>();
  const [previewId, setPreviewId]       = useState<string | null>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  const glassBorder = "1px solid rgba(255,255,255,0.09)";

  const handleMdFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMdContent(ev.target?.result as string);
      setMdFileName(file.name);
      if (!label) setLabel(file.name.replace(/\.md$/i, ""));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addSkill = () => {
    const l = label.trim();
    const p = prefix.trim();
    if (!l || !p) return;
    onSkillsChange([...skills, {
      id: `sk-${Date.now()}`,
      label: l,
      color,
      prefix: p.endsWith(" ") ? p : p + " ",
      description: desc.trim() || l,
      mdContent,
      mdFileName,
    }]);
    setLabel(""); setPrefix(""); setDesc("");
    setMdContent(undefined); setMdFileName(undefined);
    setAddOpen(false);
  };

  const removeSkill = (id: string) => onSkillsChange(skills.filter((s) => s.id !== id));

  return (
    <div className="w-full h-full flex flex-col pt-2 pb-6 px-4 overflow-y-auto"
      style={{ backdropFilter: "blur(40px)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: accentColor }} />
          <h3 className="text-[13px] font-semibold text-text-primary">Skills</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: `${accentColor}20`, color: accentColor }}>{skills.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setAddOpen((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, color: accentColor }}>
            {addOpen ? <ChevronUp size={11} /> : <Plus size={11} />}
          </button>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors">
            <X size={11} className="text-text-muted" />
          </button>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {addOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden shrink-0 mb-3">
            <div className="p-3 rounded-xl flex flex-col gap-2.5"
              style={{ background: "rgba(255,255,255,0.04)", border: glassBorder }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">New Skill</p>

              <input value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder="Skill name  (e.g. Brainstorm)"
                className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />

              <input value={prefix} onChange={(e) => setPrefix(e.target.value)}
                placeholder="Prompt prefix  (e.g. Brainstorm ideas for)"
                className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />

              <input value={desc} onChange={(e) => setDesc(e.target.value)}
                placeholder="Short description (optional)"
                className="w-full bg-transparent text-[12px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }} />

              {/* MD file upload */}
              <input ref={mdInputRef} type="file" accept=".md,text/markdown,text/plain"
                className="hidden" onChange={handleMdFile} />
              <button onClick={() => mdInputRef.current?.click()}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11.5px] transition-colors hover:bg-white/[0.05]"
                style={{ background: "rgba(255,255,255,0.04)", border: mdFileName ? `1px solid ${accentColor}40` : "1px solid rgba(255,255,255,0.07)", color: mdFileName ? accentColor : "rgba(255,255,255,0.4)" }}>
                <FileText size={12} strokeWidth={1.8} />
                {mdFileName ? (
                  <span className="truncate max-w-[160px]">{mdFileName}</span>
                ) : (
                  <span>Attach skill file (.md)</span>
                )}
                {mdFileName && (
                  <button className="ml-auto opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setMdContent(undefined); setMdFileName(undefined); }}>
                    <X size={9} />
                  </button>
                )}
              </button>
              {mdFileName && (
                <p className="text-[10px] text-text-muted px-1">
                  The file content will be sent as system context when this skill is used.
                </p>
              )}

              {/* Colour picker */}
              <div>
                <p className="text-[10px] text-text-muted mb-1.5">Colour</p>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-5 h-5 rounded-full transition-all"
                      style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
                  ))}
                </div>
              </div>

              <button onClick={addSkill} disabled={!label.trim() || !prefix.trim()}
                className="w-full py-1.5 rounded-lg text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
                style={{ background: accentColor }}>
                Add Skill
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills list */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
        {skills.map((skill) => (
          <motion.div key={skill.id} layout
            className="group rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.02)", border: glassBorder }}>

            <div className="flex items-start gap-2.5 p-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${skill.color}18`, border: `1px solid ${skill.color}28` }}>
                <Zap size={12} style={{ color: skill.color }} strokeWidth={2} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-medium text-text-primary">{skill.label}</p>
                  {skill.mdFileName && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ background: `${skill.color}18`, color: skill.color }}>
                      <FileText size={8} /> .md
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5 truncate">{skill.description}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button onClick={() => onUse(skill)}
                    className="text-[10px] px-2 py-0.5 rounded-md transition-colors"
                    style={{ background: `${skill.color}18`, color: skill.color, border: `1px solid ${skill.color}28` }}>
                    Use
                  </button>
                  {skill.mdContent && (
                    <button onClick={() => setPreviewId((p) => p === skill.id ? null : skill.id)}
                      className="text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {previewId === skill.id ? <EyeOff size={9} /> : <Eye size={9} />}
                      {previewId === skill.id ? "Hide" : "Preview"}
                    </button>
                  )}
                </div>
              </div>

              <button onClick={() => removeSkill(skill.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0">
                <X size={10} className="text-text-ghost" />
              </button>
            </div>

            {/* MD preview */}
            <AnimatePresence>
              {previewId === skill.id && skill.mdContent && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mx-2.5 mb-2.5 p-2.5 rounded-lg overflow-y-auto max-h-48"
                    style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <pre className="text-[10px] text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                      {skill.mdContent}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
