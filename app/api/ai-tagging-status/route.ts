import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get overall AI tagging statistics
    const { data: allTransactions } = await supabaseService
      .from('transactions')
      .select('ai_merchant_name, ai_category_tag, date')
      .order('date', { ascending: false })
      .limit(1000); // Check last 1000 transactions

    if (!allTransactions) {
      return NextResponse.json({ error: 'Failed to fetch transaction stats' }, { status: 500 });
    }

    const total = allTransactions.length;
    const tagged = allTransactions.filter(t => t.ai_merchant_name && t.ai_category_tag).length;
    const untagged = total - tagged;
    const percentage = total > 0 ? Math.round((tagged / total) * 100) : 0;

    // Get recent untagged transactions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentUntagged } = await supabaseService
      .from('transactions')
      .select('id, name, merchant_name, amount, date')
      .is('ai_merchant_name', null)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(20);

    // Get cache statistics
    const { data: cacheStats } = await supabaseService
      .from('merchant_ai_tags')
      .select('merchant_pattern, ai_merchant_name, ai_category_tag, is_manual_override, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate daily tagging trends for last 7 days
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const { data: dayTransactions } = await supabaseService
        .from('transactions')
        .select('ai_merchant_name, ai_category_tag')
        .eq('date', dateStr);

      if (dayTransactions) {
        const dayTotal = dayTransactions.length;
        const dayTagged = dayTransactions.filter(t => t.ai_merchant_name && t.ai_category_tag).length;
        const dayPercentage = dayTotal > 0 ? Math.round((dayTagged / dayTotal) * 100) : 0;
        
        dailyStats.push({
          date: dateStr,
          total: dayTotal,
          tagged: dayTagged,
          percentage: dayPercentage
        });
      }
    }

    const status = {
      success: true,
      timestamp: new Date().toISOString(),
      overall_stats: {
        total_transactions_checked: total,
        tagged_transactions: tagged,
        untagged_transactions: untagged,
        tagging_percentage: percentage,
        health_status: percentage >= 90 ? 'EXCELLENT' : 
                      percentage >= 75 ? 'GOOD' : 
                      percentage >= 50 ? 'NEEDS_ATTENTION' : 'CRITICAL'
      },
      recent_untagged: {
        count: recentUntagged?.length || 0,
        sample: recentUntagged?.slice(0, 5).map(tx => ({
          name: tx.name,
          merchant: tx.merchant_name,
          amount: tx.amount,
          date: tx.date
        })) || []
      },
      cache_stats: {
        total_cached_merchants: cacheStats?.length || 0,
        manual_overrides: cacheStats?.filter(c => c.is_manual_override).length || 0,
        recent_additions: cacheStats?.slice(0, 5).map(c => ({
          pattern: c.merchant_pattern,
          merchant_name: c.ai_merchant_name,
          category: c.ai_category_tag,
          created: c.created_at
        })) || []
      },
      daily_trends: dailyStats,
      recommendations: generateRecommendations(percentage, recentUntagged?.length || 0)
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('AI tagging status check failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Status check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function generateRecommendations(percentage: number, recentUntaggedCount: number): string[] {
  const recommendations = [];

  if (percentage < 50) {
    recommendations.push('🚨 CRITICAL: AI tagging coverage is very low. Consider running bulk tagging process.');
  } else if (percentage < 75) {
    recommendations.push('⚠️ AI tagging coverage needs improvement. Consider increasing cron frequency.');
  } else if (percentage >= 90) {
    recommendations.push('✅ AI tagging system is performing excellently.');
  }

  if (recentUntaggedCount > 50) {
    recommendations.push('🔄 Large number of recent untagged transactions. Check if auto-tagging cron is running properly.');
  } else if (recentUntaggedCount > 20) {
    recommendations.push('📊 Moderate number of untagged transactions. Monitor auto-tagging process.');
  } else if (recentUntaggedCount === 0) {
    recommendations.push('🎯 All recent transactions are tagged. System is working perfectly.');
  }

  return recommendations;
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to check AI tagging status',
    available_endpoints: {
      status: 'GET /api/ai-tagging-status',
      test: 'POST /api/test-auto-ai-tag',
      manual_trigger: 'POST /api/auto-ai-tag-new (requires auth)'
    }
  });
} 