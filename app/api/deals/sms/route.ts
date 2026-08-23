import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/brand';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

type Body = {
  cuisine?: string; // e.g., 'Italian'
  limit?: number;   // default 6
  send?: boolean;   // default false (preview)
  userId?: string;  // to resolve phone
  phoneNumber?: string; // optional override
};

const CUISINE_KEYWORDS: Record<string, string[]> = {
  'Italian': ['pasta', 'rummo', 'sauce', 'marinara', 'botticelli', 'pesto', 'meatball', 'mozzarella', 'parmesan', 'pizza', 'scampi'],
  'Mexican / Tex‑Mex': ['taco', 'tortilla', 'old el paso', 'pace', 'salsa', 'queso', 'burrito', 'enchilada'],
  'American Comfort': ['mac', 'macaroni', 'cheese', 'meatball', 'meatloaf', 'mashed', 'potato', 'potatoes', 'kielbasa', 'sausage', 'wings', 'pork tenderloin'],
  'Mediterranean / Middle‑Eastern': ['hummus', 'pita', 'tzatziki', 'olive', 'couscous', 'mezze'],
  'Asian‑Inspired': ['wonton', 'dumpling', 'ramen', 'stir-fry', 'stir fry', 'teriyaki', 'korean', 'soy', 'rice bowls'],
  'Seafood': ['shrimp', 'scallop', 'fish', 'salmon', 'tuna', 'crab', 'scampi'],
  'Vegetarian': ['mushroom', 'impossible', 'veggie', 'plant-based', 'salad kit', 'salad blends', 'hummus'],
  'BBQ / Grill‑Friendly': ['sausage', 'kielbasa', 'pork tenderloin', 'wings', 'burger', 'hot dog', 'grill'],
  'Breakfast‑for‑Dinner': ['eggo', 'waffle', 'pancake', 'sausage', 'bacon', 'yogurt', 'granola', 'eggs', 'cereal'],
  'Freezer‑to‑Table (Fast Nights)': ['frozen', 'skillet', 'bowls', 'meals', 'sandwich bros', 'pizza rolls'],
};

function matchesCuisine(title: string, cuisine: string): boolean {
  const terms = CUISINE_KEYWORDS[cuisine] || [];
  const t = title.toLowerCase();
  return terms.some(k => t.includes(k));
}

function cuisineEmoji(cuisine: string): string {
  switch (cuisine) {
    case 'Italian': return '🍝';
    case 'Mexican / Tex‑Mex': return '🌮';
    case 'American Comfort': return '🍽️';
    case 'Mediterranean / Middle‑Eastern': return '🥙';
    case 'Asian‑Inspired': return '🥡';
    case 'Seafood': return '🦐';
    case 'Vegetarian': return '🥦';
    case 'BBQ / Grill‑Friendly': return '🔥';
    case 'Breakfast‑for‑Dinner': return '🍳';
    case 'Freezer‑to‑Table (Fast Nights)': return '🧊';
    default: return '🛒';
  }
}

async function resolveUserPhone(supabase: SupabaseClient, userId?: string, provided?: string): Promise<string | null> {
  if (provided && provided.trim() !== '') return provided;
  if (!userId) return null;

  const { data: settings } = await supabase
    .from('user_sms_settings')
    .select('phone_number')
    .eq('user_id', userId)
    .single();
  if (settings?.phone_number) return settings.phone_number as string;

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const meta = authUser.user?.user_metadata as Record<string, unknown> | undefined;
  const signupPhone = (meta?.signupPhone as string | undefined) || (meta?.phone as string | undefined);
  return (authUser.user?.phone as string | undefined) || signupPhone || null;
}

export async function POST(req: NextRequest) {
  try {
    const { cuisine = 'Italian', limit = 6, send = false, userId, phoneNumber }: Body = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get latest post id
    const { data: latest } = await supabase
      .from('deal_posts')
      .select('id, url, title, published_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest?.id) {
      return NextResponse.json({ success: false, error: 'No deals found yet' }, { status: 404 });
    }

    // Fetch BOGO deals for latest post
    const { data: deals } = await supabase
      .from('deals')
      .select('id, title, price_text, promo_type')
      .eq('post_id', latest.id)
      .ilike('promo_type', '%BOGO%')
      .limit(400);

    const bogoDeals = (deals || []).filter(d => d.title && matchesCuisine(d.title, cuisine));
    const chosen = bogoDeals.slice(0, Math.max(1, Math.min(limit, 12)));

    // Build compact SMS
    const emoji = cuisineEmoji(cuisine);
    const header = `${emoji} ${cuisine} BOGOs at Publix`;
    const lines = chosen.map(d => `- ${d.title.replace(/\s+/g, ' ').trim()} — BOGO`);
    const url = `${SITE_URL}/protected/deals`;
    let message = `${header}\n` + lines.join('\n');
    const tail = `\nSee all: ${url}`;
    if (message.length + tail.length <= 300) message += tail;

    const preview = {
      success: true,
      cuisine,
      latest_post: latest,
      counts: { matched: bogoDeals.length, sent: chosen.length },
      message,
      send_attempted: false,
    };

    if (!send) return NextResponse.json(preview);

    const resolvedPhone = await resolveUserPhone(supabase, userId, phoneNumber);
    if (!resolvedPhone) return NextResponse.json({ ...preview, send_attempted: true, error: 'No phone number' }, { status: 400 });

    const sendResult = await sendEnhancedSlickTextSMS({ phoneNumber: resolvedPhone, message, userId });
    return NextResponse.json({ ...preview, send_attempted: true, sent: !!sendResult.success, provider: 'slicktext', provider_result: sendResult });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


