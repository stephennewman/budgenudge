import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get URL parameters for filtering/sorting
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sortBy = url.searchParams.get('sortBy') || 'total_transactions'; // total_transactions, total_spending, avg_weekly_spending
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // Validate sortBy parameter
    const validSortFields = [
      'total_transactions', 
      'total_spending', 
      'avg_weekly_spending', 
      'avg_monthly_spending',
      'merchant_name',
      'last_transaction_date',
      'is_recurring'
    ];
    
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json({ error: 'Invalid sortBy parameter' }, { status: 400 });
    }

    // Get cached merchant analytics for this user
    const { data: merchantAnalytics, error: analyticsError } = await supabase
      .from('merchant_analytics')
      .select('*')
      .eq('user_id', user.id)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .limit(limit);

    if (analyticsError) throw analyticsError;

    // Summary stats are calculated below from the merchants array

    // Calculate overall averages
    const overallSummary = merchantAnalytics?.reduce((acc, merchant) => ({
      totalMerchants: acc.totalMerchants + 1,
      totalTransactions: acc.totalTransactions + merchant.total_transactions,
      totalSpending: acc.totalSpending + merchant.total_spending,
      totalSpendingTransactions: acc.totalSpendingTransactions + merchant.spending_transactions,
    }), {
      totalMerchants: 0,
      totalTransactions: 0,
      totalSpending: 0,
      totalSpendingTransactions: 0,
    }) || {
      totalMerchants: 0,
      totalTransactions: 0,
      totalSpending: 0,
      totalSpendingTransactions: 0,
    };

    // Calculate overall time range for weekly/monthly averages
    let overallWeeklySpending = 0;
    let overallMonthlySpending = 0;
    
    if (merchantAnalytics && merchantAnalytics.length > 0) {
      // Get overall date range
      const allDates = merchantAnalytics.flatMap(m => [
        m.first_transaction_date, 
        m.last_transaction_date
      ]).filter(Boolean);
      
      if (allDates.length > 0) {
        const earliestDate = new Date(Math.min(...allDates.map(d => new Date(d).getTime())));
        const latestDate = new Date(Math.max(...allDates.map(d => new Date(d).getTime())));
        const daysBetween = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));
        const weeksOfData = Math.max(1, daysBetween / 7);
        const monthsOfData = Math.max(1, daysBetween / 30.44);
        
        overallWeeklySpending = overallSummary.totalSpending / weeksOfData;
        overallMonthlySpending = overallSummary.totalSpending / monthsOfData;
      }
    }

    return NextResponse.json({ 
      merchants: merchantAnalytics || [],
      summary: {
        ...overallSummary,
        avgWeeklySpending: overallWeeklySpending,
        avgMonthlySpending: overallMonthlySpending,
        lastCalculated: merchantAnalytics?.[0]?.last_calculated_at || null
      }
    });
  } catch (error) {
    console.error('Error fetching merchant analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merchant analytics' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually refresh analytics
export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call the refresh function
    const { data: refreshResult, error: refreshError } = await supabase.rpc(
      'refresh_merchant_analytics', 
      { target_user_id: user.id }
    );

    if (refreshError) throw refreshError;

    return NextResponse.json({ 
      success: true,
      merchantsUpdated: refreshResult || 0,
      message: `Updated ${refreshResult || 0} merchant analytics records`
    });
  } catch (error) {
    console.error('Error refreshing merchant analytics:', error);
    return NextResponse.json(
      { error: 'Failed to refresh merchant analytics' },
      { status: 500 }
    );
  }
} 