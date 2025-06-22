import { NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { createSupabaseServerClient, storeTransactions } from '@/utils/plaid/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST() {
  try {
    const supabase = createSupabaseServerClient();
    
    console.log('🔄 STARTING HISTORICAL BACKFILL...');

    // Get all items for backfill
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_access_token, plaid_item_id');

    if (itemsError || !items || items.length === 0) {
      console.error('❌ No items found for backfill:', itemsError);
      return NextResponse.json(
        { error: 'No items found for backfill' },
        { status: 404, headers: corsHeaders }
      );
    }

    let totalBackfilled = 0;

    for (const item of items) {
      try {
        console.log(`📊 Backfilling item: ${item.plaid_item_id}`);
        
        // Calculate date range for missing data (30-90 days ago)
        const endDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
        
        // Fetch ALL historical transactions for the missing period (with pagination)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allTransactions: any[] = [];
        let offset = 0;
        const count = 500; // Maximum per request
        let hasMore = true;

        while (hasMore) {
          const response = await plaidClient.transactionsGet({
            access_token: item.plaid_access_token,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            options: {
              count: count,
              offset: offset
            }
          });

          allTransactions = allTransactions.concat(response.data.transactions);
          
          console.log(`📄 Fetched ${response.data.transactions.length} transactions (offset: ${offset}) for item ${item.plaid_item_id}`);
          
          // Check if we have more transactions to fetch
          hasMore = response.data.transactions.length === count;
          offset += count;
          
          // Safety check to prevent infinite loops
          if (offset > 10000) {
            console.log(`⚠️ Safety limit reached for item ${item.plaid_item_id}`);
            break;
          }
        }

        if (allTransactions.length > 0) {
          // Store all the historical transactions
          await storeTransactions(allTransactions, item.plaid_item_id);
          totalBackfilled += allTransactions.length;
          
          console.log(`✅ Backfilled ${allTransactions.length} total transactions for item ${item.plaid_item_id}`);
        } else {
          console.log(`ℹ️ No historical transactions found for item ${item.plaid_item_id}`);
        }

      } catch (error) {
        console.error(`❌ Error backfilling item ${item.plaid_item_id}:`, error);
        // Continue with other items even if one fails
      }
    }

    console.log(`🎉 BACKFILL COMPLETE: ${totalBackfilled} total transactions added`);

    return NextResponse.json({
      success: true,
      message: `Historical backfill completed`,
      totalBackfilled,
      dateRange: {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ BACKFILL ERROR:', error);
    return NextResponse.json(
      { error: 'Backfill process failed', details: error },
      { status: 500, headers: corsHeaders }
    );
  }
} 