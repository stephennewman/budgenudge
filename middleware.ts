import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { redFernGate } from "@/utils/red-fern/server/gate";

export async function middleware(request: NextRequest) {
  // The Red Fern demo sits behind a house code and doesn't use Supabase auth,
  // so it's answered here before the session refresh runs.
  const gated = redFernGate(request);
  if (gated) return gated;

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
