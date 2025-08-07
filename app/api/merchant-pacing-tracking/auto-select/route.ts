import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// POST - Auto-select top 5 high-activity merchants for a user
export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has merchant tracking set up
    const { data: existingTracking } = await supabase
      .from('merchant_pacing_tracking')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (existingTracking && existingTracking.length > 0) {
      return NextResponse.json({ 
        success: false,
        message: 'User already has merchant tracking configured',
        auto_selected: []
      });
    }

    // Get user's items to filter transactions
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    const itemIds = items?.map(item => item.plaid_item_id) || [];
    if (itemIds.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'No connected accounts found',
        auto_selected: []
      });
    }

    // Get spending transactions with AI merchant names
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('ai_merchant_name, amount, date')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null)
      .gte('amount', 0) // Only spending transactions
      .order('date', { ascending: false });

    if (transactionsError || !transactions || transactions.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'No AI-tagged transactions found for analysis',
        auto_selected: []
      });
    }

    // Calculate merchant activity metrics (similar to AI merchant analysis)
    const merchantMap = new Map<string, {
      totalSpending: number;
      transactionCount: number;
      transactionDates: string[];
    }>();

    transactions.forEach(transaction => {
      const merchant = transaction.ai_merchant_name;
      
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          totalSpending: 0,
          transactionCount: 0,
          transactionDates: []
        });
      }

      const merchantData = merchantMap.get(merchant)!;
      merchantData.totalSpending += transaction.amount;
      merchantData.transactionCount += 1;
      merchantData.transactionDates.push(transaction.date);
    });

    // Calculate metrics and rank merchants
    const merchantAnalysis = Array.from(merchantMap.entries()).map(([merchant, data]) => {
      const avgDailySpending = data.totalSpending / Math.max(1, data.transactionDates.length);
      const avgMonthlySpending = avgDailySpending * 30;
      
      // Calculate frequency (average days between transactions)
      const sortedDates = data.transactionDates.sort();
      let totalDaysBetween = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        const date1 = new Date(sortedDates[i-1] + 'T12:00:00');
        const date2 = new Date(sortedDates[i] + 'T12:00:00');
        const daysBetween = Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
        totalDaysBetween += daysBetween;
      }
      const frequencyDays = sortedDates.length > 1 ? totalDaysBetween / (sortedDates.length - 1) : 30;

      return {
        merchant,
        totalSpending: data.totalSpending,
        transactionCount: data.transactionCount,
        avgMonthlySpending,
        frequencyDays
      };
    })
    .filter(m => {
      // Exclude large monthly bills from pacing tracking (they're binary: paid vs not paid)
      const largeMonthlyBillKeywords = ['sentinel', 'rent', 'mortgage', 'insurance', 'prog select', 'usaa', 'geico', 'allstate', 'state farm', 'car payment', 'loan', 'housing'];
      const isLargeMonthlyBill = largeMonthlyBillKeywords.some(keyword => 
        m.merchant.toLowerCase().includes(keyword)
      ) && m.avgMonthlySpending >= 300; // Large amount threshold
      
      if (isLargeMonthlyBill) {
        return false; // Exclude from pacing tracking
      }
      
      return m.avgMonthlySpending >= 25 &&  // Minimum meaningful spending ($25+ avg monthly)
        m.transactionCount >= 5 &&     // ✅ FIX: Higher minimum for real activity (5+ transactions)
        m.frequencyDays <= 30 &&       // More frequent transactions (every 30 days or less)
        // Focus on genuinely active merchants with regular transaction patterns
        (m.transactionCount >= 8 || (m.transactionCount >= 5 && m.frequencyDays <= 15));
    })
    .sort((a, b) => {
      // ✅ FIX: Priority scoring based on TRANSACTION FREQUENCY (real activity)
      // Transaction count (70%) + frequency bonus (20%) + spending (10%)
      const frequencyBonusA = Math.max(0, 30 - a.frequencyDays); // Bonus for more frequent transactions
      const frequencyBonusB = Math.max(0, 30 - b.frequencyDays);
      
      const scoreA = (a.transactionCount * 70) + (frequencyBonusA * 20) + (a.avgMonthlySpending * 0.1);
      const scoreB = (b.transactionCount * 70) + (frequencyBonusB * 20) + (b.avgMonthlySpending * 0.1);
      return scoreB - scoreA;
    })
    .slice(0, 5); // Top 5

    if (merchantAnalysis.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'No qualifying merchants found for auto-selection (need $25+ monthly avg, 6-week frequency, 2+ transactions)',
        auto_selected: []
      });
    }

    // Insert auto-selected merchants
    const merchantsToInsert = merchantAnalysis.map(m => ({
      user_id: user.id,
      ai_merchant_name: m.merchant,
      is_active: true,
      auto_selected: true
    }));

    const { data: insertedMerchants, error: insertError } = await supabase
      .from('merchant_pacing_tracking')
      .insert(merchantsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting auto-selected merchants:', insertError);
      return NextResponse.json({ error: 'Failed to save auto-selected merchants' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Auto-selected ${merchantAnalysis.length} merchants for pacing tracking (top 5 by activity)`,
      auto_selected: insertedMerchants,
      merchant_analysis: merchantAnalysis.map(m => ({
        merchant: m.merchant,
        avg_monthly_spending: m.avgMonthlySpending,
        transaction_count: m.transactionCount,
        frequency_days: m.frequencyDays
      }))
    });

  } catch (error) {
    console.error('Auto-select merchants error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET - Check if auto-selection is needed for user
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has any merchant tracking
    const { data: existingTracking } = await supabase
      .from('merchant_pacing_tracking')
      .select('id, ai_merchant_name, auto_selected')
      .eq('user_id', user.id);

    const hasTracking = existingTracking && existingTracking.length > 0;
    const autoSelectedCount = existingTracking?.filter(t => t.auto_selected).length || 0;

    return NextResponse.json({
      success: true,
      needs_auto_selection: !hasTracking,
      has_tracking: hasTracking,
      total_tracked: existingTracking?.length || 0,
      auto_selected_count: autoSelectedCount
    });

  } catch (error) {
    console.error('Auto-select check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 