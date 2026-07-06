import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/utils/supabase/server";

// Star/unstar a BOGO deal from the mirror. Stars are shared (stored on the
// weekly deals row itself), so every mirror shows the same starred items and
// they reset naturally when a new ad week is ingested.
//
// AUTH: mirrors the other /api/mirror write routes — a logged-in session or a
// trusted device passing MIRROR_TOKEN.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAuthorized(searchParams: URLSearchParams): Promise<boolean> {
  try {
    const authClient = await createSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user) return true;
  } catch {
    /* fall through to token */
  }
  const token = searchParams.get("token");
  const expected = process.env.MIRROR_TOKEN;
  return Boolean(expected && token && token === expected);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (!(await isAuthorized(searchParams))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let id = 0;
  let starred = true;
  try {
    const body = await request.json();
    id = Number(body.id) || 0;
    starred = Boolean(body.starred);
  } catch {
    /* handled below */
  }
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("deals").update({ starred }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to update star" }, { status: 500 });
  }
  return NextResponse.json({ success: true, id, starred });
}
