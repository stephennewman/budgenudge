import { SupabaseClient } from '@supabase/supabase-js';

export interface LatestDeals {
  postId: number;
  weekLabel: string;
  weekEndsAt: string | null; // latest ends_at (ISO date) across the deals
  deals: Array<{ id: number; title: string; price_text: string | null; ends_at: string | null }>;
}

/** Load the most recent weekly deal_post and its BOGO deals. */
export async function loadLatestDeals(client: SupabaseClient): Promise<LatestDeals | null> {
  const { data: post } = await client
    .from('deal_posts')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!post) return null;

  const { data } = await client
    .from('deals')
    .select('id, title, price_text, ends_at')
    .eq('post_id', post.id)
    .ilike('promo_type', '%BOGO%')
    .limit(300);

  const deals = (data as LatestDeals['deals']) || [];
  const titleMatch = (post.title as string | null)?.match(/\(([^)]+)\)/);
  const weekLabel = titleMatch?.[1] || 'this week';

  // Latest end date tells us whether this ad week is still current.
  const weekEndsAt =
    deals.reduce<string | null>((max, d) => (d.ends_at && (!max || d.ends_at > max) ? d.ends_at : max), null);

  return {
    postId: post.id as number,
    weekLabel,
    weekEndsAt,
    deals,
  };
}

/** True if the deals' ad window has already ended (today is past weekEndsAt, UTC). */
export function dealsAreStale(weekEndsAt: string | null, now = new Date()): boolean {
  if (!weekEndsAt) return false; // unknown window — don't block on it
  const today = now.toISOString().slice(0, 10);
  return weekEndsAt < today;
}
