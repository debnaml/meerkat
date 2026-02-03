"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ThemeChoice = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (value: ThemeChoice) => void;
  ready: boolean;
}

const STORAGE_KEY = "meerkat-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): ThemeChoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return null;
  } catch (error) {
    console.warn("Unable to read theme preference", error);
    return null;
  }
}

function persistTheme(value: ThemeChoice) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch (error) {
    console.warn("Unable to persist theme preference", error);
  }
}

function applyDocumentTheme(value: ThemeChoice) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  if (value === "system") {
    root.removeAttribute("data-theme");
    return;
  }

  root.setAttribute("data-theme", value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => getStoredTheme() ?? "system");
  const initialTheme = useRef(theme);

  useEffect(() => {
    applyDocumentTheme(initialTheme.current);
  }, []);

  const setTheme = useCallback((value: ThemeChoice) => {
    setThemeState(value);
    persistTheme(value);
    applyDocumentTheme(value);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, ready: true }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export const THEME_CHOICES: { label: string; value: ThemeChoice }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];
