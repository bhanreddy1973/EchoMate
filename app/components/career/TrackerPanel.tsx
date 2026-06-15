"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Plus, Trash2, ExternalLink, Building2, Briefcase,
  Calendar, Shield, Users, Link2, Mail, Phone, Download, ArrowUpDown,
  Search, X, CheckCircle2, Clock, AlertCircle, XCircle, Ghost, Eye,
  LayoutGrid, Table2, Columns3, ChevronUp, ChevronDown, Bell, Tag, SlidersHorizontal,
} from "lucide-react";
import { useEmotion } from "@/context/EmotionContext";
import { ApplicationEntry, ApplicationStatus, AppCategory } from "@/types/career";
import { v4 as uuidv4 } from "uuid";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; icon: typeof CheckCircle2; group: string }> = {
  bookmarked:           { label: "Bookmarked",  color: "#60a5fa", icon: Eye,           group: "wishlist" },
  applied:              { label: "Applied",      color: "#a78bfa", icon: Clock,         group: "applied"  },
  referred:             { label: "Referred",     color: "#34d399", icon: Users,         group: "applied"  },
  "oa-received":        { label: "OA Received",  color: "#fbbf24", icon: ClipboardList, group: "active"   },
  "interview-scheduled":{ label: "Interview",    color: "#fb923c", icon: Calendar,      group: "active"   },
  interviewing:         { label: "Interviewing", color: "#f472b6", icon: Briefcase,     group: "active"   },
  offer:                { label: "Offer 🎉",      color: "#10b981", icon: CheckCircle2,  group: "offer"    },
  rejected:             { label: "Rejected",     color: "#f87171", icon: XCircle,       group: "closed"   },
  ghosted:              { label: "Ghosted",      color: "#6b7280", icon: Ghost,         group: "closed"   },
  withdrawn:            { label: "Withdrawn",    color: "#9ca3af", icon: AlertCircle,   group: "closed"   },
};

const CATEGORIES: { id: AppCategory; label: string; color: string }[] = [
  { id: "frontend",  label: "Frontend",   color: "#60a5fa" },
  { id: "backend",   label: "Backend",    color: "#a78bfa" },
  { id: "fullstack", label: "Fullstack",  color: "#34d399" },
  { id: "ml-ai",     label: "ML / AI",    color: "#f472b6" },
  { id: "data",      label: "Data",       color: "#fbbf24" },
  { id: "devops",    label: "DevOps",     color: "#fb923c" },
  { id: "mobile",    label: "Mobile",     color: "#38bdf8" },
  { id: "security",  label: "Security",   color: "#f87171" },
  { id: "product",   label: "Product",    color: "#c084fc" },
  { id: "design",    label: "Design",     color: "#fb7185" },
  { id: "other",     label: "Other",      color: "#6b7280" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<AppCategory, { id: AppCategory; label: string; color: string }>;

const KANBAN_GROUPS = [
  { id: "wishlist", label: "Wishlist",  statuses: ["bookmarked"] as ApplicationStatus[],                                          color: "#60a5fa" },
  { id: "applied",  label: "Applied",   statuses: ["applied", "referred"] as ApplicationStatus[],                                 color: "#a78bfa" },
  { id: "active",   label: "Active",    statuses: ["oa-received", "interview-scheduled", "interviewing"] as ApplicationStatus[],  color: "#fb923c" },
  { id: "offer",    label: "Offer 🎉",  statuses: ["offer"] as ApplicationStatus[],                                               color: "#10b981" },
  { id: "closed",   label: "Closed",    statuses: ["rejected", "ghosted", "withdrawn"] as ApplicationStatus[],                    color: "#6b7280" },
];

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as ApplicationStatus[];

type ViewMode  = "grid" | "kanban" | "cards";
type SortField = "date" | "company" | "status" | "ats" | "followup";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeDate(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30)  return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function isOverdue(followUpDate?: string) {
  return !!followUpDate && new Date(followUpDate) < new Date();
}

function isDueSoon(followUpDate?: string) {
  if (!followUpDate) return false;
  const diff = new Date(followUpDate).getTime() - Date.now();
  return diff >= 0 && diff < 3 * 86400000;
}

// Extract top keywords across all applications (by frequency)
function getTopKeywords(apps: ApplicationEntry[], limit = 30): { kw: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const app of apps) {
    for (const kw of app.keywords) {
      if (kw.length < 2) continue;
      freq[kw] = (freq[kw] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([kw, count]) => ({ kw, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── TrackerPanel ─────────────────────────────────────────────────────────────

export default function TrackerPanel() {
  const { accentColor } = useEmotion();
  const [applications, setApplications] = useState<ApplicationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [filterStatus,   setFilterStatus]   = useState<ApplicationStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<AppCategory | "all">("all");
  const [selectedKws,    setSelectedKws]     = useState<Set<string>>(new Set());
  const [searchQuery,    setSearchQuery]     = useState("");
  const [showFilters,    setShowFilters]     = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc,   setSortAsc]   = useState(false);

  useEffect(() => { loadApplications(); }, []);

  const loadApplications = async () => {
    try {
      const res  = await fetch("/api/career/tracker");
      const data = await res.json();
      setApplications(data.applications || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const saveApplication = async (entry: ApplicationEntry) => {
    const res  = await fetch("/api/career/tracker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "application", entry }) });
    const data = await res.json();
    if (data.applications) setApplications(data.applications);
    else loadApplications();
  };

  const updateApplication = async (entry: Partial<ApplicationEntry> & { id: string }) => {
    await fetch("/api/career/tracker", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "application", entry }) });
    setApplications((prev) => prev.map((a) => a.id === entry.id ? { ...a, ...entry, lastUpdated: new Date().toISOString() } : a));
  };

  const deleteApplication = async (id: string) => {
    await fetch("/api/career/tracker", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "application" }) });
    setApplications((prev) => prev.filter((a) => a.id !== id));
  };

  const exportCSV = () => {
    const headers = ["Company", "Role", "Category", "Status", "ATS%", "Platform", "Applied", "Follow-up", "Salary", "Keywords", "Notes"];
    const rows = applications.map((a) => [
      a.company, a.role, a.category || "", a.status, a.atsScore, a.platform,
      a.appliedDate.slice(0, 10), a.followUpDate || "", a.salary || "",
      a.keywords.join("; "), a.notes,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleKw = (kw: string) => setSelectedKws((prev) => { const n = new Set(prev); n.has(kw) ? n.delete(kw) : n.add(kw); return n; });

  // Filtering + sorting
  const filtered = applications
    .filter((a) => filterStatus   === "all" || a.status   === filterStatus)
    .filter((a) => filterCategory === "all" || a.category === filterCategory)
    .filter((a) => selectedKws.size === 0   || [...selectedKws].some((kw) => a.keywords.includes(kw)))
    .filter((a) => !searchQuery || [a.company, a.role, a.location].some((f) => f.toLowerCase().includes(searchQuery.toLowerCase())))
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "date")    cmp = new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
      if (sortField === "company") cmp = a.company.localeCompare(b.company);
      if (sortField === "ats")     cmp = b.atsScore - a.atsScore;
      if (sortField === "status")  cmp = ALL_STATUSES.indexOf(a.status) - ALL_STATUSES.indexOf(b.status);
      if (sortField === "followup") {
        const fa = a.followUpDate ? new Date(a.followUpDate).getTime() : Infinity;
        const fb = b.followUpDate ? new Date(b.followUpDate).getTime() : Infinity;
        cmp = fa - fb;
      }
      return sortAsc ? -cmp : cmp;
    });

  const topKws = getTopKeywords(applications);

  const stats = {
    total:    applications.length,
    active:   applications.filter((a) => ["oa-received","interview-scheduled","interviewing"].includes(a.status)).length,
    offers:   applications.filter((a) => a.status === "offer").length,
    referrals:applications.filter((a) => a.isReferral).length,
    avgAts:   applications.length ? Math.round(applications.reduce((s, a) => s + a.atsScore, 0) / applications.length) : 0,
    overdue:  applications.filter((a) => isOverdue(a.followUpDate)).length,
  };

  const activeFilterCount = (filterStatus !== "all" ? 1 : 0) + (filterCategory !== "all" ? 1 : 0) + selectedKws.size;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/5 shrink-0 overflow-x-auto"
        style={{ background: "rgba(0,0,0,0.15)" }}>
        {[
          { label: "Total",      value: stats.total,    color: accentColor   },
          { label: "Active",     value: stats.active,   color: "#fb923c"     },
          { label: "Offers",     value: stats.offers,   color: "#10b981"     },
          { label: "Referrals",  value: stats.referrals,color: "#34d399"     },
          { label: "Avg ATS",    value: `${stats.avgAts}%`, color: "#fbbf24" },
          { label: "Follow-ups", value: stats.overdue,  color: stats.overdue > 0 ? "#f87171" : "#6b7280" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 shrink-0">
            <span className="text-[15px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[9px] text-text-ghost">{s.label}</span>
          </div>
        ))}
        {stats.overdue > 0 && (
          <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0"
            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
            <Bell size={8} /> {stats.overdue} overdue
          </span>
        )}
      </div>

      {/* Main toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 130 }}>
          <Search size={10} className="text-text-ghost shrink-0" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..."
            className="flex-1 bg-transparent text-[10px] text-text-primary placeholder:text-text-ghost outline-none w-24" />
          {searchQuery && <button onClick={() => setSearchQuery("")}><X size={9} className="text-text-ghost" /></button>}
        </div>

        {/* View toggle */}
        <div className="flex items-center p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {([["grid", Table2], ["kanban", Columns3], ["cards", LayoutGrid]] as const).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className="p-1.5 rounded-md transition-all"
              style={viewMode === mode ? { background: `${accentColor}15`, color: accentColor } : { color: "rgba(255,255,255,0.35)" }}>
              <Icon size={11} />
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all"
          style={showFilters || activeFilterCount > 0
            ? { background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }
            : { color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <SlidersHorizontal size={10} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1 py-0.5 rounded-full text-[8px] font-bold"
              style={{ background: accentColor, color: "#000" }}>{activeFilterCount}</span>
          )}
        </button>

        <div className="flex-1" />
        <button onClick={exportCSV}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-text-muted hover:bg-white/5"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <Download size={9} /> CSV
        </button>
        <button onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-white"
          style={{ background: accentColor }}>
          <Plus size={10} /> Add
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.12)" }}
          >
            <div className="px-3 py-3 space-y-3">
              {/* Status + Category row */}
              <div className="flex items-start gap-4 flex-wrap">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-text-ghost mb-1.5">Status</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterStatus("all")}
                      className="px-2 py-0.5 rounded-lg text-[9px] font-medium transition-all"
                      style={filterStatus === "all"
                        ? { background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }
                        : { color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      All
                    </button>
                    {ALL_STATUSES.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                          className="px-2 py-0.5 rounded-lg text-[9px] font-medium transition-all"
                          style={filterStatus === s
                            ? { background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }
                            : { color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-text-ghost mb-1.5">Category</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterCategory("all")}
                      className="px-2 py-0.5 rounded-lg text-[9px] font-medium transition-all"
                      style={filterCategory === "all"
                        ? { background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }
                        : { color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? "all" : cat.id)}
                        className="px-2 py-0.5 rounded-lg text-[9px] font-medium transition-all"
                        style={filterCategory === cat.id
                          ? { background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }
                          : { color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Keyword chips */}
              {topKws.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[8px] font-semibold uppercase tracking-wider text-text-ghost">Keywords from JDs</p>
                    {selectedKws.size > 0 && (
                      <button onClick={() => setSelectedKws(new Set())}
                        className="text-[8px] text-text-ghost hover:text-text-primary flex items-center gap-0.5">
                        <X size={8} /> Clear ({selectedKws.size})
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {topKws.map(({ kw, count }) => {
                      const active = selectedKws.has(kw);
                      return (
                        <button key={kw} onClick={() => toggleKw(kw)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-medium transition-all"
                          style={active
                            ? { background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }
                            : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {kw}
                          <span className="text-[7px] opacity-60">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active filter summary + clear all */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setFilterStatus("all"); setFilterCategory("all"); setSelectedKws(new Set()); }}
                  className="text-[9px] text-red-400/70 hover:text-red-400 flex items-center gap-1">
                  <X size={9} /> Clear all filters ({filtered.length} of {applications.length} shown)
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Clock size={16} className="animate-spin text-text-ghost" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <ClipboardList size={28} className="text-text-ghost" />
            <p className="text-[12px] text-text-muted">
              {applications.length === 0 ? "No applications tracked yet" : "No results match your filters"}
            </p>
            {applications.length === 0
              ? <p className="text-[10px] text-text-ghost">Click + Add or use Track in the Resume editor</p>
              : <button onClick={() => { setFilterStatus("all"); setFilterCategory("all"); setSelectedKws(new Set()); }} className="text-[10px] text-text-ghost hover:text-text-primary underline">Clear filters</button>
            }
          </div>
        ) : viewMode === "grid" ? (
          <GridView
            applications={filtered} accentColor={accentColor}
            sortField={sortField} sortAsc={sortAsc}
            onSort={(f) => { if (sortField === f) setSortAsc(!sortAsc); else { setSortField(f); setSortAsc(false); } }}
            editingId={editingId} onEdit={setEditingId}
            onUpdate={updateApplication} onDelete={deleteApplication}
          />
        ) : viewMode === "kanban" ? (
          <KanbanView applications={filtered} accentColor={accentColor} onUpdate={updateApplication} onDelete={deleteApplication} />
        ) : (
          <CardsView
            applications={filtered} accentColor={accentColor}
            editingId={editingId} onEdit={setEditingId}
            onUpdate={updateApplication} onDelete={deleteApplication}
          />
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <AddApplicationForm
            accentColor={accentColor}
            onSave={(e) => { saveApplication(e); setShowAddForm(false); }}
            onClose={() => setShowAddForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Grid View ────────────────────────────────────────────────────────────────

function GridView({ applications, accentColor, sortField, sortAsc, onSort, editingId, onEdit, onUpdate, onDelete }: {
  applications: ApplicationEntry[];
  accentColor: string;
  sortField: SortField;
  sortAsc: boolean;
  onSort: (f: SortField) => void;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onUpdate: (e: Partial<ApplicationEntry> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field
      ? <ChevronDown size={9} className="opacity-20" />
      : sortAsc ? <ChevronUp size={9} style={{ color: accentColor }} /> : <ChevronDown size={9} style={{ color: accentColor }} />;

  const TH = ({ label, field, className = "" }: { label: string; field?: SortField; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap select-none ${field ? "cursor-pointer hover:text-text-primary transition-colors" : ""} ${className}`}
      onClick={() => field && onSort(field)}>
      <span className="flex items-center gap-1">{label}{field && <SortIcon field={field} />}</span>
    </th>
  );

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse" style={{ minWidth: 980 }}>
        <thead className="sticky top-0 z-10" style={{ background: "rgba(15,15,25,0.97)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <tr>
            <TH label="Status"    field="status"   />
            <TH label="Company"   field="company"  />
            <TH label="Role"      />
            <TH label="Category"  />
            <TH label="ATS%"      field="ats"      />
            <TH label="Platform"  />
            <TH label="Applied"   field="date"     />
            <TH label="Follow-up" field="followup" />
            <TH label="Referral"  />
            <TH label="Notes"     />
            <TH label=""          className="text-right" />
          </tr>
        </thead>
        <tbody>
          {applications.map((app, idx) => {
            const cfg     = STATUS_CONFIG[app.status];
            const catCfg  = app.category ? CATEGORY_MAP[app.category] : null;
            const expanded = editingId === app.id;
            const overdue  = isOverdue(app.followUpDate);
            const dueSoon  = isDueSoon(app.followUpDate);

            return (
              <>
                <tr
                  key={app.id}
                  onClick={() => onEdit(expanded ? null : app.id)}
                  className="cursor-pointer group transition-colors"
                  style={{
                    background: expanded ? `${cfg.color}08` : idx % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                    borderLeft: `3px solid ${expanded ? cfg.color : "transparent"}`,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                  onMouseEnter={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent"; }}
                >
                  {/* Status */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select value={app.status} onChange={(e) => onUpdate({ id: app.id, status: e.target.value as ApplicationStatus })}
                      className="text-[9px] font-medium px-2 py-0.5 rounded-lg outline-none appearance-none cursor-pointer"
                      style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s} style={{ background: "#1a1a2e" }}>{STATUS_CONFIG[s].label}</option>)}
                    </select>
                  </td>

                  {/* Company */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-text-primary truncate max-w-[100px]">{app.company}</span>
                      {app.isReferral && <span className="text-[7px] px-1 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>REF</span>}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-2">
                    <span className="text-[10px] text-text-secondary truncate max-w-[120px] block">{app.role}</span>
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={app.category || "other"}
                      onChange={(e) => onUpdate({ id: app.id, category: e.target.value as AppCategory })}
                      className="text-[8px] font-medium px-1.5 py-0.5 rounded-lg outline-none appearance-none cursor-pointer"
                      style={{
                        background: catCfg ? `${catCfg.color}15` : "rgba(255,255,255,0.04)",
                        color: catCfg ? catCfg.color : "rgba(255,255,255,0.4)",
                        border: `1px solid ${catCfg ? `${catCfg.color}30` : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ background: "#1a1a2e" }}>{c.label}</option>)}
                    </select>
                  </td>

                  {/* ATS */}
                  <td className="px-3 py-2">
                    <span className="text-[11px] font-bold tabular-nums"
                      style={{ color: app.atsScore >= 70 ? "#34d399" : app.atsScore >= 50 ? "#fbbf24" : app.atsScore > 0 ? "#f87171" : "#6b7280" }}>
                      {app.atsScore > 0 ? `${app.atsScore}%` : "—"}
                    </span>
                  </td>

                  {/* Platform */}
                  <td className="px-3 py-2">
                    <span className="text-[9px] text-text-ghost capitalize">{app.platform}</span>
                  </td>

                  {/* Applied */}
                  <td className="px-3 py-2">
                    <span className="text-[9px] text-text-ghost">{relativeDate(app.appliedDate)}</span>
                  </td>

                  {/* Follow-up */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {app.followUpDate ? (
                      <span className="text-[9px] font-medium"
                        style={{ color: overdue ? "#f87171" : dueSoon ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>
                        {overdue ? "⚠ " : dueSoon ? "● " : ""}{app.followUpDate.slice(0, 10)}
                      </span>
                    ) : (
                      <input type="date" onChange={(e) => onUpdate({ id: app.id, followUpDate: e.target.value })}
                        className="text-[9px] bg-transparent text-text-ghost outline-none w-24" style={{ colorScheme: "dark" }} title="Set follow-up" />
                    )}
                  </td>

                  {/* Referral */}
                  <td className="px-3 py-2">
                    {app.isReferral
                      ? <span className="text-[9px] text-green-400 truncate max-w-[70px] block">{app.referral?.name || "Yes"}</span>
                      : <span className="text-[9px] text-text-ghost">—</span>}
                  </td>

                  {/* Notes */}
                  <td className="px-3 py-2 max-w-[130px]">
                    <span className="text-[9px] text-text-ghost truncate block">{app.notes || "—"}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {app.jobUrl && (
                        <a href={app.jobUrl} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-white/10 text-text-ghost hover:text-text-primary">
                          <ExternalLink size={10} />
                        </a>
                      )}
                      <button onClick={() => onDelete(app.id)} className="p-1 rounded hover:bg-red-500/10 text-text-ghost hover:text-red-400">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded detail */}
                {expanded && (
                  <tr key={`${app.id}-exp`} style={{ borderBottom: `1px solid ${cfg.color}20` }}>
                    <td colSpan={11} style={{ background: `${cfg.color}05`, paddingLeft: 3 }}>
                      <ExpandedRow app={app} accentColor={accentColor} onUpdate={onUpdate} onDelete={onDelete} onClose={() => onEdit(null)} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Expanded Row ─────────────────────────────────────────────────────────────

function ExpandedRow({ app, accentColor, onUpdate, onDelete, onClose }: {
  app: ApplicationEntry;
  accentColor: string;
  onUpdate: (e: Partial<ApplicationEntry> & { id: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [notes,    setNotes]    = useState(app.notes);
  const [rounds,   setRounds]   = useState<string[]>(app.interviewRounds || []);
  const [newRound, setNewRound] = useState("");

  const addRound = () => {
    if (!newRound.trim()) return;
    const updated = [...rounds, newRound.trim()];
    setRounds(updated);
    onUpdate({ id: app.id, interviewRounds: updated });
    setNewRound("");
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="grid grid-cols-3 gap-4">
        {/* Keywords */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">JD Keywords</p>
          <div className="flex flex-wrap gap-1">
            {app.keywords.length > 0
              ? app.keywords.slice(0, 15).map((kw, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded"
                    style={{
                      background: app.matchingSkills.includes(kw) ? "rgba(52,211,153,0.12)" : app.missingSkills.includes(kw) ? "rgba(248,113,113,0.10)" : "rgba(251,191,36,0.10)",
                      color:      app.matchingSkills.includes(kw) ? "#34d399"                : app.missingSkills.includes(kw) ? "#f87171"                 : "#fbbf24",
                    }}>
                    {kw}
                  </span>
                ))
              : <span className="text-[9px] text-text-ghost">No keywords</span>}
          </div>
        </div>

        {/* Interview Rounds */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Interview Rounds</p>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {rounds.map((r, i) => (
              <span key={i} className="flex items-center gap-0.5 text-[8px] px-2 py-0.5 rounded-full"
                style={{ background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}25` }}>
                {i + 1}. {r}
                <button onClick={() => { const u = rounds.filter((_, j) => j !== i); setRounds(u); onUpdate({ id: app.id, interviewRounds: u }); }}
                  className="ml-0.5 hover:text-red-400"><X size={7} /></button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input value={newRound} onChange={(e) => setNewRound(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRound()}
              placeholder="Add round (OA, Phone, Onsite...)"
              className="flex-1 text-[9px] bg-transparent outline-none text-text-primary placeholder:text-text-ghost px-2 py-1 rounded-lg"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
            <button onClick={addRound} className="px-2 py-1 rounded-lg text-[9px]"
              style={{ background: `${accentColor}15`, color: accentColor }}>+</button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Notes</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ id: app.id, notes })}
            rows={3} placeholder="Add notes..."
            className="w-full text-[9px] bg-transparent outline-none text-text-secondary placeholder:text-text-ghost px-2 py-1.5 rounded-lg resize-none"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] hover:underline" style={{ color: accentColor }}><ExternalLink size={8} /> Job Post</a>}
            {app.isReferral && app.referral && <span className="text-[9px] text-green-400 flex items-center gap-1"><Users size={8} />{app.referral.name} · {app.referral.relationship}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
        <button onClick={() => { onDelete(app.id); onClose(); }} className="flex items-center gap-1 text-[9px] text-red-400/60 hover:text-red-400"><Trash2 size={9} /> Delete</button>
        <button onClick={onClose} className="ml-auto flex items-center gap-1 text-[9px] text-text-ghost hover:text-text-primary"><X size={9} /> Close</button>
      </div>
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanView({ applications, accentColor, onUpdate, onDelete }: {
  applications: ApplicationEntry[];
  accentColor: string;
  onUpdate: (e: Partial<ApplicationEntry> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="h-full flex gap-2 p-3 overflow-x-auto overflow-y-hidden">
      {KANBAN_GROUPS.map((group) => {
        const groupApps = applications.filter((a) => group.statuses.includes(a.status));
        return (
          <div key={group.id} className="flex flex-col rounded-xl shrink-0 overflow-hidden"
            style={{ width: 200, background: "rgba(255,255,255,0.02)", border: `1px solid ${group.color}20` }}>
            <div className="flex items-center gap-2 px-3 py-2 shrink-0"
              style={{ background: `${group.color}10`, borderBottom: `1px solid ${group.color}20` }}>
              <span className="text-[10px] font-semibold" style={{ color: group.color }}>{group.label}</span>
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${group.color}20`, color: group.color }}>{groupApps.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {groupApps.map((app) => (
                <KanbanCard key={app.id} app={app} accentColor={accentColor} groupColor={group.color} onUpdate={onUpdate} />
              ))}
              {groupApps.length === 0 && (
                <div className="flex items-center justify-center py-6"><span className="text-[9px] text-text-ghost">Empty</span></div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ app, accentColor, groupColor, onUpdate }: {
  app: ApplicationEntry;
  accentColor: string;
  groupColor: string;
  onUpdate: (e: Partial<ApplicationEntry> & { id: string }) => void;
}) {
  const catCfg = app.category ? CATEGORY_MAP[app.category] : null;
  const overdue = isOverdue(app.followUpDate);
  const dueSoon = isDueSoon(app.followUpDate);

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="p-2.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${groupColor}15` }}>
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-text-primary truncate">{app.company}</p>
          <p className="text-[9px] text-text-muted truncate">{app.role}</p>
        </div>
        {app.atsScore > 0 && (
          <span className="text-[9px] font-bold shrink-0"
            style={{ color: app.atsScore >= 70 ? "#34d399" : app.atsScore >= 50 ? "#fbbf24" : "#f87171" }}>
            {app.atsScore}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap mt-1">
        {catCfg && <span className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: `${catCfg.color}15`, color: catCfg.color }}>{catCfg.label}</span>}
        {app.isReferral && <span className="text-[7px] px-1 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>REF</span>}
        {(overdue || dueSoon) && <span className="text-[7px] px-1 py-0.5 rounded" style={{ background: overdue ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)", color: overdue ? "#f87171" : "#fbbf24" }}>{overdue ? "⚠ overdue" : "● soon"}</span>}
        <span className="text-[8px] text-text-ghost ml-auto">{relativeDate(app.appliedDate)}</span>
      </div>
      <div className="mt-2 pt-1.5 border-t border-white/[0.04]">
        <select value={app.status} onChange={(e) => onUpdate({ id: app.id, status: e.target.value as ApplicationStatus })}
          className="w-full text-[8px] font-medium px-1.5 py-1 rounded-lg outline-none appearance-none cursor-pointer"
          style={{ background: `${STATUS_CONFIG[app.status].color}15`, color: STATUS_CONFIG[app.status].color, border: `1px solid ${STATUS_CONFIG[app.status].color}25` }}>
          {ALL_STATUSES.map((s) => <option key={s} value={s} style={{ background: "#1a1a2e" }}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>
    </motion.div>
  );
}

// ─── Cards View ───────────────────────────────────────────────────────────────

function CardsView({ applications, accentColor, editingId, onEdit, onUpdate, onDelete }: {
  applications: ApplicationEntry[];
  accentColor: string;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onUpdate: (e: Partial<ApplicationEntry> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      {applications.map((app) => {
        const cfg      = STATUS_CONFIG[app.status];
        const catCfg   = app.category ? CATEGORY_MAP[app.category] : null;
        const expanded = editingId === app.id;
        const overdue  = isOverdue(app.followUpDate);

        return (
          <motion.div key={app.id} layout className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${expanded ? `${cfg.color}30` : "rgba(255,255,255,0.06)"}` }}>
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => onEdit(expanded ? null : app.id)}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
                <cfg.icon size={14} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[12px] font-medium text-text-primary truncate">{app.company}</p>
                  {catCfg && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${catCfg.color}15`, color: catCfg.color }}>{catCfg.label}</span>}
                  {app.isReferral && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>Referral</span>}
                  {overdue && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>⚠ Follow-up</span>}
                </div>
                <p className="text-[10px] text-text-muted truncate">{app.role}</p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-[11px] font-bold" style={{ color: app.atsScore >= 70 ? "#34d399" : app.atsScore >= 50 ? "#fbbf24" : "#f87171" }}>
                  {app.atsScore > 0 ? `${app.atsScore}%` : "—"}
                </p>
                <p className="text-[8px] text-text-ghost">ATS</p>
              </div>
              <select value={app.status} onChange={(e) => { e.stopPropagation(); onUpdate({ id: app.id, status: e.target.value as ApplicationStatus }); }}
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] font-medium px-2 py-1 rounded-lg outline-none appearance-none cursor-pointer"
                style={{ background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                {ALL_STATUSES.map((s) => <option key={s} value={s} style={{ background: "#1a1a2e" }}>{STATUS_CONFIG[s].label}</option>)}
              </select>
              <span className="text-[9px] text-text-ghost shrink-0">{relativeDate(app.appliedDate)}</span>
            </div>
            <AnimatePresence>
              {expanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <ExpandedRow app={app} accentColor={accentColor} onUpdate={onUpdate} onDelete={onDelete} onClose={() => onEdit(null)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

function AddApplicationForm({ accentColor, onSave, onClose }: {
  accentColor: string;
  onSave: (entry: ApplicationEntry) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    company: "", role: "", location: "", jobUrl: "", resumeLink: "",
    status: "applied" as ApplicationStatus, platform: "linkedin",
    atsScore: 0, keywords: "", notes: "", isReferral: false,
    salary: "", followUpDate: "", category: "other" as AppCategory,
    referralName: "", referralEmail: "", referralPhone: "", referralLinkedin: "", referralRelationship: "",
  });

  const handleSave = () => {
    if (!form.company || !form.role) return;
    const entry: ApplicationEntry = {
      id: uuidv4(),
      company: form.company, role: form.role, location: form.location,
      jobUrl: form.jobUrl, resumeLink: form.resumeLink, status: form.status,
      appliedDate: new Date().toISOString(), lastUpdated: new Date().toISOString(),
      atsScore: Number(form.atsScore),
      keywords: form.keywords.split(",").map((s) => s.trim()).filter(Boolean),
      matchingSkills: [], missingSkills: [],
      platform: form.platform, isReferral: form.isReferral,
      category: form.category,
      referral: form.isReferral ? {
        name: form.referralName, email: form.referralEmail,
        phone: form.referralPhone, linkedin: form.referralLinkedin,
        relationship: form.referralRelationship,
      } : undefined,
      salary: form.salary, notes: form.notes,
      followUpDate: form.followUpDate || undefined,
    };
    onSave(entry);
  };

  const inputStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
  const catCfg = CATEGORY_MAP[form.category];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-5 space-y-3"
        style={{ background: "rgba(18,18,30,0.98)", border: "1px solid rgba(255,255,255,0.10)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-text-primary">Track Application</h3>
          <button onClick={onClose}><X size={14} className="text-text-muted" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company *" className="text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg" style={inputStyle} />
          <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role *" className="text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg" style={inputStyle} />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg" style={inputStyle} />
          <input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="Salary range" className="text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg" style={inputStyle} />
          <input value={form.jobUrl} onChange={(e) => setForm({ ...form, jobUrl: e.target.value })} placeholder="Job URL" className="text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg col-span-2" style={inputStyle} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })} className="text-[10px] text-text-secondary bg-transparent px-2 py-1.5 rounded-lg outline-none" style={inputStyle}>
            {ALL_STATUSES.map((s) => <option key={s} value={s} style={{ background: "#1a1a2e" }}>{STATUS_CONFIG[s].label}</option>)}
          </select>
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="text-[10px] text-text-secondary bg-transparent px-2 py-1.5 rounded-lg outline-none" style={inputStyle}>
            {["linkedin", "company-site", "referral", "indeed", "glassdoor", "wellfound", "naukri", "other"].map((p) => <option key={p} value={p} style={{ background: "#1a1a2e" }}>{p}</option>)}
          </select>
          <input type="number" value={form.atsScore || ""} onChange={(e) => setForm({ ...form, atsScore: Number(e.target.value) })} placeholder="ATS %" className="text-[10px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={inputStyle} />
        </div>

        {/* Category picker */}
        <div>
          <p className="text-[9px] text-text-muted mb-1.5 font-semibold uppercase tracking-wider">Category</p>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => setForm({ ...form, category: cat.id })}
                className="px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all"
                style={form.category === cat.id
                  ? { background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }
                  : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-text-muted mb-1 block">Follow-up date</label>
            <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
              className="w-full text-[10px] text-text-primary outline-none px-2 py-1.5 rounded-lg" style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>
          <div>
            <label className="text-[9px] text-text-muted mb-1 block">Keywords (auto-filled from JD)</label>
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="React, AWS, TypeScript..."
              className="w-full text-[10px] text-text-primary placeholder:text-text-ghost outline-none px-2 py-1.5 rounded-lg" style={inputStyle} />
          </div>
        </div>

        <button onClick={() => setForm({ ...form, isReferral: !form.isReferral })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all"
          style={form.isReferral ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" } : { color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Users size={10} /> {form.isReferral ? "Has Referral ✓" : "Add Referral"}
        </button>

        {form.isReferral && (
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl" style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.12)" }}>
            <input value={form.referralName} onChange={(e) => setForm({ ...form, referralName: e.target.value })} placeholder="Referrer name" className="text-[10px] text-text-primary placeholder:text-text-ghost outline-none px-2 py-1.5 rounded-lg" style={inputStyle} />
            <input value={form.referralRelationship} onChange={(e) => setForm({ ...form, referralRelationship: e.target.value })} placeholder="Relationship" className="text-[10px] text-text-primary placeholder:text-text-ghost outline-none px-2 py-1.5 rounded-lg" style={inputStyle} />
            <input value={form.referralEmail} onChange={(e) => setForm({ ...form, referralEmail: e.target.value })} placeholder="Email" className="text-[10px] text-text-primary placeholder:text-text-ghost outline-none px-2 py-1.5 rounded-lg" style={inputStyle} />
            <input value={form.referralLinkedin} onChange={(e) => setForm({ ...form, referralLinkedin: e.target.value })} placeholder="LinkedIn URL" className="text-[10px] text-text-primary placeholder:text-text-ghost outline-none px-2 py-1.5 rounded-lg" style={inputStyle} />
          </div>
        )}

        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..."
          className="w-full text-[11px] text-text-primary placeholder:text-text-ghost outline-none px-2.5 py-2 rounded-lg resize-none" style={inputStyle} rows={2} />

        <button onClick={handleSave} disabled={!form.company || !form.role}
          className="w-full py-2.5 rounded-xl text-[12px] font-medium text-white disabled:opacity-40"
          style={{ background: accentColor }}>
          Save Application
        </button>
      </motion.div>
    </motion.div>
  );
}
