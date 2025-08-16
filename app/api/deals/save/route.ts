import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type SaveBody = {
  url: string;
  title?: string;
  published_at?: string; // ISO
  lines: string[]; // raw deal lines
  store?: string; // default Publix
};

function parseLine(line: string) {
  const priceMatch = line.match(/\$\d+[\.,]?\d*/);
  const promo = /BOGO|B\.O\.G\.O|\b2\s+for\b/i.test(line)
    ? (line.match(/BOGO|B\.O\.G\.O|\b2\s+for\b/i)?.[0] || null)
    : null;
  return {
    title: line,
    brand: null as string | null,
    size: null as string | null,
    promo_type: promo,
    price_text: priceMatch ? priceMatch[0] : null,
    unit_price_cents: null as number | null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveBody;
    if (!body?.url || !Array.isArray(body?.lines)) {
      return NextResponse.json({ error: 'url and lines[] required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert post by URL
    const { data: postData, error: postErr } = await supabase
      .from('deal_posts')
      .upsert({ url: body.url, title: body.title ?? null, published_at: body.published_at ?? null }, { onConflict: 'url' })
      .select('id')
      .single();

    if (postErr || !postData) {
      return NextResponse.json({ error: postErr?.message || 'post upsert failed' }, { status: 500 });
    }

    const postId = postData.id as number;
    const rows = body.lines.map((ln) => ({ post_id: postId, store: body.store || 'Publix', ...parseLine(ln) }));

    // Insert ignoring duplicates by unique constraint (post_id, title, price_text)
    const { error: dealsErr } = await supabase.from('deals').upsert(rows, { onConflict: 'post_id,title,price_text' });
    if (dealsErr) {
      return NextResponse.json({ error: dealsErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, post_id: postId, inserted: rows.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



