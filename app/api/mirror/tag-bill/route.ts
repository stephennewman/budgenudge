import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSuperAdminId } from "@/utils/auth/superadmin";
import { createSupabaseClient } from "@/utils/supabase/server";

// Tag a merchant as a recurring bill from the mirror's Daily burn widget.
// Burn/pacing exclude tagged bills, so the merchant moves to the Bills group.
//
// AUTH: mirrors the other /api/mirror routes — a logged-in session acts on the
// user's own data, or a trusted device passes MIRROR_TOKEN for the configured
// finance user.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolveUserId(searchParams: URLSearchParams): Promise<string | null> {
  try {
    const authClient = await createSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user) return user.id;
  } catch {
    /* fall through to token */
  }
  const token = searchParams.get("token");
  const expected = process.env.MIRROR_TOKEN;
  if (expected && token && token === expected) {
    return process.env.MIRROR_FINANCE_USER_ID || getSuperAdminId();
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = await resolveUserId(searchParams);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let merchantName = "";
  let expectedAmount = 0;
  let action: "add" | "remove" = "add";
  try {
    const body = await request.json();
    merchantName = String(body.merchant_name || "").trim();
    expectedAmount = Math.max(1, Math.round(Number(body.expected_amount) || 0));
    if (body.action === "remove") action = "remove";
  } catch {
    /* handled below */
  }
  if (!merchantName) {
    return NextResponse.json({ error: "merchant_name is required" }, { status: 400 });
  }

  try {
    if (action === "remove") {
      // Deactivate the tag — the merchant returns to normal burn/pacing.
      // Pacing rows display the AI merchant name, but tags may be stored
      // under the raw bank description, so also match via the AI-name map.
      const { data: aiRows } = await supabase
        .from("merchant_ai_tags")
        .select("merchant_pattern")
        .ilike("ai_merchant_name", merchantName);
      const patterns = new Set(
        (aiRows || []).map((r) => (r.merchant_pattern || "").toLowerCase()).filter(Boolean)
      );

      const { data: activeTags } = await supabase
        .from("tagged_merchants")
        .select("id, merchant_name, merchant_pattern")
        .eq("user_id", userId)
        .eq("is_active", true);
      const nameLower = merchantName.toLowerCase();
      const ids = (activeTags || [])
        .filter(
          (t) =>
            (t.merchant_name || "").toLowerCase() === nameLower ||
            patterns.has((t.merchant_name || "").toLowerCase()) ||
            patterns.has((t.merchant_pattern || "").toLowerCase())
        )
        .map((t) => t.id);
      if (ids.length === 0) {
        return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      }

      const { error } = await supabase
        .from("tagged_merchants")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) {
        return NextResponse.json({ error: "Failed to remove bill" }, { status: 500 });
      }
      return NextResponse.json({ success: true, removed: true });
    }

    // Reactivate an existing tag if one exists for this merchant; otherwise
    // create a new monthly bill prediction.
    const { data: existing } = await supabase
      .from("tagged_merchants")
      .select("id, is_active")
      .eq("user_id", userId)
      .ilike("merchant_name", merchantName)
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        await supabase
          .from("tagged_merchants")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return NextResponse.json({ success: true, reactivated: true });
    }

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const { data: userItems } = await supabase
      .from("items")
      .select("plaid_item_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("tagged_merchants").insert({
      user_id: userId,
      merchant_name: merchantName,
      merchant_pattern: merchantName,
      expected_amount: expectedAmount,
      prediction_frequency: "monthly",
      confidence_score: 75,
      auto_detected: false,
      is_active: true,
      account_identifier: userItems?.plaid_item_id || null,
      next_predicted_date: nextMonth.toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: "Failed to tag as bill" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to tag as bill" }, { status: 500 });
  }
}
