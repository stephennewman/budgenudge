import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseClient } from "@/utils/supabase/server";
import { generateBOGODinnerPlan } from "@/utils/bogo-dinner-plan";

export const metadata: Metadata = {
  title: "BOGO Dinner Plan | Krezzo",
  description: "7-day dinner plan using only Publix BOGO deals. Get 2 weeks of meals for the price of 1!",
};

export default async function BOGODinnerPlanPage() {
  const supabase = await createSupabaseClient();
  
  // Get the most recent post and its deals
  const { data: latestPost } = await supabase
    .from('deal_posts')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch BOGO deals
  let bogoDeals: Array<{ id: number; title: string; price_text: string | null; category: string }> = [];
  if (latestPost) {
    const { data } = await supabase
      .from('deals')
      .select('id, title, price_text')
      .eq('post_id', latestPost.id)
      .ilike('promo_type', '%BOGO%')
      .limit(300);
    
    // Add basic categorization (you could enhance this)
    bogoDeals = (data || []).map(deal => ({
      ...deal,
      category: 'misc' // Could be enhanced with your existing categorization logic
    }));
  }

  // Generate the dinner plan
  const dinnerPlan = generateBOGODinnerPlan(bogoDeals);

  return (
    <div className="min-h-[70vh] px-4 py-10 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">🍽️ BOGO Dinner Plan</h1>
        <p className="text-lg text-gray-600 mb-6">
          7 dinners using ONLY Publix BOGOs • Get 2 weeks of meals for the price of 1!
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-semibold">
            💡 Every ingredient is BOGO = You literally pay half price for everything!
          </p>
        </div>
      </div>

      {/* Main 7-Day Plan */}
      <div className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold text-center">Weekly Menu</h2>
        {dinnerPlan.mainMeals.map((meal, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{meal.emoji}</span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{meal.day}: {meal.theme}</h3>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              {meal.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-2 text-gray-700">
                  <span>{item.emoji}</span>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-green-600 font-semibold text-sm">(BOGO {item.price})</span>
                  {item.description && (
                    <span className="text-gray-500 text-sm italic">({item.description})</span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="bg-gray-50 rounded p-3">
              <p className="text-sm font-medium text-gray-900">
                💰 <strong>Total:</strong> Get {meal.totalItems} items, pay for {meal.items.length} = ${meal.totalCost} for 2 dinners
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bonus Meals */}
      <div className="space-y-6 mb-12">
        <h2 className="text-2xl font-bold text-center">🎁 Bonus Meals</h2>
        <p className="text-center text-gray-600 mb-6">
          Extra meal ideas using remaining BOGOs
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dinnerPlan.bonusMeals.map((meal, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{meal.emoji}</span>
                <h3 className="font-semibold text-gray-900">{meal.theme}</h3>
              </div>
              
              <div className="space-y-1 mb-3 text-sm">
                {meal.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center gap-1 text-gray-700">
                    <span className="text-xs">{item.emoji}</span>
                    <span>{item.name}</span>
                    <span className="text-green-600 text-xs">(BOGO {item.price})</span>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 rounded p-2 text-xs">
                <p className="font-medium text-gray-900">
                  💰 ${meal.totalCost} for 2 dinners
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-center mb-4">📊 Week Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">${dinnerPlan.summary.totalCost}</div>
            <div className="text-sm text-gray-600">Total Cost</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">${dinnerPlan.summary.totalValue}</div>
            <div className="text-sm text-gray-600">Actual Value</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">${dinnerPlan.summary.totalSavings}</div>
            <div className="text-sm text-gray-600">You Save</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">${dinnerPlan.summary.averagePerDinner}</div>
            <div className="text-sm text-gray-600">Per Dinner</div>
          </div>
        </div>
        
        <div className="text-center mt-6">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            🎯 Get {dinnerPlan.summary.totalDinners} complete dinners with 50% off every meal!
          </p>
          <p className="text-gray-600">
            Every single item is BOGO, so you literally get 2 weeks of dinners for the price of 1 week.
          </p>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center space-y-4">
        <Link 
          href="/deals" 
          className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold hover:from-green-700 hover:to-blue-700 transition-colors"
        >
          📋 View All BOGO Deals
        </Link>
        <p className="text-sm text-gray-500">
          See the complete list of this week&apos;s BOGOs to plan your shopping trip
        </p>
      </div>
    </div>
  );
}
