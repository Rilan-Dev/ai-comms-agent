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

import { readFileSync } from "node:fs";

const style = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
function cssTokens(selector: string): Record<string, string> {
  const start = style.indexOf(selector);
  if (start < 0) throw new Error("Missing theme selector: " + selector);
  const block = style.slice(start + selector.length, style.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
}
function contrast(a: string, b: string): number {
  const luminance = (value: string) => {
    const rgb = value.match(/[\da-f]{2}/gi)?.map(x => parseInt(x, 16) / 255) ?? [];
    if (rgb.length !== 3) throw new Error("Expected six-digit hex color: " + value);
    const [r,g,b] = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126*r + .7152*g + .0722*b;
  };
  const [hi,lo] = [luminance(a),luminance(b)].sort((x,y) => y-x);
  return (hi+.05)/(lo+.05);
}
describe("midnight dark theme palette", () => {
  const dark = cssTokens(':root, :root[data-theme="dark"] {');
  const light = cssTokens(':root[data-theme="light"] {');
  it("uses midnight backgrounds and distinct neutral cards instead of forest-green surfaces", () => {
    expect(dark["--background"]).toBe("#0a0f18");
    expect(dark["--sidebar"]).toBe("#080d15");
    expect(dark["--card"]).toBe("#121a27");
    expect(dark["--secondary"]).toBe("#1b2738");
    expect(dark["--message-user"]).toBe("#1d2d42");
    expect(dark["--primary"]).toBe("#be2637");
  });
  it("keeps key dark text, muted labels, and red buttons legible", () => {
    expect(contrast(dark["--foreground"], dark["--background"])).toBeGreaterThanOrEqual(7);
    expect(contrast(dark["--muted-foreground"], dark["--card"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark["--primary-foreground"], dark["--primary"])).toBeGreaterThanOrEqual(4.5);
  });
  it("preserves the owner-approved sage and burnt-amber light theme", () => {
    expect(light["--background"]).toBe("#f6f8f3");
    expect(light["--primary"]).toBe("#cc5500");
    expect(light["--chart-2"]).toBe("#9caf88");
    expect(light["--tertiary"]).toBe("#a7a7a7");
  });
});