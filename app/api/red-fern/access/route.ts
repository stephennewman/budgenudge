import { NextRequest, NextResponse } from "next/server";
import {
  SITE_COOKIE,
  SITE_COOKIE_MAX_AGE,
  codeMatches,
  siteCode,
} from "@/utils/red-fern/server/access";

/**
 * Takes the house code from the gate form and, if it's right, remembers it.
 *
 * The code is kept in an http-only cookie so it isn't readable from the page,
 * and the redirect target is checked against the section it's allowed to reach
 * — an open redirect out of a passcode form would defeat the point of it.
 */
export const dynamic = "force-dynamic";

function safeNext(value: FormDataEntryValue | null): string {
  const wanted = typeof value === "string" ? value : "";
  return wanted.startsWith("/red-fern") && !wanted.startsWith("//") ? wanted : "/red-fern";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  const given = form.get("code");

  if (!codeMatches(typeof given === "string" ? given.trim() : undefined, siteCode())) {
    const retry = new URL("/red-fern/enter", request.url);
    retry.searchParams.set("wrong", "1");
    if (next !== "/red-fern") retry.searchParams.set("next", next);
    return NextResponse.redirect(retry, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set({
    name: SITE_COOKIE,
    value: siteCode(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SITE_COOKIE_MAX_AGE,
  });
  return response;
}
