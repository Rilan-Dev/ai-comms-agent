export type WorkspaceTheme = "dark" | "light";
export const THEME_STORAGE_KEY = "aca-workspace-theme";
export function parseThemePreference(value: unknown): WorkspaceTheme {
  return value === "light" ? "light" : "dark";
}
