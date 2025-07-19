import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { limit = 10 } = body;

    console.log(`🧪 Testing AI tagging for user ${user.id} with ${limit} transactions`);

    // Get user's item IDs
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Get some untagged transactions for testing
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, amount, category, subcategory, ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', itemIds)
      .is('ai_merchant_name', null)
      .order('date', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No untagged transactions found to test with',
        stats: { found: 0, processed: 0 }
      });
    }

    console.log(`🔍 Found ${transactions.length} untagged transactions to test`);

    // Call the AI tagging endpoint
    const transactionIds = transactions.map(t => t.id);
    
    const tagResponse = await fetch(`${request.url.replace('/test-ai-tagging', '/ai-tag-transactions')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || '', // Forward authentication
      },
      body: JSON.stringify({
        transaction_ids: transactionIds,
        batch_size: limit
      })
    });

    const tagResult = await tagResponse.json();

    if (!tagResponse.ok) {
      return NextResponse.json({ 
        error: 'AI tagging failed', 
        details: tagResult 
      }, { status: 500 });
    }

    // Fetch the updated transactions to show results
    const { data: updatedTransactions } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, amount, ai_merchant_name, ai_category_tag')
      .in('id', transactionIds)
      .order('date', { ascending: false });

    return NextResponse.json({
      success: true,
      message: 'AI tagging test completed successfully',
      stats: {
        found: transactions.length,
        processed: tagResult.processed || 0,
        api_calls: tagResult.api_calls || 0,
        cached: tagResult.cached || 0
      },
      sample_results: updatedTransactions?.slice(0, 5).map(tx => ({
        original_name: tx.name,
        original_merchant: tx.merchant_name,
        ai_merchant_name: tx.ai_merchant_name,
        ai_category_tag: tx.ai_category_tag,
        amount: tx.amount
      })) || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI tagging test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check AI tagging stats
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's item IDs
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (!items?.length) {
      return NextResponse.json({ 
        stats: { total: 0, tagged: 0, untagged: 0, percentage: 0 }
      });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Count tagged vs untagged transactions for this user
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('ai_merchant_name, ai_category_tag')
      .in('plaid_item_id', itemIds);

    if (!allTransactions) {
      return NextResponse.json({ error: 'Failed to fetch transaction stats' }, { status: 500 });
    }

    const total = allTransactions.length;
    const tagged = allTransactions.filter(t => t.ai_merchant_name && t.ai_category_tag).length;
    const untagged = total - tagged;
    const percentage = total > 0 ? Math.round((tagged / total) * 100) : 0;

    // Get a sample of untagged transactions
    const { data: untaggedSample } = await supabase
      .from('transactions')
      .select('id, name, merchant_name, amount')
      .in('plaid_item_id', itemIds)
      .is('ai_merchant_name', null)
      .order('date', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      stats: {
        total,
        tagged,
        untagged,
        percentage
      },
      untagged_sample: untaggedSample || []
    });

  } catch (error) {
    console.error('AI tagging stats error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 