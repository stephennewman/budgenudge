import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchPublixBogos, getWeeklyAdUrl, type ParsedDeal } from '@/utils/deals/publix';

export const maxDuration = 90;

const STORE = 'Publix';

/** Most common valid window across deals → stable per-week identity. */
function deriveWeek(deals: ParsedDeal[]): { starts_at: string | null; ends_at: string | null } {
  const counts = new Map<string, { key: string; starts_at: string | null; ends_at: string | null; n: number }>();
  for (const d of deals) {
    if (!d.starts_at || !d.ends_at) continue;
    const key = `${d.starts_at}|${d.ends_at}`;
    const cur = counts.get(key) || { key, starts_at: d.starts_at, ends_at: d.ends_at, n: 0 };
    cur.n += 1;
    counts.set(key, cur);
  }
  let best: { starts_at: string | null; ends_at: string | null; n: number } | null = null;
  for (const v of counts.values()) if (!best || v.n > best.n) best = v;
  return best ? { starts_at: best.starts_at, ends_at: best.ends_at } : { starts_at: null, ends_at: null };
}

function fmtRange(starts_at: string | null, ends_at: string | null): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  };
  if (starts_at && ends_at) return `${fmt(starts_at)} - ${fmt(ends_at)}`;
  return 'current week';
}

export async function GET(request: NextRequest) {
  try {
    const isVercelCron = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get('dry') === '1';
    const baseUrl = getWeeklyAdUrl();

    const { deals } = await fetchPublixBogos();
    if (deals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No BOGO deals parsed (Publix layout may have changed)', url: baseUrl },
        { status: 502 }
      );
    }

    const week = deriveWeek(deals);
    const weekLabel = fmtRange(week.starts_at, week.ends_at);
    // Per-week identity so each weekly ad becomes its own deal_post.
    const postUrl = week.ends_at ? `${baseUrl}#${week.starts_at}_${week.ends_at}` : baseUrl;
    const postTitle = `Publix Weekly Ad BOGOs (${weekLabel})`;

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        url: baseUrl,
        week: weekLabel,
        parsed: deals.length,
        sample: deals.slice(0, 8),
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: postData, error: postErr } = await supabase
      .from('deal_posts')
      .upsert(
        { url: postUrl, title: postTitle, published_at: week.starts_at ?? new Date().toISOString() },
        { onConflict: 'url' }
      )
      .select('id')
      .single();

    if (postErr || !postData) {
      return NextResponse.json({ success: false, error: postErr?.message || 'post upsert failed' }, { status: 500 });
    }

    const postId = postData.id as number;
    const rows = deals.map((d) => ({
      post_id: postId,
      store: STORE,
      title: d.title,
      brand: null as string | null,
      size: null as string | null,
      promo_type: d.promo_type,
      // Coalesce to '' (not null): the deals unique constraint is (post_id, title,
      // price_text), and Postgres treats NULLs as distinct — so null prices would
      // duplicate on every daily re-run of the same week. '' keeps upserts idempotent.
      price_text: d.price_text ?? '',
      unit_price_cents: null as number | null,
      starts_at: d.starts_at,
      ends_at: d.ends_at,
    }));

    const { error: dealsErr } = await supabase
      .from('deals')
      .upsert(rows, { onConflict: 'post_id,title,price_text' });

    if (dealsErr) {
      return NextResponse.json({ success: false, error: dealsErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: baseUrl,
      week: weekLabel,
      post_id: postId,
      deals_upserted: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Publix deals cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
