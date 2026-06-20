import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseClient } from "@/utils/supabase/server";
import { loadLatestDeals } from "@/utils/deals/load";
import { getOrGenerateDinnerPlan, type DinnerPlan } from "@/utils/deals/dinner-engine";

export const metadata: Metadata = {
  title: "BOGO Dinner Plan | Krezzo",
  description: "AI dinner ideas built from this week's real Publix BOGO deals. Solve 'what's for dinner' for half price.",
};

// Generating the plan can take a few seconds on a cold week.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function BOGODinnerPlanPage() {
  const supabase = await createSupabaseClient();
  const latest = await loadLatestDeals(supabase);

  let plan: DinnerPlan | null = null;
  if (latest && latest.deals.length > 0) {
    try {
      plan = await getOrGenerateDinnerPlan({
        postId: latest.postId,
        deals: latest.deals,
        weekLabel: latest.weekLabel,
        readClient: supabase,
      });
    } catch (e) {
      console.error("Dinner plan generation failed:", e);
    }
  }

  return (
    <div className="min-h-[70vh] px-4 py-10 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">🍽️ BOGO Dinner Plan</h1>
        <p className="text-lg text-gray-600 mb-2">
          {plan ? `Dinner ideas built from this week's Publix BOGOs (${plan.weekOf})` : "Dinner ideas from this week's Publix BOGOs"}
        </p>
        <p className="text-sm text-gray-500">Every dinner leans on buy-one-get-one items, so you stock up at half price.</p>
      </div>

      {!plan || plan.dinners.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-800">
          No dinner ideas yet — this week&apos;s Publix BOGO deals haven&apos;t been loaded.
          <div className="mt-2 text-sm">Check back after the weekly ad refresh.</div>
        </div>
      ) : (
        <div className="space-y-6 mb-12">
          {plan.dinners.map((dinner, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
                <h2 className="text-xl font-semibold text-gray-900">{dinner.title}</h2>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{dinner.cuisine}</span>
              </div>

              <div className="mb-4">
                <div className="text-sm font-semibold text-green-700 mb-1">BOGO ingredients</div>
                <div className="flex flex-wrap gap-2">
                  {dinner.bogoItems.map((item, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-green-50 text-green-800 border border-green-200 px-3 py-1 text-sm">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {dinner.pantryItems?.length > 0 && (
                <div className="mb-4 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Pantry staples:</span> {dinner.pantryItems.join(", ")}
                </div>
              )}

              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-1">How to make it</div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700 text-sm">
                  {dinner.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm font-medium text-gray-900">💰 {dinner.estCost}</div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center space-y-4">
        <Link
          href="/protected/deals"
          className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold hover:from-green-700 hover:to-blue-700 transition-colors"
        >
          📋 View all this week&apos;s BOGO deals
        </Link>
      </div>
    </div>
  );
}
