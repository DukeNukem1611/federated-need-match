// Shared formatting helpers for badges/labels.
// Light-theme variants tuned for the "Calm Relief" palette.
import {
  NeedCategory, NeedStatus, Urgency,
  IncidentCategory, IncidentStatus, UpdateKind,
} from "@prisma/client";

export const urgencyColor: Record<Urgency, string> = {
  LOW:      "bg-black/[0.04] text-on-surface-variant border border-black/10",
  MEDIUM:   "bg-yellow-400/15 text-yellow-700 border border-yellow-500/30",
  HIGH:     "bg-orange-400/15 text-orange-700 border border-orange-500/30",
  CRITICAL: "bg-red-500/10 text-red-700 border border-red-500/30",
};

export const statusColor: Record<NeedStatus, string> = {
  OPEN:        "bg-primary-container/10 text-primary border border-primary-container/40",
  MATCHED:     "bg-fuchsia-400/10 text-fuchsia-700 border border-fuchsia-500/30",
  IN_PROGRESS: "bg-indigo-400/10 text-indigo-700 border border-indigo-500/30",
  RESOLVED:    "bg-emerald-400/10 text-emerald-700 border border-emerald-500/30",
  CANCELLED:   "bg-black/[0.04] text-on-surface-variant border border-black/10",
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
  ACTIVE:     "border-red-500/30 bg-red-500/10 text-red-700",
  MONITORING: "border-yellow-500/30 bg-yellow-400/15 text-yellow-700",
  RESOLVED:   "border-emerald-500/30 bg-emerald-400/10 text-emerald-700",
  ARCHIVED:   "border-black/10 bg-black/[0.04] text-on-surface-variant",
};

export const incidentStatusDot: Record<IncidentStatus, string> = {
  ACTIVE:     "bg-red-500 animate-pulse-dot",
  MONITORING: "bg-yellow-500 animate-pulse-dot",
  RESOLVED:   "bg-emerald-500",
  ARCHIVED:   "bg-slate-400",
};

export const updateKindStyle: Record<UpdateKind, { label: string; chip: string; dot: string; icon: string }> = {
  INFO:       { label: "Info",       chip: "border-sky-500/30 bg-sky-400/10 text-sky-700",             dot: "bg-sky-500",      icon: "ℹ" },
  HAZARD:     { label: "Hazard",     chip: "border-red-500/30 bg-red-500/10 text-red-700",             dot: "bg-red-500",      icon: "⚠" },
  NEED:       { label: "Need",       chip: "border-orange-500/30 bg-orange-400/10 text-orange-700",    dot: "bg-orange-500",   icon: "✦" },
  RESOURCE:   { label: "Resource",   chip: "border-emerald-500/30 bg-emerald-400/10 text-emerald-700", dot: "bg-emerald-500",  icon: "◇" },
  STATUS:     { label: "Status",     chip: "border-fuchsia-500/30 bg-fuchsia-400/10 text-fuchsia-700", dot: "bg-fuchsia-500",  icon: "↻" },
  RESOLUTION: { label: "Resolution", chip: "border-teal-500/30 bg-teal-400/10 text-teal-700",          dot: "bg-teal-500",     icon: "✓" },
};
