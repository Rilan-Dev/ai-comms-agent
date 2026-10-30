"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { parseThemePreference, THEME_STORAGE_KEY, type WorkspaceTheme } from "@/lib/theme-preference";
export function ThemeToggle() {
  const [theme, setTheme] = useState<WorkspaceTheme>("dark");
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Blocked storage. */ }
    const initial = parseThemePreference(stored);
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const next = parseThemePreference(event.key === null ? null : event.newValue);
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Still applies for this tab. */ }
  }
  return <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    title={theme === "dark" ? "Light theme" : "Dark theme"}
    className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3">
    {theme === "dark" ? <Sun size={16} aria-hidden="true"/> : <Moon size={16} aria-hidden="true"/>}
    <span className="hidden lg:inline">{theme === "dark" ? "Light" : "Dark"}</span>
  </button>;
}
