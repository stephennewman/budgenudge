import { NextResponse } from 'next/server';
import { storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

// Manual refresh endpoint - replicates webhook functionality
export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize clients
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const plaidClient = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments.sandbox,
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
          },
        },
      })
    );
    
    // Get authenticated user with token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔄 Manual transaction refresh requested by user: ${user.id}`);

    // Get all items for this user
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id, plaid_access_token, plaid_institution_id')
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('Error fetching user items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch user items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No bank accounts connected. Please connect a bank account first.',
        newTransactions: 0,
        accountsUpdated: 0 
      });
    }

    let totalNewTransactions = 0;
    let accountsUpdated = 0;
    const results = [];

    // Process each item
    for (const item of items) {
      try {
        console.log(`🏦 Processing item: ${item.plaid_item_id}`);

        // Fetch transactions for the last 90 days (same as webhook)
        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: item.plaid_access_token,
          start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        });

        // Store transactions in database (using verified database plaid_item_id)
        const storedTransactions = await storeTransactions(
          transactionsResponse.data.transactions, 
          item.plaid_item_id
        );

        totalNewTransactions += storedTransactions?.length || 0;

        // Update account balances (same as webhook)
        try {
          const accountsResponse = await plaidClient.accountsGet({
            access_token: item.plaid_access_token,
          });

          const supabaseService = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          for (const account of accountsResponse.data.accounts) {
            const balance = account.balances;
            
            await supabaseService
              .from('accounts')
              .update({
                current_balance: balance.current,
                available_balance: balance.available,
                iso_currency_code: balance.iso_currency_code || 'USD',
                balance_last_updated: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('plaid_account_id', account.account_id);

            accountsUpdated++;
          }
        } catch (balanceError) {
          console.error('Error updating balances for item:', item.plaid_item_id, balanceError);
        }

        results.push({
          item_id: item.plaid_item_id,
          institution_id: item.plaid_institution_id,
          transactions_fetched: transactionsResponse.data.transactions.length,
          new_transactions: storedTransactions?.length || 0,
          status: 'success'
        });

        console.log(`✅ Processed ${transactionsResponse.data.transactions.length} transactions for item ${item.plaid_item_id}`);

      } catch (itemError) {
        console.error(`❌ Error processing item ${item.plaid_item_id}:`, itemError);
        results.push({
          item_id: item.plaid_item_id,
          institution_id: item.plaid_institution_id,
          status: 'error',
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        });
      }
    }

    const message = totalNewTransactions > 0 
      ? `Successfully refreshed! Found ${totalNewTransactions} new/updated transactions across ${items.length} connected account(s).`
      : `Refresh complete! No new transactions found. Your data is up to date.`;

    console.log(`🎉 Manual refresh complete for user ${user.id}: ${totalNewTransactions} new transactions, ${accountsUpdated} accounts updated`);

    return NextResponse.json({
      success: true,
      message,
      newTransactions: totalNewTransactions,
      accountsUpdated,
      itemsProcessed: items.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual refresh error:', error);
    return NextResponse.json(
      { 
        error: 'Transaction refresh failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 