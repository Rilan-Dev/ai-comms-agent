/** Server-only, deliberately disabled unless explicitly enabled. */
export function briefingsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.BRIEFINGS_ENABLED === 'true';
}
