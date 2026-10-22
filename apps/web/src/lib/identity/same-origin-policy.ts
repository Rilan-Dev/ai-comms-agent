/**
 * A Vercel deployment alias belongs to the current request only if it is
 * the exact Host reached by the browser. The *.vercel.app suffix is shared
 * by unrelated projects and must never be treated as a trust boundary.
 *
 * Missing Origin remains allowed for existing non-browser API clients; route
 * authentication, membership and permissions remain independently required.
 */
export function isTrustedRequestOrigin(input: {
  origin: string | null;
  expectedOrigin: string | null;
  host: string | null;
  forwardedProto: string | null;
  production: boolean;
}): boolean {
  const { origin, expectedOrigin, host, forwardedProto, production } = input;
  if (origin == null || origin === "") return true;

  // An Origin header is a serialized origin: scheme + authority only, with
  // no path, credentials, userinfo or noncanonical default port.
  try {
    const parsed = new URL(origin);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:")
      || parsed.origin !== origin || parsed.username || parsed.password
      || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
  } catch {
    return false;
  }

  if (expectedOrigin && origin === expectedOrigin) return true;

  // APP_ORIGIN may differ from this deployment alias. Fall back only to the
  // exact routed Host, never another *.vercel.app project or preview.
  if (!host || !/^[A-Za-z0-9.[\]:-]+$/.test(host)) return false;
  const protocol = forwardedProto?.split(",")[0]?.trim()
    || (production ? "https" : "http");
  if (protocol !== "https" && protocol !== "http") return false;
  const actual = `${protocol}://${host}`;
  try {
    const parsed = new URL(actual);
    return parsed.origin === actual && origin === actual;
  } catch {
    return false;
  }
}
