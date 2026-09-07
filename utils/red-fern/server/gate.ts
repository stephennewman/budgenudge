/**
 * The guard that keeps the demo off the open internet.
 *
 * Runs in middleware, ahead of everything else, so there is one place to
 * reason about rather than a check on each page: a visitor without the house
 * code gets the passcode screen, and an unauthenticated request to the API
 * gets a flat 404 rather than an invitation to keep trying.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SITE_COOKIE, codeMatches, scheduleCode, siteCode } from "./access";

const SECTION = "/red-fern";
const API_SECTION = "/api/red-fern";

/** The passcode screen and the form it posts to have to stay reachable. */
const ALWAYS_OPEN = ["/red-fern/enter", "/api/red-fern/access"];

/**
 * Returns a response when the request should be stopped at the gate, or null
 * to let it carry on to the rest of the middleware.
 */
export function redFernGate(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  const inSection = pathname === SECTION || pathname.startsWith(`${SECTION}/`);
  const inApi = pathname === API_SECTION || pathname.startsWith(`${API_SECTION}/`);
  if (!inSection && !inApi) return null;
  if (ALWAYS_OPEN.includes(pathname)) return null;

  if (codeMatches(request.cookies.get(SITE_COOKIE)?.value, siteCode())) return null;

  // A calendar app subscribing to the feed can't hold a cookie, so the feed
  // is allowed to carry its own secret in the query string as it always has.
  if (
    pathname === `${API_SECTION}/calendar.ics` &&
    codeMatches(searchParams.get("key") ?? undefined, scheduleCode())
  ) {
    return null;
  }

  if (inApi) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "x-robots-tag": "noindex, nofollow" },
    });
  }

  const gate = request.nextUrl.clone();
  gate.pathname = `${SECTION}/enter`;
  gate.search = "";
  const wanted = `${pathname}${request.nextUrl.search}`;
  if (wanted !== SECTION) gate.searchParams.set("next", wanted);
  const response = NextResponse.redirect(gate);
  response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}
