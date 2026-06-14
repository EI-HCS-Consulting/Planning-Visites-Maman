export type ThemeKey = "blue" | "red" | "pink" | "green" | "yellow" | "orange";

export interface Theme {
  bg: string;
  card: string;
  border: string;
  accent: string;
  gold: string;
  text: string;
  muted: string;
  success: string;
  danger: string;
  orange: string;
}

export const themes: Record<ThemeKey, Theme> = {
  blue: {
    bg: "#0D1B2E",
    card: "#112240",
    border: "#1E3A5F",
    accent: "#2E75B6",
    gold: "#f0b429",
    text: "#e8edf5",
    muted: "#7a8fa6",
    success: "#3ecf8e",
    danger: "#e94560",
    orange: "#f97316",
  },
  red: {
    bg: "#1A0A0A",
    card: "#2A1010",
    border: "#5C1A1A",
    accent: "#C0392B",
    gold: "#f0b429",
    text: "#f5e8e8",
    muted: "#a67a7a",
    success: "#3ecf8e",
    danger: "#e94560",
    orange: "#f97316",
  },
  pink: {
    bg: "#1A0D14",
    card: "#2A1520",
    border: "#5C2040",
    accent: "#E91E8C",
    gold: "#f0b429",
    text: "#f5e8f0",
    muted: "#a67a90",
    success: "#3ecf8e",
    danger: "#e94560",
    orange: "#f97316",
  },
  green: {
    bg: "#0A1A0D",
    card: "#102A14",
    border: "#1A5C26",
    accent: "#27AE60",
    gold: "#f0b429",
    text: "#e8f5ea",
    muted: "#7aa680",
    success: "#3ecf8e",
    danger: "#e94560",
    orange: "#f97316",
  },
  yellow: {
    bg: "#1A1600",
    card: "#2A2400",
    border: "#5C4E00",
    accent: "#D4A017",
    gold: "#f0b429",
    text: "#f5f0e8",
    muted: "#a6987a",
    success: "#3ecf8e",
    danger: "#e94560",
    orange: "#f97316",
  },
  orange: {
    bg: "#1A0E00",
    card: "#2A1A00",
    border: "#5C3400",
    accent: "#E67E22",
    gold: "#f0b429",
    text: "#f5ece8",
    muted: "#a6887a",
    success: "#3ecf8e",
    danger: "#e94560",
    orange: "#f97316",
  },
};

export const themeLabels: Record<ThemeKey, string> = {
  blue: "Bleu nuit",
  red: "Rouge grenat",
  pink: "Rose doux",
  green: "Vert nature",
  yellow: "Jaune soleil",
  orange: "Orange vif",
};
