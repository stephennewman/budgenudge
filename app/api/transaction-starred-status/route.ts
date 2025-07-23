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
    
    let transactionLinks = new Map<string, number>(); // transaction_id -> tagged_merchant_id
    
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

    // Get the actual transactions to check merchant names
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, plaid_transaction_id, merchant_name, name')
      .in('plaid_transaction_id', transaction_ids);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Create lookup for regular (non-split) merchants
    const regularMerchants = new Set(
      (taggedMerchants?.filter(m => !m.account_identifier) || [])
        .map(m => m.merchant_name.toLowerCase())
    );

    // Determine starred status for each transaction
    const starredStatus = new Map<string, boolean>();
    
    transactions?.forEach(tx => {
      const transactionId = tx.plaid_transaction_id;
      const merchantName = (tx.merchant_name || tx.name || '').toLowerCase();
      
      // Check if transaction is linked to a split account
      if (transactionLinks.has(transactionId)) {
        starredStatus.set(transactionId, true);
      }
      // Check if transaction matches a regular (non-split) merchant
      else if (regularMerchants.has(merchantName)) {
        starredStatus.set(transactionId, true);
      }
      else {
        starredStatus.set(transactionId, false);
      }
    });

    return NextResponse.json({
      success: true,
      starred_status: Object.fromEntries(starredStatus)
    });

  } catch (error) {
    console.error('Transaction starred status error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 