import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { reconcileUserBills } from '@/utils/bills/reconcile';
import type { ReconciliationResult } from '@/utils/bills/reconcile';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const monthParam = request.nextUrl.searchParams.get('month'); // e.g. "2026-03"
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = !monthParam || monthParam === currentMonthKey;

    // Always fetch merchants + AI enrichment (shared across all tabs)
    const { data: allMerchants } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .order('confidence_score', { ascending: false });

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

    let timeline: ReconciliationResult;
    let monthLabel: string;

    if (isCurrentMonth) {
      try {
        timeline = await reconcileUserBills(user.id);
      } catch (err) {
        console.error('Reconciliation failed:', err);
        timeline = { paid: [], upcoming: [], overdue: [], totalPaid: 0, totalUpcoming: 0, totalOverdue: 0, reconciledCount: 0 };
      }
      monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      // Historical month — build from transactions
      const [yearStr, moStr] = monthParam!.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(moStr, 10) - 1;
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // Fetch user's plaid items
      const { data: userItems } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const itemIds = (userItems || []).map(i => i.plaid_item_id);

      // Fetch transactions for this month
      const { data: monthTxs } = await supabase
        .from('transactions')
        .select('id, date, amount, merchant_name, name, ai_merchant_name')
        .in('plaid_item_id', itemIds)
        .gt('amount', 0)
        .gte('date', monthStartStr)
        .lte('date', monthEndStr)
        .order('date', { ascending: true });

      const transactions = monthTxs || [];
      const activeMerchants = enrichedMerchants.filter(m => m.is_active);

      // Match transactions to known bills
      interface HistEntry {
        id: number;
        merchant_name: string;
        expected_amount: number;
        actual_amount: number;
        predicted_date: string;
        actual_date: string;
        status: 'paid';
        confidence_score: number;
        prediction_frequency: string;
        days_off: number;
        interval_days?: number;
      }

      const paid: HistEntry[] = [];
      const matchedTxIds = new Set<string>();

      for (const m of activeMerchants) {
        const needle = m.merchant_name.toLowerCase().trim();
        const needleWords = needle.split(/[\s\-_]+/).filter((w: string) => w.length > 2);

        for (const tx of transactions) {
          if (matchedTxIds.has(tx.id)) continue;

          const candidates = [
            tx.ai_merchant_name?.toLowerCase().trim(),
            tx.merchant_name?.toLowerCase().trim(),
            tx.name?.toLowerCase().trim()
          ].filter(Boolean) as string[];

          let matched = false;
          for (const c of candidates) {
            if (c.includes(needle) || needle.includes(c)) { matched = true; break; }
            if (needleWords.length >= 2) {
              const hits = needleWords.filter((w: string) => c.includes(w));
              if (hits.length >= Math.ceil(needleWords.length * 0.6)) { matched = true; break; }
            }
          }

          if (matched) {
            matchedTxIds.add(tx.id);
            paid.push({
              id: m.id,
              merchant_name: m.merchant_name,
              expected_amount: m.expected_amount,
              actual_amount: tx.amount,
              predicted_date: tx.date,
              actual_date: tx.date,
              status: 'paid',
              confidence_score: m.confidence_score,
              prediction_frequency: m.prediction_frequency,
              days_off: 0,
              interval_days: m.interval_days || undefined
            });
            break;
          }
        }
      }

      paid.sort((a, b) => a.actual_date.localeCompare(b.actual_date));

      timeline = {
        paid,
        upcoming: [],
        overdue: [],
        totalPaid: paid.reduce((s, e) => s + e.actual_amount, 0),
        totalUpcoming: 0,
        totalOverdue: 0,
        reconciledCount: 0
      };
    }

    return NextResponse.json({
      success: true,
      monthLabel,
      monthKey: isCurrentMonth ? currentMonthKey : monthParam,
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
