"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Loader2, ExternalLink, Mail, Copy, UserPlus,
  Building2, Briefcase, MapPin, Sparkles, ChevronRight,
  Star, Clock, Zap, AlertTriangle, Info,
} from "lucide-react";
import { useCareerStore } from "@/store/careerStore";
import { useEmotion } from "@/context/EmotionContext";
import { ContactResult, ColdEmailDraft, YoeLevel } from "@/types/career";

const SOURCE_META: Record<string, { label: string; color: string; verified: boolean }> = {
  "github":       { label: "GitHub",       color: "#e6edf3", verified: true },
  "google-cse":   { label: "Google",       color: "#34d399", verified: true },
  "tavily":       { label: "Tavily",       color: "#60a5fa", verified: true },
  "ai-suggested": { label: "AI-suggested", color: "#fbbf24", verified: false },
  "perplexity":   { label: "Perplexity",   color: "#a78bfa", verified: false },
};

const YOE_OPTIONS: { value: YoeLevel; label: string; short: string }[] = [
  { value: "intern", label: "Intern / Co-op", short: "Intern" },
  { value: "fresher", label: "Fresher (0–1 yr)", short: "Fresher" },
  { value: "junior", label: "Junior (1–3 yrs)", short: "Junior" },
  { value: "mid", label: "Mid-Level (3–6 yrs)", short: "Mid" },
  { value: "senior", label: "Senior (6–10 yrs)", short: "Senior" },
  { value: "staff", label: "Staff / Principal (10+)", short: "Staff" },
];

const JOB_TYPE_COLORS: Record<string, string> = {
  "full-time": "#34d399",
  "part-time": "#60a5fa",
  contract: "#fbbf24",
  internship: "#a78bfa",
  remote: "#f472b6",
};

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn: "#0a66c2",
  Indeed: "#2164f3",
  Glassdoor: "#0caa41",
  Wellfound: "#f94f31",
  Naukri: "#f08020",
  "Google Jobs": "#ea4335",
};

export default function NetworkPanel() {
  const { accentColor } = useEmotion();
  const {
    contacts, networkLoading, networkError,
    companyInput, setCompanyInput, roleInput, setRoleInput, departmentInput, setDepartmentInput,
    searchContacts, emailDrafts, emailGenerating, generateEmail,
    parsedJd, fitAnalysis, masterResume,
    jobRoleInput, setJobRoleInput, jobLocationInput, setJobLocationInput,
    yoeLevel, setYoeLevel, searchJobs,
    jobResults, jobBoardLinks, jobInsights, jobTopCompanies, jobSearchLoading, jobSearchError,
  } = useCareerStore();

  const [activeTab, setActiveTab] = useState<"contacts" | "jobs">("contacts");
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [emailTone, setEmailTone] = useState<"professional" | "casual" | "enthusiastic">("professional");
  const [emailPurpose, setEmailPurpose] = useState<"referral" | "cold-outreach" | "follow-up" | "informational">("cold-outreach");

  // Check if inputs are already synced from JD
  const isSyncedFromJd = parsedJd &&
    companyInput.toLowerCase() === (parsedJd.company || "").toLowerCase() &&
    roleInput.toLowerCase() === (parsedJd.role || "").toLowerCase();

  const connectionTypeColors: Record<string, string> = {
    recruiter: "#60a5fa",
    "hiring-manager": "#a78bfa",
    "team-member": "#34d399",
    referral: "#fbbf24",
  };

  const handleDraftEmail = (contact: ContactResult) => {
    setSelectedContact(contact);
    generateEmail(contact.id, emailTone, emailPurpose);
  };

  const contactDraft = (contactId: string): ColdEmailDraft | undefined =>
    emailDrafts.find((d) => d.contactId === contactId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}>
          <Users size={14} style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary">Network & Jobs</h3>
          <p className="text-[10px] text-text-muted">Find contacts, jobs & draft outreach</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 mb-3 shrink-0 p-0.5 mx-4 rounded-lg"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => setActiveTab("contacts")}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all"
          style={activeTab === "contacts"
            ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }
            : { color: "rgba(255,255,255,0.4)" }}>
          <UserPlus size={10} /> Contacts
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all"
          style={activeTab === "jobs"
            ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }
            : { color: "rgba(255,255,255,0.4)" }}>
          <Briefcase size={10} /> Find Jobs
        </button>
      </div>

      {/* ── CONTACTS TAB ─────────────────────────────────────────── */}
      {activeTab === "contacts" && (
        <div className="flex-1 flex flex-col overflow-hidden px-4">
          {/* Search form */}
          <div className="space-y-2 mb-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Building2 size={11} className="text-text-ghost" />
              <input
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                placeholder="Company name"
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Briefcase size={11} className="text-text-ghost" />
              <input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="Target role (e.g. Software Engineer)"
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Users size={11} className="text-text-ghost" />
              <input
                value={departmentInput}
                onChange={(e) => setDepartmentInput(e.target.value)}
                placeholder="Department (optional)"
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
              />
            </div>
            <button
              onClick={searchContacts}
              disabled={!companyInput.trim() || networkLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-white transition-all disabled:opacity-40"
              style={{ background: accentColor }}
            >
              {networkLoading
                ? <><Loader2 size={11} className="animate-spin" /> Searching...</>
                : <><Search size={11} /> Find Contacts</>}
            </button>
          </div>

          {networkError && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg text-[10px] text-red-400"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)" }}>
              {networkError}
            </div>
          )}

          {/* Contact results */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {/* AI disclaimer banner if any results are ai-suggested */}
            {contacts.some(c => c.source === "ai-suggested") && (
              <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg mb-1"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.20)" }}>
                <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-300 leading-relaxed">
                  <strong>AI-suggested contacts</strong> — names are not verified. Add Google CSE or Tavily API keys in Tools &amp; Connectors for real profiles.
                </p>
              </div>
            )}
            {contacts.some(c => c.source === "github") && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1"
                style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                <Info size={10} className="text-emerald-400 shrink-0" />
                <p className="text-[10px] text-emerald-300">Real profiles from GitHub — engineers who list {companyInput} as their employer.</p>
              </div>
            )}
            {contacts.map((contact) => {
              const draft = contactDraft(contact.id);
              const srcMeta = SOURCE_META[contact.source] || { label: contact.source, color: "#888", verified: false };
              const extContact = contact;
              return (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar or initials */}
                    {extContact.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={extContact.avatar} alt={contact.name}
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                        style={{ background: `${connectionTypeColors[contact.connectionType] || accentColor}15`, color: connectionTypeColors[contact.connectionType] || accentColor }}>
                        {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-text-primary">{contact.name}</p>
                      <p className="text-[10px] text-text-muted">{contact.title}</p>
                      {extContact.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={8} className="text-text-ghost" />
                          <span className="text-[9px] text-text-ghost">{extContact.location}</span>
                        </div>
                      )}
                      {extContact.bio && (
                        <p className="text-[9px] text-text-ghost mt-1 leading-relaxed line-clamp-2">{extContact.bio}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded capitalize"
                          style={{
                            background: `${connectionTypeColors[contact.connectionType] || accentColor}15`,
                            color: connectionTypeColors[contact.connectionType] || accentColor,
                            border: `1px solid ${connectionTypeColors[contact.connectionType] || accentColor}30`,
                          }}>
                          {contact.connectionType.replace("-", " ")}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: `${srcMeta.color}15`, color: srcMeta.color, border: `1px solid ${srcMeta.color}30` }}>
                          {srcMeta.verified ? "✓ " : "~ "}{srcMeta.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {contact.profileUrl && (
                        <a href={contact.profileUrl} target="_blank" rel="noopener noreferrer"
                          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                          <ExternalLink size={10} className="text-text-muted" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDraftEmail(contact)}
                        disabled={emailGenerating}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
                        style={{ border: `1px solid ${accentColor}30`, background: `${accentColor}08` }}
                      >
                        <Mail size={10} style={{ color: accentColor }} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {draft && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 overflow-hidden"
                      >
                        <div className="p-2.5 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium" style={{ color: accentColor }}>Draft Message</span>
                            <button onClick={() => navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`)}
                              className="flex items-center gap-1 text-[9px] text-text-muted hover:text-text-primary">
                              <Copy size={9} /> Copy
                            </button>
                          </div>
                          <p className="text-[10px] text-text-secondary font-medium mb-1">Subject: {draft.subject}</p>
                          <p className="text-[10px] text-text-muted leading-relaxed whitespace-pre-line">{draft.body}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {contacts.length === 0 && !networkLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users size={24} className="text-text-ghost mb-2" />
                <p className="text-[11px] text-text-muted">Enter a company and role to find networking contacts</p>
              </div>
            )}
          </div>

          {/* Email config */}
          {contacts.length > 0 && (
            <div className="shrink-0 mt-3 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[9px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">Email Settings</p>
              <div className="flex gap-2">
                <select value={emailTone} onChange={(e) => setEmailTone(e.target.value as typeof emailTone)}
                  className="flex-1 text-[10px] text-text-secondary bg-transparent px-2 py-1 rounded-lg outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <option value="professional" style={{ background: "#1a1a2e" }}>Professional</option>
                  <option value="casual" style={{ background: "#1a1a2e" }}>Casual</option>
                  <option value="enthusiastic" style={{ background: "#1a1a2e" }}>Enthusiastic</option>
                </select>
                <select value={emailPurpose} onChange={(e) => setEmailPurpose(e.target.value as typeof emailPurpose)}
                  className="flex-1 text-[10px] text-text-secondary bg-transparent px-2 py-1 rounded-lg outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <option value="cold-outreach" style={{ background: "#1a1a2e" }}>Cold Outreach</option>
                  <option value="referral" style={{ background: "#1a1a2e" }}>Referral Ask</option>
                  <option value="informational" style={{ background: "#1a1a2e" }}>Info Chat</option>
                  <option value="follow-up" style={{ background: "#1a1a2e" }}>Follow Up</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── JOBS TAB ─────────────────────────────────────────────── */}
      {activeTab === "jobs" && (
        <div className="flex-1 flex flex-col overflow-hidden px-4">
          {/* Job search form */}
          <div className="space-y-2 mb-3 shrink-0">
            {/* Role input */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Briefcase size={11} className="text-text-ghost" />
              <input
                value={jobRoleInput}
                onChange={(e) => setJobRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchJobs()}
                placeholder="Role or keywords (e.g. Software Engineer, ML Engineer)"
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
              />
            </div>

            {/* Location input */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <MapPin size={11} className="text-text-ghost" />
              <input
                value={jobLocationInput}
                onChange={(e) => setJobLocationInput(e.target.value)}
                placeholder="Location or Remote (optional)"
                className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
              />
            </div>

            {/* YOE level chips */}
            <div>
              <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">
                Experience Level
              </p>
              <div className="flex flex-wrap gap-1">
                {YOE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setYoeLevel(opt.value)}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all"
                    style={yoeLevel === opt.value
                      ? { background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }
                      : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-text-ghost mt-1 px-0.5">
                {YOE_OPTIONS.find((o) => o.value === yoeLevel)?.label}
              </p>
            </div>

            <button
              onClick={searchJobs}
              disabled={!jobRoleInput.trim() || jobSearchLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-white transition-all disabled:opacity-40"
              style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}30` }}
            >
              {jobSearchLoading
                ? <><Loader2 size={11} className="animate-spin" /> Fetching jobs...</>
                : <><Search size={11} /> Find Jobs</>}
            </button>
          </div>

          {jobSearchError && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg text-[10px] text-red-400 shrink-0"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)" }}>
              {jobSearchError}
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
            {/* Market insight */}
            {jobInsights && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 rounded-xl shrink-0"
                style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={10} style={{ color: accentColor }} />
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: accentColor }}>Market Insight</span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">{jobInsights}</p>
                {jobTopCompanies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {jobTopCompanies.slice(0, 5).map((c, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Job board quick links */}
            {jobBoardLinks.length > 0 && (
              <div className="shrink-0">
                <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">Search on Job Boards</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {jobBoardLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80"
                      style={{
                        background: `${PLATFORM_COLORS[link.platform] || "#444"}18`,
                        border: `1px solid ${PLATFORM_COLORS[link.platform] || "#444"}30`,
                        color: PLATFORM_COLORS[link.platform] || "rgba(255,255,255,0.6)",
                      }}
                    >
                      <ChevronRight size={9} />
                      <span className="truncate">{link.platform}</span>
                      <ExternalLink size={8} className="shrink-0 ml-auto opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* AI-generated job listings */}
            {jobResults.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 px-0.5">
                  Relevant Listings
                </p>
                <div className="space-y-2">
                  {jobResults.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12px] font-semibold text-text-primary leading-tight">{job.title}</p>
                            <span className="text-[8px] px-1.5 py-0.5 rounded shrink-0 capitalize"
                              style={{
                                background: `${JOB_TYPE_COLORS[job.type] || "#888"}15`,
                                color: JOB_TYPE_COLORS[job.type] || "#888",
                                border: `1px solid ${JOB_TYPE_COLORS[job.type] || "#888"}30`,
                              }}>
                              {job.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-medium text-text-secondary">{job.company}</span>
                            {job.location && (
                              <span className="flex items-center gap-0.5 text-[9px] text-text-ghost">
                                <MapPin size={8} /> {job.location}
                              </span>
                            )}
                            {job.postedAt && (
                              <span className="flex items-center gap-0.5 text-[9px] text-text-ghost">
                                <Clock size={8} /> {job.postedAt}
                              </span>
                            )}
                          </div>

                          {job.description && (
                            <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed line-clamp-2">{job.description}</p>
                          )}

                          {job.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {job.skills.slice(0, 4).map((skill, i) => (
                                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded"
                                  style={{ background: `${accentColor}10`, color: accentColor, border: `1px solid ${accentColor}20` }}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
                        <Zap size={9} style={{ color: accentColor }} />
                        <span className="text-[9px] text-text-ghost flex-1">{job.level}</span>
                        <a
                          href={job.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all hover:opacity-80"
                          style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}
                        >
                          Apply <ExternalLink size={8} />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {jobResults.length === 0 && !jobSearchLoading && !jobInsights && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Briefcase size={24} className="text-text-ghost mb-2" />
                <p className="text-[11px] text-text-muted mb-1">Find jobs tailored to your level</p>
                <p className="text-[10px] text-text-ghost">Enter a role and pick your experience level</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
