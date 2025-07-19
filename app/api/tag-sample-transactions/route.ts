import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { tagMerchantWithAI } from '@/utils/ai/merchant-tagging';

export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🏷️ Tagging sample transactions for user ${user.id}`);

    // Get user's item IDs
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Get 5 recent untagged transactions for testing
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, amount, category, subcategory, ai_merchant_name')
      .in('plaid_item_id', itemIds)
      .is('ai_merchant_name', null)
      .order('date', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No untagged transactions found to test with',
        tagged: 0
      });
    }

    console.log(`🔍 Found ${transactions.length} untagged transactions to test`);

    const results = [];
    let taggedCount = 0;

    // Tag each transaction
    for (const transaction of transactions) {
      try {
        const input = {
          merchant_name: transaction.merchant_name,
          name: transaction.name,
          amount: transaction.amount,
          category: transaction.category,
          subcategory: transaction.subcategory
        };

        console.log(`🧠 Tagging: "${transaction.name}"`);
        const aiResult = await tagMerchantWithAI(input);

        // Update the transaction with AI tags
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            ai_merchant_name: aiResult.merchant_name,
            ai_category_tag: aiResult.category_tag
          })
          .eq('id', transaction.id);

        if (updateError) {
          console.error(`Failed to update transaction ${transaction.id}:`, updateError);
          results.push({
            transaction: transaction.name,
            error: 'Database update failed'
          });
        } else {
          taggedCount++;
          results.push({
            transaction: transaction.name,
            original_merchant: transaction.merchant_name || transaction.name,
            ai_merchant_name: aiResult.merchant_name,
            ai_category_tag: aiResult.category_tag
          });
          console.log(`✅ Tagged: "${transaction.name}" → "${aiResult.merchant_name}" (${aiResult.category_tag})`);
        }

        // Small delay to avoid overwhelming OpenAI
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to tag transaction ${transaction.id}:`, error);
        results.push({
          transaction: transaction.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully tagged ${taggedCount} transactions`,
      tagged: taggedCount,
      total_found: transactions.length,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sample tagging error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 