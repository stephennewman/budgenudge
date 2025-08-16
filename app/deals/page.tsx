import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Deals | Krezzo",
  description: "Personalized deals and cashback opportunities tailored to your spending patterns.",
};

export default async function DealsPage() {
  const supabase = await createSupabaseClient();
  const { data: latestPosts } = await supabase
    .from('deal_posts')
    .select('id, url, title, published_at, created_at')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch deals for the newest post (if any)
  let deals: Array<{ id: number; title: string; price_text: string | null; promo_type: string | null }> = [];
  if (latestPosts && latestPosts.length > 0) {
    const newest = latestPosts[0];
    const { data } = await supabase
      .from('deals')
      .select('id, title, price_text, promo_type')
      .eq('post_id', newest.id)
      .ilike('promo_type', '%BOGO%')
      .limit(300);
    deals = (data as typeof deals) || [];
  }

  // Classify BOGO deals into traditional grocery categories
  const normalize = (s: string) => s.toLowerCase();
  const isAny = (s: string, terms: string[]) => terms.some(t => normalize(s).includes(t));

  const produceTerms = [
    'banana', 'apple', 'orange', 'berries', 'grapes', 'strawberry', 'blueberry', 'avocado', 'tomato', 'onion',
    'potato', 'lettuce', 'spinach', 'carrot', 'broccoli', 'pepper', 'cucumber', 'mushroom', 'herb', 'cilantro'
  ];
  const dairyTerms = [
    'milk', 'cheese', 'yogurt', 'butter', 'eggs', 'cream', 'sour cream', 'cottage cheese', 'string cheese',
    'cheddar', 'mozzarella', 'parmesan', 'oat milk', 'almond milk', 'plant-based', 'dairy-free'
  ];
  const meatTerms = [
    'chicken', 'beef', 'pork', 'turkey', 'ham', 'bacon', 'sausage', 'ground beef', 'steak', 'tenderloin',
    'deli meat', 'lunch meat', 'salami', 'prosciutto', 'kielbasa', 'hot dog', 'burger'
  ];
  const seafoodTerms = [
    'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'scallop', 'tilapia', 'cod', 'mahi',
    'shellfish', 'seafood', 'filet', 'fillet'
  ];
  const dryGoodsTerms = [
    'rice', 'pasta', 'flour', 'sugar', 'oil', 'olive oil', 'vinegar', 'spice', 'seasoning', 'sauce',
    'marinara', 'tomato sauce', 'beans', 'lentils', 'quinoa', 'oats', 'cereal', 'crackers', 'canned'
  ];
  const frozenTerms = [
    'frozen', 'ice cream', 'frozen vegetable', 'frozen fruit', 'frozen meal', 'pizza', 'waffles',
    'eggo', 'frozen dinner', 'popsicle', 'sorbet'
  ];
  const bakeryTerms = [
    'bread', 'bagel', 'muffin', 'croissant', 'roll', 'bun', 'tortilla', 'pita', 'naan',
    'cake', 'pie', 'pastry', 'donut', 'biscuit'
  ];
  const beverageTerms = [
    'soda', 'juice', 'coffee', 'tea', 'water', 'sports drink', 'energy drink', 'kombucha',
    'lemonade', 'smoothie', 'beer', 'wine', 'sparkling'
  ];
  const snackTerms = [
    'chips', 'crackers', 'pretzels', 'nuts', 'candy', 'chocolate', 'granola bar', 'cookies',
    'popcorn', 'trail mix', 'gum', 'mints'
  ];
  const deliTerms = [
    'deli', 'salad kit', 'sandwich', 'wrap', 'sushi', 'ready meal', 'prepared', 'rotisserie',
    'soup', 'salad bar', 'heat and eat'
  ];

  type GroceryCategory = 'Produce' | 'Dairy' | 'Meat' | 'Seafood' | 'Dry Goods' | 'Frozen Foods' | 'Bakery' | 'Beverages' | 'Snacks' | 'Deli' | 'Misc';
  const grouped: Record<GroceryCategory, typeof deals> = {
    'Produce': [],
    'Dairy': [],
    'Meat': [],
    'Seafood': [],
    'Dry Goods': [],
    'Frozen Foods': [],
    'Bakery': [],
    'Beverages': [],
    'Snacks': [],
    'Deli': [],
    'Misc': [],
  };

  for (const d of deals) {
    const t = d.title || '';
    if (isAny(t, produceTerms)) grouped.Produce.push(d);
    else if (isAny(t, dairyTerms)) grouped.Dairy.push(d);
    else if (isAny(t, meatTerms)) grouped.Meat.push(d);
    else if (isAny(t, seafoodTerms)) grouped.Seafood.push(d);
    else if (isAny(t, dryGoodsTerms)) grouped['Dry Goods'].push(d);
    else if (isAny(t, frozenTerms)) grouped['Frozen Foods'].push(d);
    else if (isAny(t, bakeryTerms)) grouped.Bakery.push(d);
    else if (isAny(t, beverageTerms)) grouped.Beverages.push(d);
    else if (isAny(t, snackTerms)) grouped.Snacks.push(d);
    else if (isAny(t, deliTerms)) grouped.Deli.push(d);
    else grouped.Misc.push(d);
  }



  return (
    <div className="min-h-[70vh] px-4 py-10 max-w-5xl mx-auto">
      <h1 className="text-4xl sm:text-5xl font-bold mb-6">Deals</h1>
      <p className="text-lg text-gray-600 mb-8">Latest Publix Weekly Ad deals we’ve ingested.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {latestPosts?.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="block border rounded-xl p-4 hover:border-blue-300 transition-colors">
            <div className="text-sm text-gray-500">Post</div>
            <div className="font-semibold">{p.title || p.url}</div>
            <div className="text-sm text-gray-500">{p.published_at ? new Date(p.published_at).toLocaleDateString() : ''}</div>
          </a>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-4">Newest Post BOGOs</h2>
      {deals.length === 0 ? (
        <div className="text-gray-600">No deals saved yet. Use the scraper preview then POST to /api/deals/save.</div>
      ) : (
        <div className="space-y-6">
          {(['Produce', 'Dairy', 'Meat', 'Seafood', 'Dry Goods', 'Frozen Foods', 'Bakery', 'Beverages', 'Snacks', 'Deli', 'Misc'] as GroceryCategory[]).map((section) => (
            grouped[section].length > 0 && (
              <div key={section}>
                <h3 className="text-xl font-semibold mb-2">{section}</h3>
                <ul className="space-y-2">
                  {grouped[section].map((d) => (
                    <li key={d.id} className="border rounded-lg p-3">
                      <div className="font-medium">{d.title}</div>
                      <div className="text-sm text-gray-600">{d.price_text || 'BOGO'}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))}
        </div>
      )}

      <div className="mt-10 flex gap-4">
        <Link href="/sign-up" className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 transition-colors">Get started free</Link>
        <Link href="/" className="inline-flex items-center px-6 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50">Learn more</Link>
      </div>
    </div>
  );
}


