import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/identity/supabase-adapter";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  response.cookies.set("aca-refresh-token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
