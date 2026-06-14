export const APP_VERSION = "1.0.0";
export const WEB_URL = "https://avectoi.care";

export const SLOT_DURATION_DEFAULT = 60;
export const MAX_VISITORS_PER_SLOT_DEFAULT = 2;
export const MIN_GAP_MINUTES_DEFAULT = 120;

export const PURGE_DELAY_DAYS = 90;

export const SUPPORT_PHONE = "0617927600";

export const TASK_CATEGORIES = [
  { key: "repas", label: "Repas", icon: "🍱" },
  { key: "affaires", label: "Affaires", icon: "👜" },
  { key: "courses", label: "Courses", icon: "🛒" },
  { key: "autre", label: "Autre", icon: "📦" },
] as const;

export const TASK_STATUSES = [
  { key: "ouvert", label: "À prendre en charge", color: "#3ecf8e" },
  { key: "pris_en_charge", label: "Pris en charge", color: "#f0b429" },
  { key: "fait", label: "Fait ✓", color: "#7a8fa6" },
] as const;
