import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { getSuperAdminId } from "@/utils/auth/superadmin";
import { createSupabaseClient } from "@/utils/supabase/server";

// Transaction drill-down for a pacing row on the mirror: the transactions
// behind a category/vendor's month-to-date actual, or a bill's payment
// history over the last 12 months.
//
// AUTH: same pattern as the other /api/mirror routes — session or MIRROR_TOKEN.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same money-movement exclusions as the pacing route.
const EXCLUDED_CATEGORIES = new Set([
  "transfer",
  "payment",
  "credit card payment",
  "credit card bill",
]);
const TRANSFER_MERCHANTS = ["venmo", "zelle", "cash app", "paypal", "apple cash"];

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = await resolveUserId(searchParams);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const group = searchParams.get("group"); // "category" | "vendor" | "bill"
  const name = (searchParams.get("name") || "").trim();
  if (!group || !["category", "vendor", "bill"].includes(group) || !name) {
    return NextResponse.json({ error: "group and name are required" }, { status: 400 });
  }

  const tz = searchParams.get("tz") || "America/New_York";
  const today = DateTime.now().setZone(tz).startOf("day");

  // Optional month=YYYY-MM matches the pacing card's month switcher.
  let monthStart = today.startOf("month");
  const monthParam = searchParams.get("month");
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const m = DateTime.fromISO(`${monthParam}-01`, { zone: tz });
    if (m.isValid && m.startOf("month") <= today.startOf("month")) {
      monthStart = m.startOf("month");
    }
  }
  const isCurrentMonth = monthStart.equals(today.startOf("month"));
  const monthEnd = isCurrentMonth ? today : monthStart.endOf("month").startOf("day");

  // Categories/vendors show the viewed month's transactions behind the pacing
  // "actual"; bills show a year of payment history so the pattern is visible.
  const windowStart = group === "bill" ? today.minus({ days: 365 }) : monthStart;
  const windowEnd = group === "bill" ? today : monthEnd;

  try {
    const { data: items } = await supabase
      .from("items")
      .select("plaid_item_id")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (!items || items.length === 0) {
      return NextResponse.json({ transactions: [] });
    }
    const itemIds = items.map((i) => i.plaid_item_id);

    const { data: tagged } = await supabase
      .from("tagged_merchants")
      .select("merchant_name")
      .eq("user_id", userId)
      .eq("is_active", true);
    const billSet = new Set(
      (tagged || [])
        .map((t) => (t.merchant_name || "").toLowerCase().trim())
        .filter(Boolean)
    );

    // Paginate: a 12-month window can exceed Supabase's 1000-row cap, which
    // would silently drop older transactions.
    type TxnRow = {
      amount: number;
      date: string;
      ai_category_tag: string | null;
      ai_merchant_name: string | null;
      merchant_name: string | null;
      name: string | null;
    };
    const txns: TxnRow[] = [];
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data: page } = await supabase
        .from("transactions")
        .select("amount, date, ai_category_tag, ai_merchant_name, merchant_name, name")
        .in("plaid_item_id", itemIds)
        .gt("amount", 0)
        .gte("date", windowStart.toISODate()!)
        .lte("date", windowEnd.toISODate()!)
        .order("date", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      txns.push(...(page as TxnRow[]));
      if (page.length < PAGE) break;
    }

    const nameLower = name.toLowerCase();
    const out: { date: string; name: string; amount: number }[] = [];

    for (const t of txns) {
      const rawMerchant = (t.merchant_name || t.name || "").trim();
      if (!rawMerchant) continue;

      const cat = (t.ai_category_tag || "").trim().toLowerCase();
      const venLower = (t.ai_merchant_name || rawMerchant).toLowerCase();
      const isBill =
        billSet.has(rawMerchant.toLowerCase()) || billSet.has(venLower);

      // Bill matching runs before the money-movement exclusions — bills like
      // a mortgage are often AI-categorized as "payment" and would otherwise
      // be dropped (mirrors the pacing route).
      let matches = false;
      if (group === "bill") {
        matches = isBill && (t.ai_merchant_name || rawMerchant).toLowerCase() === nameLower;
      } else if (
        isBill ||
        EXCLUDED_CATEGORIES.has(cat) ||
        TRANSFER_MERCHANTS.some((m) => venLower.includes(m))
      ) {
        matches = false;
      } else if (group === "category") {
        matches = cat === nameLower;
      } else {
        matches =
          (t.ai_merchant_name || t.merchant_name || t.name || "Unknown").toLowerCase() ===
          nameLower;
      }
      if (!matches) continue;

      out.push({
        date: String(t.date),
        name: t.merchant_name || t.name || "Purchase",
        amount: Math.round(Number(t.amount) * 100) / 100,
      });
      if (out.length >= 100) break;
    }

    return NextResponse.json({
      group,
      name,
      window:
        group === "bill"
          ? "12 months"
          : isCurrentMonth
            ? "month to date"
            : monthStart.toFormat("LLLL"),
      total: Math.round(out.reduce((s, t) => s + t.amount, 0)),
      transactions: out,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
  }
}
