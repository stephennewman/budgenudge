import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { getSuperAdminId } from "@/utils/auth/superadmin";
import { createSupabaseClient } from "@/utils/supabase/server";

// Yesterday's spend snapshot for the bathroom dashboard.
//
// AUTH: /mirror is a public page, so finance data is gated two ways:
//   1. A logged-in Supabase user gets their OWN data (session cookies).
//   2. A trusted in-home device passes the shared secret MIRROR_TOKEN, which
//      returns the configured finance user's data.
// Without either, it returns 401 and never touches financial data.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Exclude money-movement (transfers, credit-card payments, P2P) so breakdowns
// reflect true spending rather than cash shuffled around.
const EXCLUDED_CATEGORIES = new Set([
  "transfer",
  "payment",
  "credit card payment",
  "credit card bill",
]);
const TRANSFER_MERCHANTS = ["venmo", "zelle", "cash app", "paypal", "apple cash"];

type TxnRow = {
  amount: number | string;
  ai_category_tag?: string | null;
  ai_merchant_name?: string | null;
  merchant_name?: string | null;
  name?: string | null;
};

function topN(m: Map<string, number>, n: number) {
  return [...m.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

// Aggregate a set of transactions into total + top categories + top vendors,
// using the app's AI tags with sensible fallbacks and excluding money-movement.
function buildBreakdown(txns: TxnRow[]) {
  const catMap = new Map<string, number>();
  const venMap = new Map<string, number>();
  let total = 0;
  for (const t of txns) {
    const amt = Number(t.amount);
    const cat = (t.ai_category_tag || "").trim() || "Uncategorized";
    const ven =
      (t.ai_merchant_name || "").trim() ||
      (t.merchant_name || "").trim() ||
      (t.name || "").trim() ||
      "Unknown";
    const venLower = ven.toLowerCase();
    if (
      EXCLUDED_CATEGORIES.has(cat.toLowerCase()) ||
      TRANSFER_MERCHANTS.some((m) => venLower.includes(m))
    ) {
      continue;
    }
    total += amt;
    catMap.set(cat, (catMap.get(cat) ?? 0) + amt);
    venMap.set(ven, (venMap.get(ven) ?? 0) + amt);
  }
  return {
    total: Math.round(total * 100) / 100,
    categories: topN(catMap, 6),
    vendors: topN(venMap, 6),
  };
}

async function resolveUserId(searchParams: URLSearchParams): Promise<string | null> {
  // 1) Authenticated session → that user's own data.
  try {
    const authClient = await createSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user) return user.id;
  } catch {
    // No/invalid session; fall through to token.
  }

  // 2) Shared finance token → configured finance user.
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

  const tz = searchParams.get("tz") || "America/New_York";
  const today = DateTime.now().setZone(tz).startOf("day");
  const yesterday = today.minus({ days: 1 }).toISODate();

  // Trend window: 7 full days ending yesterday, plus the prior 7 for comparison.
  const trendStart = today.minus({ days: 14 }).toISODate(); // inclusive
  const trendEnd = yesterday; // inclusive

  try {
    const { data: items } = await supabase
      .from("items")
      .select("plaid_item_id")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (!items || items.length === 0) {
      return NextResponse.json({ total: 0, count: 0, date: yesterday });
    }

    const itemIds = items.map((i) => i.plaid_item_id);

    // Positive-amount transactions (outflows) across the trend window — same
    // definition of "spend" used by the app's SMS reports.
    const { data: rangeTxns } = await supabase
      .from("transactions")
      .select("amount, date, merchant_name, name, ai_category_tag, ai_merchant_name")
      .in("plaid_item_id", itemIds)
      .gte("date", trendStart!)
      .lte("date", trendEnd!)
      .gt("amount", 0);

    // Bucket by date.
    const byDate = new Map<string, number>();
    for (const t of rangeTxns || []) {
      const d = String(t.date);
      byDate.set(d, (byDate.get(d) ?? 0) + Number(t.amount));
    }

    const days: { date: string; total: number }[] = [];
    let thisWeek = 0;
    let lastWeek = 0;
    for (let i = 7; i >= 1; i--) {
      const d = today.minus({ days: i }).toISODate()!;
      const amt = byDate.get(d) ?? 0;
      days.push({ date: d, total: amt });
      thisWeek += amt;
    }
    for (let i = 14; i >= 8; i--) {
      const d = today.minus({ days: i }).toISODate()!;
      lastWeek += byDate.get(d) ?? 0;
    }
    const changePct =
      lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

    // Yesterday detail (subset of the range already fetched).
    const yTxns = (rangeTxns || [])
      .filter((t) => String(t.date) === yesterday)
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const total = yTxns.reduce((sum, t) => sum + Number(t.amount), 0);
    const top = yTxns.slice(0, 3).map((t) => ({
      name: t.merchant_name || t.name || "Purchase",
      amount: Number(t.amount),
    }));

    // Upcoming bills from tagged_merchants (the app's recurring-expense
    // predictions) for the next 31 days. Active expense predictions only.
    const billsEnd = today.plus({ days: 31 }).toISODate();
    const { data: billRows } = await supabase
      .from("tagged_merchants")
      .select("merchant_name, expected_amount, next_predicted_date")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("type", "expense")
      .gte("next_predicted_date", today.toISODate()!)
      .lte("next_predicted_date", billsEnd!)
      .order("next_predicted_date", { ascending: true });

    const billItems = (billRows || []).map((b) => ({
      name: b.merchant_name || "Bill",
      amount: Number(b.expected_amount || 0),
      date: b.next_predicted_date as string,
    }));
    const billsTotal = billItems.reduce((s, b) => s + b.amount, 0);

    // This-week breakdown: last 7 days (today-7 .. yesterday) from the range
    // we already fetched, by category and vendor.
    const weekStart = today.minus({ days: 7 }).toISODate()!;
    const weekTxns = (rangeTxns || []).filter(
      (t) => String(t.date) >= weekStart && String(t.date) <= yesterday!
    );
    const weekBreakdown = buildBreakdown(weekTxns as TxnRow[]);

    // Month-to-date breakdown by category and vendor.
    const monthStart = today.startOf("month").toISODate();
    const { data: monthTxns } = await supabase
      .from("transactions")
      .select("amount, ai_category_tag, ai_merchant_name, merchant_name, name")
      .in("plaid_item_id", itemIds)
      .gte("date", monthStart!)
      .lte("date", today.toISODate()!)
      .gt("amount", 0);
    const monthBreakdown = buildBreakdown((monthTxns || []) as TxnRow[]);

    return NextResponse.json({
      total,
      count: yTxns.length,
      date: yesterday,
      top,
      trend: { days, thisWeek, lastWeek, changePct },
      bills: { items: billItems.slice(0, 5), total: billsTotal, count: billItems.length },
      // `breakdown` kept for backward compatibility (month-to-date).
      breakdown: {
        period: today.toFormat("LLLL"),
        total: monthBreakdown.total,
        categories: monthBreakdown.categories,
        vendors: monthBreakdown.vendors,
      },
      week: { label: "This week", ...weekBreakdown },
      month: { label: today.toFormat("LLLL"), ...monthBreakdown },
    });
  } catch {
    return NextResponse.json({ error: "Failed to load spend" }, { status: 500 });
  }
}
