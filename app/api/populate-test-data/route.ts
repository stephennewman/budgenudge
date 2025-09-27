import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();

    // Create test user
    const testUserId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        id: testUserId,
        email: 'test@example.com',
        created_at: new Date().toISOString()
      })
      .select();

    if (userError) {
      return NextResponse.json({ error: 'Failed to create user: ' + userError.message }, { status: 500 });
    }

    // Create test Plaid item (bank account connection)
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .upsert({
        id: 'test_item_1',
        user_id: testUserId,
        plaid_item_id: 'test_plaid_item_1',
        institution_name: 'Test Bank',
        status: 'good',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (itemError) {
      return NextResponse.json({ error: 'Failed to create item: ' + itemError.message }, { status: 500 });
    }

    // Create sample transactions for the last 90 days
    const transactions = [];
    const merchants = [
      { name: 'Publix', category: 'Groceries', baseAmount: 120, transactions: 15 },
      { name: 'Circle K', category: 'Gas', baseAmount: 45, transactions: 20 },
      { name: 'Starbucks', category: 'Coffee', baseAmount: 25, transactions: 12 },
      { name: 'Amazon', category: 'Shopping', baseAmount: 85, transactions: 6 },
      { name: 'Target', category: 'Shopping', baseAmount: 65, transactions: 8 },
      { name: 'Walmart', category: 'Groceries', baseAmount: 55, transactions: 5 },
      { name: 'Chick-fil-A', category: 'Restaurant', baseAmount: 35, transactions: 10 },
      { name: 'ExxonMobil', category: 'Gas', baseAmount: 50, transactions: 7 },
      { name: 'Netflix', category: 'Entertainment', baseAmount: 15.99, transactions: 3 },
      { name: 'Spotify', category: 'Entertainment', baseAmount: 9.99, transactions: 3 }
    ];

    const now = new Date();
    let transactionId = 1;

    merchants.forEach(merchant => {
      for (let i = 0; i < merchant.transactions; i++) {
        // Distribute transactions over the last 90 days
        const daysBack = Math.floor(Math.random() * 90);
        const transactionDate = new Date(now);
        transactionDate.setDate(now.getDate() - daysBack);

        // Add some variation to amounts (±20%)
        const variation = (Math.random() - 0.5) * 0.4; // -20% to +20%
        const amount = merchant.baseAmount * (1 + variation);

        transactions.push({
          id: transactionId++,
          plaid_item_id: 'test_item_1',
          plaid_transaction_id: `test_tx_${transactionId}`,
          name: merchant.name,
          merchant_name: merchant.name,
          amount: -Math.abs(amount), // Negative for expenses
          date: transactionDate.toISOString().split('T')[0],
          category: [merchant.category],
          ai_merchant_name: merchant.name,
          ai_category_tag: merchant.category,
          created_at: new Date().toISOString()
        });
      }
    });

    // Insert transactions in batches
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const { error: txError } = await supabase
        .from('transactions')
        .upsert(batch);

      if (txError) {
        return NextResponse.json({
          error: 'Failed to insert transactions: ' + txError.message,
          insertedCount
        }, { status: 500 });
      }

      insertedCount += batch.length;
    }

    // Get final counts
    const { count: finalUserCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: finalItemCount } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    const { count: finalTransactionCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: 'Test data populated successfully',
      data: {
        users: finalUserCount || 0,
        items: finalItemCount || 0,
        transactions: finalTransactionCount || 0,
        dateRange: {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: now.toISOString().split('T')[0]
        }
      },
      merchants: merchants.map(m => `${m.name} (${m.transactions} transactions)`)
    });

  } catch (error) {
    console.error('Populate test data error:', error);
    return NextResponse.json({
      error: 'Failed to populate test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
