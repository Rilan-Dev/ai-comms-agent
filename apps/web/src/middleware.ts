import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/login", "/api/auth/logout", "/api/auth/bootstrap", "/api/health", "/api/dev/seed"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + "/"))) return NextResponse.next({ request: { headers: requestHeaders } });
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return NextResponse.next({ request: { headers: requestHeaders } });

  // API routes deliberately return JSON 401/403 rather than redirecting.
  if (pathname.startsWith("/api/")) return NextResponse.next({ request: { headers: requestHeaders } });

  const accessToken = request.cookies.get("aca-access-token")?.value;
  if (!accessToken) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
