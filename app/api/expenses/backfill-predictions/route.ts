import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileUserBills } from '@/utils/bills/reconcile';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-vercel-cron');
    if (!cronSecret && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: Backfill NULL merchant_pattern
    const { data: nullPatterns } = await supabase
      .from('tagged_merchants')
      .select('id, merchant_name')
      .is('merchant_pattern', null);

    let patternsFixed = 0;
    if (nullPatterns && nullPatterns.length > 0) {
      for (const row of nullPatterns) {
        await supabase
          .from('tagged_merchants')
          .update({ merchant_pattern: row.merchant_name.toLowerCase() })
          .eq('id', row.id);
        patternsFixed++;
      }
    }

    // Step 2: Trigger AI lifecycle scan to recompute interval stats
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    let scanResult = null;
    try {
      const scanResponse = await fetch(
        `${baseUrl}/api/expenses/ai-lifecycle-scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.CRON_SECRET}`
          },
          body: JSON.stringify({ scanAllUsers: true })
        }
      );
      scanResult = await scanResponse.json();
    } catch (err) {
      console.error('AI lifecycle scan failed during backfill:', err);
    }

    // Step 3: Get all users with active items
    const { data: activeUsers } = await supabase
      .from('items')
      .select('user_id')
      .is('deleted_at', null);

    const userIds = [...new Set((activeUsers || []).map(item => item.user_id))];

    // Step 4: Reconcile each user
    const results: { userId: string; reconciled: number; paid: number; upcoming: number }[] = [];
    const errors: string[] = [];

    for (const uid of userIds) {
      try {
        const result = await reconcileUserBills(uid);
        results.push({
          userId: uid,
          reconciled: result.reconciledCount,
          paid: result.paid.length,
          upcoming: result.upcoming.length
        });
      } catch (err) {
        errors.push(`${uid}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      patternsFixed,
      scanResult,
      usersProcessed: results.length,
      results,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
