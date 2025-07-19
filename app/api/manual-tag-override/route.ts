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
    const { 
      merchant_pattern, 
      ai_merchant_name, 
      ai_category_tag,
      apply_to_existing = true 
    } = body;

    if (!merchant_pattern || !ai_merchant_name || !ai_category_tag) {
      return NextResponse.json({ 
        error: 'Missing required fields: merchant_pattern, ai_merchant_name, ai_category_tag' 
      }, { status: 400 });
    }

    console.log(`🏷️ Manual override: ${merchant_pattern} → ${ai_merchant_name} (${ai_category_tag})`);

    // Update or insert the manual override in cache
    const { error: upsertError } = await supabase
      .from('merchant_ai_tags')
      .upsert({
        merchant_pattern,
        ai_merchant_name,
        ai_category_tag,
        is_manual_override: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'merchant_pattern'
      });

    if (upsertError) {
      console.error('Failed to update merchant cache:', upsertError);
      return NextResponse.json({ error: 'Failed to update merchant cache' }, { status: 500 });
    }

    let updatedTransactionCount = 0;

    if (apply_to_existing) {
      // Get user's item IDs
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', user.id);

      if (itemsError || !items?.length) {
        return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
      }

      const itemIds = items.map(item => item.plaid_item_id);

      // Find all transactions with this merchant pattern
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('id')
        .in('plaid_item_id', itemIds)
        .or(`merchant_name.eq.${merchant_pattern},name.eq.${merchant_pattern}`);

      if (fetchError) {
        console.error('Failed to fetch transactions:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
      }

      if (transactions && transactions.length > 0) {
        // Update existing transactions in batches
        const transactionIds = transactions.map(tx => tx.id);
        const batchSize = 50;
        
        for (let i = 0; i < transactionIds.length; i += batchSize) {
          const batch = transactionIds.slice(i, i + batchSize);
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              ai_merchant_name,
              ai_category_tag
            })
            .in('id', batch);

          if (updateError) {
            console.error(`Failed to update transaction batch ${i + 1}-${i + batch.length}:`, updateError);
          } else {
            updatedTransactionCount += batch.length;
            console.log(`✅ Updated ${batch.length} transactions (batch ${i + 1}-${i + batch.length})`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Manual override applied: ${merchant_pattern} → ${ai_merchant_name} (${ai_category_tag})`,
      merchant_pattern,
      ai_merchant_name,
      ai_category_tag,
      updated_transactions: updatedTransactionCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual override error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 