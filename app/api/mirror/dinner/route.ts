import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadLatestDeals, dealsAreStale } from "@/utils/deals/load";
import { type DinnerPlan } from "@/utils/deals/dinner-engine";

// This week's dinner ideas from the Publix BOGO deals. Only READS the cached
// weekly plan (the weekly cron generates it) — the public dashboard never
// triggers an OpenAI generation.
export const revalidate = 3600;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const latest = await loadLatestDeals(supabase);
    if (!latest || latest.deals.length === 0 || dealsAreStale(latest.weekEndsAt)) {
      return NextResponse.json({ dinner: null });
    }

    const { data: cached } = await supabase
      .from("dinner_plans")
      .select("plan_json")
      .eq("post_id", latest.postId)
      .maybeSingle();

    if (!cached?.plan_json) {
      return NextResponse.json({ meals: [] });
    }

    const plan = cached.plan_json as DinnerPlan;
    return NextResponse.json({
      weekLabel: latest.weekLabel,
      meals: (plan.dinners ?? []).map((d) => ({
        title: d.title,
        cuisine: d.cuisine ?? null,
        bogoItems: d.bogoItems ?? [],
        estCost: d.estCost ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ meals: [] });
  }
}
