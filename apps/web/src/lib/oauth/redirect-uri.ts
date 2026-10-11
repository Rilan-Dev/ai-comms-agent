import { isIP } from "node:net";

/**
 * Resolves the public application origin when running behind a reverse proxy.
 *
 * A proxy must validate the incoming Host header and overwrite (not append to)
 * X-Forwarded-Host and X-Forwarded-Proto. Comma-separated forwarding chains are
 * rejected so an untrusted left-most value cannot silently select an OAuth
 * callback. If the proxy does not provide these headers, request.url is used.
 */
export function getOAuthPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();

  if (forwardedHost || forwardedProto) {
    if (!forwardedHost || !forwardedProto || forwardedHost.includes(",") || forwardedProto.includes(",")) {
      throw new Error("The reverse proxy must provide a single validated X-Forwarded-Host and X-Forwarded-Proto value.");
    }
    if (forwardedProto !== "http" && forwardedProto !== "https") {
      throw new Error("The reverse proxy supplied an unsupported public protocol.");
    }
    if (/[\s/@?#]/.test(forwardedHost) || forwardedHost.includes("\\")) {
      throw new Error("The reverse proxy supplied an invalid public host.");
    }

    let forwarded: URL;
    try {
      forwarded = new URL(forwardedProto + "://" + forwardedHost);
    } catch {
      throw new Error("The reverse proxy supplied an invalid public origin.");
    }
    if (forwarded.username || forwarded.password || forwarded.pathname !== "/" || forwarded.search || forwarded.hash) {
      throw new Error("The reverse proxy supplied an invalid public origin.");
    }
    return forwarded.origin;
  }

  const current = new URL(request.url);
  if (current.username || current.password) throw new Error("Invalid application origin.");
  return current.origin;
}

/**
 * Builds a provider callback from the public origin the user actually accessed.
 * NEXT_PUBLIC_APP_URL is deliberately not used: it can become stale after a
 * domain change. Production OAuth providers require HTTPS; plain HTTP is
 * accepted only for loopback development.
 */
export function getOAuthRedirectUri(request: Request, provider: "gmail" | "zoho"): string {
  return new URL("/api/oauth/" + provider + "/callback", getOAuthPublicOrigin(request)).toString();
}

export function assertOAuthRedirectUriSecure(redirectUri: string): void {
  const url = new URL(redirectUri);
  const hostname = url.hostname.replace("[", "").replace("]", "");
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!local && isIP(hostname)) {
    throw new Error("OAuth provider callbacks require a DNS domain; raw IP callback hosts are not supported.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("OAuth callbacks require HTTPS on non-local hosts. Open this application using its HTTPS domain, then register the displayed callback URI with the provider.");
  }
}
