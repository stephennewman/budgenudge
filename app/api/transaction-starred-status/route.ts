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
    const { transaction_ids } = body;

    if (!transaction_ids || !Array.isArray(transaction_ids)) {
      return NextResponse.json({ error: 'transaction_ids array is required' }, { status: 400 });
    }

    // PERFORMANCE FIX: Limit to 500 transactions max to prevent timeouts
    const limitedTransactionIds = transaction_ids.slice(0, 500);

    // Get all active tagged merchants for this user
    const { data: taggedMerchants, error: merchantError } = await supabase
      .from('tagged_merchants')
      .select('id, merchant_name, account_identifier, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (merchantError) {
      console.error('Error fetching tagged merchants:', merchantError);
      return NextResponse.json({ error: 'Failed to fetch tagged merchants' }, { status: 500 });
    }

    // Get transaction links for split accounts
    const splitMerchants = taggedMerchants?.filter(m => m.account_identifier) || [];
    const splitMerchantIds = splitMerchants.map(m => m.id);
    
    const transactionLinks = new Map<string, number>(); // transaction_id -> tagged_merchant_id
    
    if (splitMerchantIds.length > 0) {
      const { data: links, error: linkError } = await supabase
        .from('tagged_merchant_transactions')
        .select('transaction_id, tagged_merchant_id')
        .in('tagged_merchant_id', splitMerchantIds)
        .eq('user_id', user.id);

      if (!linkError && links) {
        links.forEach(link => {
          transactionLinks.set(link.transaction_id, link.tagged_merchant_id);
        });
      }
    }

    // PERFORMANCE FIX: Get user's plaid_item_ids first to optimize filtering
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('Error fetching user items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch user items' }, { status: 500 });
    }

    const userItemIds = new Set(userItems?.map(item => item.plaid_item_id) || []);

    // PERFORMANCE FIX: Process transactions in batches to avoid database limits
    const batchSize = 100;
    const allTransactions = [];
    
    for (let i = 0; i < limitedTransactionIds.length; i += batchSize) {
      const batch = limitedTransactionIds.slice(i, i + batchSize);
      
      const { data: batchTransactions, error: txError } = await supabase
        .from('transactions')
        .select(`
          id, 
          plaid_transaction_id, 
          merchant_name, 
          name,
          plaid_item_id
        `)
        .in('plaid_transaction_id', batch);

      if (txError) {
        console.error('Error fetching transaction batch:', txError);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
      }

      if (batchTransactions) {
        allTransactions.push(...batchTransactions);
      }
    }

    // Filter transactions to only those belonging to this user's items
    const userTransactions = allTransactions.filter(tx => 
      userItemIds.has(tx.plaid_item_id)
    );

    // Create lookup for merchants belonging to this user
    const userMerchants = new Set(
      (taggedMerchants?.filter(m => userItemIds.has(m.account_identifier)) || [])
        .map(m => m.merchant_name.toLowerCase())
    );

    // Determine starred status for each transaction
    const starredStatus = new Map<string, boolean>();
    
    userTransactions.forEach(tx => {
      const transactionId = tx.plaid_transaction_id;
      const merchantName = (tx.merchant_name || tx.name || '').toLowerCase();
      
      // Check if transaction is linked to a split account
      if (transactionLinks.has(transactionId)) {
        starredStatus.set(transactionId, true);
      }
      // Check if transaction matches a user's starred merchant
      else if (userMerchants.has(merchantName)) {
        starredStatus.set(transactionId, true);
      }
      else {
        starredStatus.set(transactionId, false);
      }
    });

    // Set default false for any transaction IDs that weren't processed due to limit
    const skippedTransactionIds = transaction_ids.slice(500);
    skippedTransactionIds.forEach(txId => {
      if (!starredStatus.has(txId)) {
        starredStatus.set(txId, false);
      }
    });

    return NextResponse.json({
      success: true,
      starred_status: Object.fromEntries(starredStatus),
      processed_count: limitedTransactionIds.length,
      total_count: transaction_ids.length
    });

  } catch (error) {
    console.error('Transaction starred status error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 