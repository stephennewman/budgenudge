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
    
    console.log('🔄 STARTING GAP-FILL FOR MAY 24 - JUNE 7, 2025...');

    // Get all items for gap-fill
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_access_token, plaid_item_id');

    if (itemsError || !items || items.length === 0) {
      console.error('❌ No items found for gap-fill:', itemsError);
      return NextResponse.json(
        { error: 'No items found for gap-fill' },
        { status: 404, headers: corsHeaders }
      );
    }

    let totalGapFilled = 0;

    for (const item of items) {
      try {
        console.log(`📊 Gap-filling item: ${item.plaid_item_id}`);
        
        // Specific date range for the missing gap
        const startDate = new Date('2025-05-24'); // May 24, 2025
        const endDate = new Date('2025-06-07');   // June 7, 2025
        
        // Fetch ALL transactions for the gap period (with pagination)
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
          // Store all the gap transactions
          await storeTransactions(allTransactions, item.plaid_item_id);
          totalGapFilled += allTransactions.length;
          
          console.log(`✅ Gap-filled ${allTransactions.length} total transactions for item ${item.plaid_item_id}`);
        } else {
          console.log(`ℹ️ No gap transactions found for item ${item.plaid_item_id}`);
        }

      } catch (error) {
        console.error(`❌ Error gap-filling item ${item.plaid_item_id}:`, error);
        // Continue with other items even if one fails
      }
    }

    console.log(`🎉 GAP-FILL COMPLETE: ${totalGapFilled} total transactions added`);

    return NextResponse.json({
      success: true,
      message: `Gap-fill completed for May 24 - June 7, 2025`,
      totalGapFilled,
      dateRange: {
        start: '2025-05-24',
        end: '2025-06-07'
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ GAP-FILL ERROR:', error);
    return NextResponse.json(
      { error: 'Gap-fill process failed', details: error },
      { status: 500, headers: corsHeaders }
    );
  }
} 