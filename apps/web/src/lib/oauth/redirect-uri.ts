/**
 * Builds a provider callback from the host the user actually accessed.
 * NEXT_PUBLIC_APP_URL is deliberately not used: it can become stale after a
 * domain change. Production OAuth providers require HTTPS; plain HTTP is
 * accepted only for loopback development.
 *
 * The reverse proxy must validate incoming Host headers and preserve the
 * public Host in the request URL. OAuth providers still require each public
 * callback URI to be registered with that provider's client.
 */
export function getOAuthRedirectUri(request: Request, provider: "gmail" | "zoho"): string {
  const current = new URL(request.url);
  if (current.username || current.password) throw new Error("Invalid application origin.");
  const local = current.hostname === "localhost" || current.hostname === "127.0.0.1" || current.hostname === "[::1]";
  if (current.protocol !== "https:" && !(current.protocol === "http:" && local)) {
    throw new Error("OAuth callbacks require HTTPS on non-local hosts. Open this application using its HTTPS domain, then register the displayed callback URI with the provider.");
  }
  return new URL(`/api/oauth/${provider}/callback`, current.origin).toString();
}
