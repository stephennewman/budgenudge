import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, pattern, dates } = await request.json();
    
    if (!userId || !pattern) {
      return NextResponse.json({ 
        error: 'userId and pattern are required' 
      }, { status: 400 });
    }

    console.log(`🔍 Fetching transactions for income source: ${pattern}`);
    
    // Get user's connected accounts
    const { data: userItems } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', userId);
    
    if (!userItems?.length) {
      return NextResponse.json({ 
        error: 'No connected accounts found' 
      }, { status: 404 });
    }

    // Create a more sophisticated query based on the pattern and dates
    let query = supabase
      .from('transactions')
      .select('id, date, amount, name, merchant_name, account_id, plaid_transaction_id')
      .in('plaid_item_id', userItems.map(item => item.plaid_item_id))
      .lt('amount', 0); // Income transactions are negative

          // If we have specific dates from the pattern detection, use them for more precise matching
      if (dates && dates.length > 0) {
        // Get transactions around all the detected dates
        const startDate = Math.min(...dates.map((d: string) => new Date(d).getTime()));
        const endDate = Math.max(...dates.map((d: string) => new Date(d).getTime()));
        
        query = query
          .gte('date', new Date(startDate).toISOString().split('T')[0])
          .lte('date', new Date(endDate).toISOString().split('T')[0]);
    } else {
      // Fallback to last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      query = query.gte('date', sixMonthsAgo.toISOString().split('T')[0]);
    }

    const { data: allTransactions, error: transError } = await query
      .order('date', { ascending: false });

    if (transError) {
      throw transError;
    }

    // Filter transactions that match the normalized pattern
    const normalizedPattern = normalizeIncomeSourceName(pattern);
    const matchingTransactions = (allTransactions || []).filter((transaction) => {
      const normalizedName = normalizeIncomeSourceName(transaction.name);
      // Try exact match first, then fallback to "contains" match for flexibility
      return normalizedName === normalizedPattern || 
             normalizedName.includes(normalizedPattern) ||
             normalizedPattern.includes(normalizedName);
    });

    console.log(`Found ${matchingTransactions.length} transactions for pattern: ${pattern}`);

    return NextResponse.json({
      success: true,
      transactions: matchingTransactions.map((t) => ({
        id: t.plaid_transaction_id || t.id,
        date: t.date,
        amount: Math.abs(t.amount), // Convert to positive for display
        name: t.name,
        merchant_name: t.merchant_name,
        account_id: t.account_id
      })),
      pattern: normalizedPattern,
      originalPattern: pattern
    });

  } catch (error) {
    console.error('Error fetching income source transactions:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Copy the normalization function to ensure consistency
function normalizeIncomeSourceName(name: string): string {
  return name
    .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove dates
    .replace(/\d{6,}/g, '') // Remove long ID numbers (6+ digits)
    .replace(/\b(deposit|direct|transfer|ach|tran)\b/gi, '') // Remove generic terms but keep important identifiers
    .replace(/[~\-_]/g, ' ') // Replace separators with spaces
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .toLowerCase();
}
