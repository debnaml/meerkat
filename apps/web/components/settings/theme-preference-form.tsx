"use client";

import { useMemo } from "react";

import { THEME_CHOICES, useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemePreferenceForm() {
  const { theme, setTheme, ready } = useTheme();

  const description = useMemo(() => {
    if (!ready) {
      return "Detecting your saved preference…";
    }
    if (theme === "system") {
      return "Theme follows your device setting.";
    }
    return theme === "light" ? "Light mode is locked on." : "Dark mode is locked on.";
  }, [ready, theme]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {THEME_CHOICES.map((choice) => {
          const isActive = theme === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              disabled={!ready}
              onClick={() => setTheme(choice.value)}
              aria-pressed={isActive}
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] shadow-sm"
                  : "border-[var(--color-border-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                !ready && "opacity-60"
              )}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}
