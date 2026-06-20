import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadLatestDeals, dealsAreStale } from '@/utils/deals/load';
import { getOrGenerateDinnerPlan, pickTonightsDinner } from '@/utils/deals/dinner-engine';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

export const maxDuration = 60;

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://get.krezzo.com'
  );
}

export async function GET(request: NextRequest) {
  try {
    const isVercelCron = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // v1: send only to a configured test number (no hardcoded values).
    const toOverride = request.nextUrl.searchParams.get('to');
    const phone = toOverride || process.env.DINNER_SMS_TEST_PHONE;
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'No recipient. Set DINNER_SMS_TEST_PHONE or pass ?to=' },
        { status: 400 }
      );
    }

    const dryRun = request.nextUrl.searchParams.get('dry') === '1';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const latest = await loadLatestDeals(supabase);
    if (!latest || latest.deals.length === 0) {
      return NextResponse.json({ success: false, error: 'No BOGO deals loaded yet' }, { status: 404 });
    }

    // Freshness guard: if the newest deals' ad window has already ended, the daily
    // Publix refresh likely failed (e.g. layout change). Skip sending rather than
    // text an expired/old dinner. Surface it loudly so it can be noticed/fixed.
    if (dealsAreStale(latest.weekEndsAt)) {
      console.error(`[dinner-sms] Skipped: deals are stale (week ended ${latest.weekEndsAt}). Publix refresh may be broken.`);
      return NextResponse.json(
        { success: false, skipped: true, reason: 'stale_deals', weekEndsAt: latest.weekEndsAt },
        { status: 409 }
      );
    }

    const plan = await getOrGenerateDinnerPlan({
      postId: latest.postId,
      deals: latest.deals,
      weekLabel: latest.weekLabel,
      readClient: supabase,
    });

    const dinner = pickTonightsDinner(plan);
    if (!dinner) {
      return NextResponse.json({ success: false, error: 'No dinner idea available' }, { status: 404 });
    }

    const link = `${siteUrl()}/bogo-dinner-plan`;
    const blurb = dinner.sms?.trim() || `Tonight: ${dinner.title} — built on Publix BOGOs.`;
    let message = `🍽️ Tonight's dinner: ${dinner.title}\n${blurb}`;
    const tail = `\nMore ideas: ${link}`;
    if (message.length + tail.length <= 320) message += tail;

    if (dryRun) {
      return NextResponse.json({ success: true, dryRun: true, to: phone, message, dinner: dinner.title });
    }

    const result = await sendEnhancedSlickTextSMS({ phoneNumber: phone, message });

    return NextResponse.json({
      success: !!result.success,
      to: phone,
      dinner: dinner.title,
      message,
      provider_result: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dinner SMS cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
