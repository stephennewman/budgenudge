import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { getSuperAdminId } from "@/utils/auth/superadmin";
import { createSupabaseClient } from "@/utils/supabase/server";

// Month-to-date pacing vs the user's own baseline, for the mirror's Money
// channel. Same math as /protected/pacing: a 365-day trailing baseline ending
// at the last day of the previous month learns the usual daily spend per
// category/vendor (the current month is excluded so this month's spending
// can't inflate its own target), recurring bills are excluded, and the
// expected month-to-date amount is dailyAvg * daysElapsed.
//
// AUTH: mirrors /api/mirror/spend — a logged-in session gets their own data,
// or a trusted device passes MIRROR_TOKEN for the configured finance user.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Money-movement exclusions, matching /api/mirror/spend — transfers and
// P2P shuffling aren't "spending" and would pollute the pacing rows.
const EXCLUDED_CATEGORIES = new Set([
  "transfer",
  "payment",
  "credit card payment",
  "credit card bill",
]);
const TRANSFER_MERCHANTS = ["venmo", "zelle", "cash app", "paypal", "apple cash"];

const BASELINE_DAYS = 365;
const MIN_BASELINE_DAYS = 28;
const MIN_VENDOR_BASELINE_TX = 3;

export type PaceRow = {
  name: string;
  avgMonthly: number; // usual spend per 30 days
  actual: number; // month-to-date
  expected: number; // where the baseline says month-to-date should be
  pct: number | null; // % over/under expected (null when base too small)
  // Bills only: the typical day-of-month window when this bill hits, and the
  // day it was paid in the viewed month (null if not yet paid).
  dayMin?: number;
  dayMax?: number;
  paidDay?: number | null;
};

const PCT_FLOOR = 12;

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

  const tz = searchParams.get("tz") || "America/New_York";
  const today = DateTime.now().setZone(tz).startOf("day");

  // Optional month=YYYY-MM to review a past month; defaults to the current
  // month. Past months show the full month's actual vs. the full expected.
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
  // Baseline ends before the viewed month starts so that month's spending
  // can't inflate its own expected pace.
  const baselineEnd = monthStart.minus({ days: 1 });
  const daysElapsedMonth = isCurrentMonth ? today.day : monthStart.daysInMonth!;
  const windowStart = baselineEnd.minus({ days: BASELINE_DAYS - 1 });

  try {
    const { data: items } = await supabase
      .from("items")
      .select("plaid_item_id")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (!items || items.length === 0) {
      return NextResponse.json({ categories: [], vendors: [], bills: [] });
    }
    const itemIds = items.map((i) => i.plaid_item_id);

    // Tagged recurring bills are split into their own group so the category
    // and vendor pacing reflect controllable spend only.
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

    // Paginate: the window spans ~13 months and Supabase caps a single query
    // at 1000 rows — an unpaged fetch silently drops an arbitrary subset.
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
        .lte("date", monthEnd.toISODate()!)
        .order("date", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      txns.push(...(page as TxnRow[]));
      if (page.length < PAGE) break;
    }

    type Agg = {
      baseline: number;
      baselineTx: number;
      month: number;
      // Distinct YYYY-MM months with baseline activity — bills average over
      // months present rather than the whole year, so a bill that started (or
      // switched servicers) mid-window still shows its true monthly amount.
      baselineMonths: Set<string>;
      // Day-of-month of each baseline payment (bills: typical due-day window).
      payDays: number[];
      // First day this bill was paid in the viewed month, if it was.
      paidDay: number | null;
    };
    const cats = new Map<string, Agg>();
    const vens = new Map<string, Agg>();
    const bills = new Map<string, Agg>();
    let earliest: string | null = null;

    for (const t of txns) {
      const rawMerchant = (t.merchant_name || t.name || "").trim();
      if (!rawMerchant) continue;

      const cat = (t.ai_category_tag || "").trim().toLowerCase();
      const venLower = (t.ai_merchant_name || rawMerchant).toLowerCase();

      const amt = Math.max(0, Number(t.amount) || 0);
      const date = String(t.date);
      const isBaseline = date <= baselineEnd.toISODate()!;
      const isMonth =
        date >= monthStart.toISODate()! && date <= monthEnd.toISODate()!;

      const bump = (map: Map<string, Agg>, key: string) => {
        const agg =
          map.get(key) ?? {
            baseline: 0,
            baselineTx: 0,
            month: 0,
            baselineMonths: new Set<string>(),
            payDays: [],
            paidDay: null,
          };
        const dayOfMonth = Number(date.slice(8, 10));
        if (isBaseline) {
          agg.baseline += amt;
          agg.baselineTx += 1;
          agg.baselineMonths.add(date.slice(0, 7));
          agg.payDays.push(dayOfMonth);
        }
        if (isMonth) {
          agg.month += amt;
          if (agg.paidDay === null || dayOfMonth < agg.paidDay) {
            agg.paidDay = dayOfMonth;
          }
        }
        map.set(key, agg);
      };

      // Tagged recurring bills get their own pacing group so categories and
      // vendors keep reflecting controllable spend only. Bills can be tagged
      // by raw merchant name or by AI vendor name, so match on either. This
      // check runs BEFORE the money-movement exclusions: bills like a mortgage
      // are often AI-categorized as "payment" and would otherwise be dropped.
      if (billSet.has(rawMerchant.toLowerCase()) || billSet.has(venLower)) {
        if (isBaseline && (!earliest || date < earliest)) earliest = date;
        bump(bills, t.ai_merchant_name || rawMerchant);
        continue;
      }

      if (
        EXCLUDED_CATEGORIES.has(cat) ||
        TRANSFER_MERCHANTS.some((m) => venLower.includes(m))
      ) {
        continue;
      }
      if (isBaseline && (!earliest || date < earliest)) earliest = date;

      if (t.ai_category_tag) bump(cats, t.ai_category_tag);
      bump(vens, t.ai_merchant_name || t.merchant_name || t.name || "Unknown");
    }

    const baselineDays = earliest
      ? Math.max(
          1,
          Math.min(
            BASELINE_DAYS,
            Math.round(
              baselineEnd.diff(DateTime.fromISO(earliest, { zone: tz }), "days").days
            ) + 1
          )
        )
      : 0;
    if (baselineDays < MIN_BASELINE_DAYS) {
      return NextResponse.json({ categories: [], vendors: [], bills: [] });
    }

    const daysInMonth = monthStart.daysInMonth!;
    // Vendors must recur roughly monthly to be worth pacing — one-off
    // purchases aren't a "pace". Bills keep the lower floor since a monthly
    // bill only hits ~12 times a year anyway.
    const vendorMinTx = Math.max(
      MIN_VENDOR_BASELINE_TX,
      Math.round(baselineDays / 30)
    );
    const buildRows = (
      map: Map<string, Agg>,
      minTx: number,
      perActiveMonth = false
    ): PaceRow[] =>
      [...map.entries()]
        .filter(([, a]) => a.baselineTx >= minTx && a.baseline > 0)
        .map(([name, a]) => {
          const dailyAvg = a.baseline / baselineDays;
          // Average calendar month (365/12 days), so avgMonthly matches what
          // "a month" of this spend actually looks like. Bills instead average
          // over the months they actually occurred, so a bill that started or
          // switched servicers mid-window isn't diluted by empty months.
          const avgMonthly = perActiveMonth
            ? a.baseline / Math.max(1, a.baselineMonths.size)
            : dailyAvg * (365 / 12);
          // Pacing goal: % of the month elapsed × usual monthly spend.
          const expected = avgMonthly * (daysElapsedMonth / daysInMonth);
          const row: PaceRow = {
            name,
            avgMonthly: Math.round(avgMonthly),
            actual: Math.round(a.month),
            expected: Math.round(expected),
            pct:
              expected >= PCT_FLOOR
                ? Math.round((a.month / expected - 1) * 100)
                : null,
          };
          if (perActiveMonth && a.payDays.length > 0) {
            // Typical due-day window. With enough history, trim the single
            // earliest/latest day so one odd payment doesn't stretch the range.
            const sorted = [...a.payDays].sort((x, y) => x - y);
            const trimmed =
              sorted.length >= 8 ? sorted.slice(1, sorted.length - 1) : sorted;
            row.dayMin = trimmed[0];
            row.dayMax = trimmed[trimmed.length - 1];
            row.paidDay = a.paidDay;
          }
          return row;
        })
        .sort((a, b) => b.avgMonthly - a.avgMonthly);

    return NextResponse.json({
      month: monthStart.toFormat("LLLL"),
      monthKey: monthStart.toFormat("yyyy-LL"),
      isCurrentMonth,
      dayOfMonth: daysElapsedMonth,
      categories: buildRows(cats, 1),
      vendors: buildRows(vens, vendorMinTx),
      bills: buildRows(bills, MIN_VENDOR_BASELINE_TX, true),
    });
  } catch {
    return NextResponse.json({ error: "Failed to load pacing" }, { status: 500 });
  }
}
