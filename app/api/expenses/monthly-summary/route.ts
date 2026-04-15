import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { reconcileUserBills } from '@/utils/bills/reconcile';
import type { ReconciliationResult } from '@/utils/bills/reconcile';

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reconcile first to ensure fresh data
    let timeline: ReconciliationResult;
    try {
      timeline = await reconcileUserBills(user.id);
    } catch (err) {
      console.error('Reconciliation failed, falling back to raw data:', err);
      timeline = { paid: [], upcoming: [], overdue: [], totalPaid: 0, totalUpcoming: 0, totalOverdue: 0, reconciledCount: 0 };
    }

    // Also fetch inactive merchants for the management UI
    const { data: allMerchants } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .order('confidence_score', { ascending: false });

    // Enrich with AI merchant names
    const merchants = allMerchants || [];
    let enrichedMerchants = merchants;

    if (merchants.length > 0) {
      const patterns = [...new Set(merchants.map(m => m.merchant_pattern).filter(Boolean))];
      if (patterns.length > 0) {
        const { data: aiData } = await supabase
          .from('merchant_ai_tags')
          .select('merchant_pattern, ai_merchant_name, ai_category_tag')
          .in('merchant_pattern', patterns);

        if (aiData) {
          const aiLookup = new Map(aiData.map(ai => [ai.merchant_pattern, ai]));
          enrichedMerchants = merchants.map(m => ({
            ...m,
            ai_merchant_name: aiLookup.get(m.merchant_pattern)?.ai_merchant_name || null,
            ai_category_tag: aiLookup.get(m.merchant_pattern)?.ai_category_tag || null
          }));
        }
      }
    }

    const inactiveMerchants = enrichedMerchants.filter(m => !m.is_active);

    // Build month label
    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return NextResponse.json({
      success: true,
      monthLabel,
      timeline,
      inactiveMerchants,
      allMerchants: enrichedMerchants
    });

  } catch (error) {
    console.error('Monthly summary error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
