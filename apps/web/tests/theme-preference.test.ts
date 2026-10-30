import { describe, expect, it } from "vitest";
import { parseThemePreference, THEME_STORAGE_KEY } from "../src/lib/theme-preference";
describe("workspace theme preference", () => {
  it("defaults to dark without an explicit light selection", () => {
    expect(parseThemePreference(null)).toBe("dark");
    expect(parseThemePreference(undefined)).toBe("dark");
    expect(parseThemePreference("system")).toBe("dark");
    expect(parseThemePreference("dark")).toBe("dark");
  });
  it("restores a saved light theme", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(THEME_STORAGE_KEY).toBe("aca-workspace-theme");
  });
});
