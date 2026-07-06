import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadLatestDeals, dealsAreStale } from "@/utils/deals/load";
import { DEAL_CATEGORIES, type DealCategory } from "@/utils/deals/categorize";

/** Extract the dollar amount from price text like "Save Up To $6.19". */
function savingsAmount(priceText: string | null): number {
  const m = priceText?.match(/\$(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// This week's Publix BOGO list for the mirror's "BOGO Deals" channel.
// Read-only view of the weekly deals the publix-deals cron already ingests.
// Dynamic (not cached) so shared stars show up on other mirrors' next refresh.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const latest = await loadLatestDeals(supabase);
    if (!latest || latest.deals.length === 0 || dealsAreStale(latest.weekEndsAt)) {
      return NextResponse.json({ weekLabel: null, deals: [] });
    }

    // Grouped by food type (AI-assigned at ingest, entrées first), sorted by
    // biggest savings within each group. Uncategorized rows fall to the end.
    const groupIndex = (c: string | null) => {
      const i = DEAL_CATEGORIES.indexOf((c ?? "") as DealCategory);
      return i === -1 ? DEAL_CATEGORIES.length : i;
    };
    const deals = latest.deals
      .map((d) => ({
        id: d.id,
        title: d.title,
        price: d.price_text,
        category: d.category ?? "Everything Else",
        starred: d.starred,
      }))
      .sort(
        (a, b) =>
          groupIndex(a.category) - groupIndex(b.category) ||
          savingsAmount(b.price) - savingsAmount(a.price)
      )
      .slice(0, 120);

    return NextResponse.json({ weekLabel: latest.weekLabel, deals });
  } catch {
    return NextResponse.json({ weekLabel: null, deals: [] });
  }
}
