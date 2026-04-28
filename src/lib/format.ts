// Shared formatting helpers for badges/labels.
// Dark-theme variants tuned for the "High-Tech Precision" palette.
import {
  NeedCategory, NeedStatus, Urgency,
  IncidentCategory, IncidentStatus, UpdateKind,
} from "@prisma/client";

export const urgencyColor: Record<Urgency, string> = {
  LOW:      "bg-white/5 text-on-surface-variant border border-white/10",
  MEDIUM:   "bg-yellow-400/10 text-yellow-200 border border-yellow-400/30",
  HIGH:     "bg-orange-400/10 text-orange-200 border border-orange-400/30",
  CRITICAL: "bg-red-500/15 text-red-200 border border-red-400/40",
};

export const statusColor: Record<NeedStatus, string> = {
  OPEN:        "bg-primary-container/10 text-primary border border-primary-container/40",
  MATCHED:     "bg-fuchsia-400/10 text-fuchsia-200 border border-fuchsia-400/30",
  IN_PROGRESS: "bg-indigo-400/10 text-indigo-200 border border-indigo-400/30",
  RESOLVED:    "bg-emerald-400/10 text-emerald-200 border border-emerald-400/30",
  CANCELLED:   "bg-white/5 text-on-surface-variant border border-white/10",
};

export const categoryEmoji: Record<NeedCategory, string> = {
  SUPPLY: "📦", MEDICAL: "🩺", SHELTER: "🏠", FOOD: "🍲",
  TRANSPORT: "🚐", COUNSELING: "💬", OTHER: "❓",
};

// ─── Incident formatting ──────────────────────────────────────────────

export const incidentCategoryEmoji: Record<IncidentCategory, string> = {
  FLOOD: "🌊", FIRE: "🔥", EARTHQUAKE: "🌐", STORM: "🌪",
  OUTBREAK: "🧫", ACCIDENT: "🛑", CONFLICT: "⚠", OTHER: "❓",
};

export const incidentCategoryLabel: Record<IncidentCategory, string> = {
  FLOOD: "Flood", FIRE: "Fire", EARTHQUAKE: "Earthquake", STORM: "Storm",
  OUTBREAK: "Outbreak", ACCIDENT: "Accident", CONFLICT: "Conflict", OTHER: "Other",
};

export const incidentStatusColor: Record<IncidentStatus, string> = {
  ACTIVE:     "border-red-400/40 bg-red-500/15 text-red-200",
  MONITORING: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  RESOLVED:   "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  ARCHIVED:   "border-white/10 bg-white/5 text-on-surface-variant",
};

export const incidentStatusDot: Record<IncidentStatus, string> = {
  ACTIVE:     "bg-red-300 animate-pulse-dot",
  MONITORING: "bg-yellow-300 animate-pulse-dot",
  RESOLVED:   "bg-emerald-300",
  ARCHIVED:   "bg-slate-500",
};

export const updateKindStyle: Record<UpdateKind, { label: string; chip: string; dot: string; icon: string }> = {
  INFO:       { label: "Info",       chip: "border-sky-400/30 bg-sky-400/10 text-sky-200",             dot: "bg-sky-300",      icon: "ℹ" },
  HAZARD:     { label: "Hazard",     chip: "border-red-400/40 bg-red-500/15 text-red-200",             dot: "bg-red-300",      icon: "⚠" },
  NEED:       { label: "Need",       chip: "border-orange-400/30 bg-orange-400/10 text-orange-200",    dot: "bg-orange-300",   icon: "✦" },
  RESOURCE:   { label: "Resource",   chip: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", dot: "bg-emerald-300",  icon: "◇" },
  STATUS:     { label: "Status",     chip: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200", dot: "bg-fuchsia-300",  icon: "↻" },
  RESOLUTION: { label: "Resolution", chip: "border-teal-400/30 bg-teal-400/10 text-teal-200",          dot: "bg-teal-300",     icon: "✓" },
};
