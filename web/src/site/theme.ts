import { useSyncExternalStore } from "react";

/** What the reader picked; "system" follows the operating system. */
export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "hlr-theme";
const listeners = new Set<() => void>();
const media =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function stored(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

let choice: ThemeChoice = typeof window === "undefined" ? "system" : stored();

function resolved(): Theme {
  if (choice !== "system") return choice;
  return media?.matches ? "dark" : "light";
}

/** index.html sets the same attribute before the first paint. */
function apply() {
  const theme = resolved();
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  listeners.forEach((listener) => listener());
}

media?.addEventListener("change", () => {
  if (choice === "system") apply();
});

export function setTheme(next: ThemeChoice) {
  choice = next;
  try {
    if (next === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    /* the choice still applies to this visit */
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => `${choice}:${resolved()}`;

export function useTheme(): {
  choice: ThemeChoice;
  theme: Theme;
  setTheme: (next: ThemeChoice) => void;
} {
  const [current, theme] = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system:light",
  ).split(":") as [ThemeChoice, Theme];
  return { choice: current, theme, setTheme };
}

/** Surface shading greys for the dark page: guide fills match the page. */
export const DARK_SURFACE_TONES = { unlit: 10 / 255, shadow: 0.1, lit: 0.3 };

/** On-screen shading tones for the current theme (exports always use paper). */
export function useSurfaceTones() {
  return useTheme().theme === "dark" ? DARK_SURFACE_TONES : undefined;
}
