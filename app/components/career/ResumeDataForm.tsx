"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { User, Briefcase, GraduationCap, Code2, FolderKanban, Award, Upload, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { useCareerStore } from "@/store/careerStore";
import { useEmotion } from "@/context/EmotionContext";
import { MasterResume, WorkExperience, Education, Project, Certification } from "@/types/career";
import { v4 as uuidv4 } from "uuid";

type FormTab = "personal" | "experience" | "education" | "skills" | "projects" | "certifications";

export default function ResumeDataForm() {
  const { accentColor } = useEmotion();
  const { masterResume, resumeLoading, resumeError, loadResume, saveResume, importResumeFile } = useCareerStore();
  const [activeTab, setActiveTab] = useState<FormTab>("personal");
  const [formData, setFormData] = useState<MasterResume | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadResume(); }, [loadResume]);
  useEffect(() => { if (masterResume) setFormData({ ...masterResume }); }, [masterResume]);

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    await saveResume(formData);
    setSaving(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importResumeFile(file);
    e.target.value = "";
  };

  const tabs: { id: FormTab; label: string; icon: typeof User }[] = [
    { id: "personal", label: "Personal", icon: User },
    { id: "experience", label: "Experience", icon: Briefcase },
    { id: "education", label: "Education", icon: GraduationCap },
    { id: "skills", label: "Skills", icon: Code2 },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "certifications", label: "Certs", icon: Award },
  ];

  const inputStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };

  if (resumeLoading && !formData) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}20` }}>
          <User size={20} style={{ color: accentColor, opacity: 0.6 }} />
        </div>
        <p className="text-[12px] text-text-muted">Fill in your resume details or import a .tex/.md file to get started.</p>
        <button
          onClick={() => { loadResume(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium"
          style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 shrink-0">
        <input ref={fileRef} type="file" accept=".tex,.md,.txt" className="hidden" onChange={handleImport} />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/5"
          style={{ color: accentColor, border: `1px solid ${accentColor}30` }}>
          <Upload size={10} /> Import .tex/.md
        </button>
        <div className="flex-1" />
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium text-white"
          style={{ background: accentColor }}>
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
          Save
        </button>
      </div>

      {resumeError && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg text-[10px] text-red-400"
          style={{ background: "rgba(248,113,113,0.08)" }}>{resumeError}</div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-3 py-2 overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all"
              style={activeTab === tab.id ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` } : { color: "rgba(255,255,255,0.4)" }}>
              <Icon size={10} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === "personal" && (
          <div className="space-y-2.5">
            {(["name", "email", "phone", "linkedin", "github", "website", "location"] as const).map((field) => (
              <div key={field}>
                <label className="text-[10px] text-text-muted capitalize mb-1 block">{field}</label>
                <input
                  value={formData.contact[field] || ""}
                  onChange={(e) => setFormData({ ...formData, contact: { ...formData.contact, [field]: e.target.value } })}
                  className="w-full text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-1.5 rounded-lg"
                  style={inputStyle}
                  placeholder={field === "linkedin" ? "linkedin.com/in/..." : field === "github" ? "github.com/..." : `Your ${field}`}
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] text-text-muted mb-1 block">Summary</label>
              <textarea
                value={formData.summary || ""}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="w-full text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg resize-none"
                style={inputStyle}
                rows={3}
                placeholder="Brief professional summary..."
              />
            </div>
          </div>
        )}

        {activeTab === "experience" && (
          <div className="space-y-3">
            {formData.experiences.map((exp, i) => (
              <div key={exp.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-text-muted">Experience {i + 1}</span>
                  <button onClick={() => setFormData({ ...formData, experiences: formData.experiences.filter((_, j) => j !== i) })}
                    className="text-red-400/60 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={exp.company} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, company: e.target.value }; setFormData({ ...formData, experiences: exps }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Company" />
                  <input value={exp.title} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, title: e.target.value }; setFormData({ ...formData, experiences: exps }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Title" />
                  <input value={exp.startDate} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, startDate: e.target.value }; setFormData({ ...formData, experiences: exps }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Start (YYYY-MM)" />
                  <input value={exp.endDate} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, endDate: e.target.value }; setFormData({ ...formData, experiences: exps }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="End (or 'Present')" />
                </div>
                <input value={exp.location} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, location: e.target.value }; setFormData({ ...formData, experiences: exps }); }}
                  className="w-full mt-2 text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Location" />
                <textarea value={exp.bullets.join("\n")} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, bullets: e.target.value.split("\n") }; setFormData({ ...formData, experiences: exps }); }}
                  className="w-full mt-2 text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg resize-none" style={inputStyle} rows={3} placeholder="Bullet points (one per line)" />
                <input value={exp.technologies.join(", ")} onChange={(e) => { const exps = [...formData.experiences]; exps[i] = { ...exp, technologies: e.target.value.split(",").map(s => s.trim()) }; setFormData({ ...formData, experiences: exps }); }}
                  className="w-full mt-2 text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Technologies (comma-separated)" />
              </div>
            ))}
            <button onClick={() => setFormData({ ...formData, experiences: [...formData.experiences, { id: uuidv4(), company: "", title: "", location: "", startDate: "", endDate: "", current: false, bullets: [], technologies: [] }] })}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/[0.03]"
              style={{ border: "1px dashed rgba(255,255,255,0.15)", color: accentColor }}>
              <Plus size={10} /> Add Experience
            </button>
          </div>
        )}

        {activeTab === "education" && (
          <div className="space-y-3">
            {formData.education.map((edu, i) => (
              <div key={edu.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-text-muted">Education {i + 1}</span>
                  <button onClick={() => setFormData({ ...formData, education: formData.education.filter((_, j) => j !== i) })}
                    className="text-red-400/60 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={edu.institution} onChange={(e) => { const eds = [...formData.education]; eds[i] = { ...edu, institution: e.target.value }; setFormData({ ...formData, education: eds }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Institution" />
                  <input value={edu.degree} onChange={(e) => { const eds = [...formData.education]; eds[i] = { ...edu, degree: e.target.value }; setFormData({ ...formData, education: eds }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Degree" />
                  <input value={edu.field} onChange={(e) => { const eds = [...formData.education]; eds[i] = { ...edu, field: e.target.value }; setFormData({ ...formData, education: eds }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Field" />
                  <input value={edu.gpa || ""} onChange={(e) => { const eds = [...formData.education]; eds[i] = { ...edu, gpa: e.target.value }; setFormData({ ...formData, education: eds }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="GPA (optional)" />
                </div>
              </div>
            ))}
            <button onClick={() => setFormData({ ...formData, education: [...formData.education, { id: uuidv4(), institution: "", degree: "", field: "", startDate: "", endDate: "", highlights: [] }] })}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/[0.03]"
              style={{ border: "1px dashed rgba(255,255,255,0.15)", color: accentColor }}>
              <Plus size={10} /> Add Education
            </button>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="space-y-3">
            <p className="text-[10px] text-text-muted">One skill per line</p>
            <textarea
              value={formData.skills.join("\n")}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value.split("\n").filter(Boolean) })}
              className="w-full text-[11px] text-text-primary outline-none px-2.5 py-2 rounded-lg resize-none"
              style={inputStyle}
              rows={12}
              placeholder="React&#10;TypeScript&#10;Node.js&#10;AWS&#10;..."
            />
            <div className="flex flex-wrap gap-1.5">
              {formData.skills.filter(Boolean).map((skill, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md"
                  style={{ background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}25` }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div className="space-y-3">
            {formData.projects.map((proj, i) => (
              <div key={proj.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-text-muted">Project {i + 1}</span>
                  <button onClick={() => setFormData({ ...formData, projects: formData.projects.filter((_, j) => j !== i) })}
                    className="text-red-400/60 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
                <input value={proj.name} onChange={(e) => { const ps = [...formData.projects]; ps[i] = { ...proj, name: e.target.value }; setFormData({ ...formData, projects: ps }); }}
                  className="w-full text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg mb-2" style={inputStyle} placeholder="Project name" />
                <textarea value={proj.description} onChange={(e) => { const ps = [...formData.projects]; ps[i] = { ...proj, description: e.target.value }; setFormData({ ...formData, projects: ps }); }}
                  className="w-full text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg resize-none mb-2" style={inputStyle} rows={2} placeholder="Description" />
                <input value={proj.technologies.join(", ")} onChange={(e) => { const ps = [...formData.projects]; ps[i] = { ...proj, technologies: e.target.value.split(",").map(s => s.trim()) }; setFormData({ ...formData, projects: ps }); }}
                  className="w-full text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Technologies (comma-separated)" />
              </div>
            ))}
            <button onClick={() => setFormData({ ...formData, projects: [...formData.projects, { id: uuidv4(), name: "", description: "", technologies: [], highlights: [] }] })}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/[0.03]"
              style={{ border: "1px dashed rgba(255,255,255,0.15)", color: accentColor }}>
              <Plus size={10} /> Add Project
            </button>
          </div>
        )}

        {activeTab === "certifications" && (
          <div className="space-y-3">
            {formData.certifications.map((cert, i) => (
              <div key={cert.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-text-muted">Cert {i + 1}</span>
                  <button onClick={() => setFormData({ ...formData, certifications: formData.certifications.filter((_, j) => j !== i) })}
                    className="text-red-400/60 hover:text-red-400"><Trash2 size={11} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={cert.name} onChange={(e) => { const cs = [...formData.certifications]; cs[i] = { ...cert, name: e.target.value }; setFormData({ ...formData, certifications: cs }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Name" />
                  <input value={cert.issuer} onChange={(e) => { const cs = [...formData.certifications]; cs[i] = { ...cert, issuer: e.target.value }; setFormData({ ...formData, certifications: cs }); }}
                    className="text-[11px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} placeholder="Issuer" />
                </div>
              </div>
            ))}
            <button onClick={() => setFormData({ ...formData, certifications: [...formData.certifications, { id: uuidv4(), name: "", issuer: "", date: "" }] })}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/[0.03]"
              style={{ border: "1px dashed rgba(255,255,255,0.15)", color: accentColor }}>
              <Plus size={10} /> Add Certification
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
