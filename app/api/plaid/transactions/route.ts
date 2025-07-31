import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper function to chunk arrays to avoid 414 Request-URI Too Large errors
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's items first
    const { data: items } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ transactions: [], accounts: [] });
    }

    const itemIds = items.map(item => item.plaid_item_id);
    const itemDbIds = items.map(item => item.id);

    // Phase 2: Try optimal stored function approach first, fallback to chunking
    let allTransactions: any[] = [];
    let allAccounts: any[] = [];

    try {
      // Phase 2: Use stored functions for optimal performance (single query)
      console.log(`🚀 Using stored functions for ${itemIds.length} items`);
      
      const [transactionResult, accountResult] = await Promise.all([
        supabase.rpc('get_user_transactions', { user_uuid: user.id }),
        supabase.rpc('get_user_accounts', { user_uuid: user.id })
      ]);

      if (transactionResult.error) throw transactionResult.error;
      if (accountResult.error) throw accountResult.error;

      allTransactions = transactionResult.data || [];
      allAccounts = accountResult.data || [];

      console.log(`✅ Stored function approach successful: ${allTransactions.length} transactions, ${allAccounts.length} accounts`);

    } catch (storedFuncError) {
      console.log(`⚠️ Stored function failed, falling back to chunking approach:`, storedFuncError);
      
      // Phase 1 Fallback: Chunk item IDs to avoid 414 Request-URI Too Large errors
      const CHUNK_SIZE = 5;

      // Process transactions in chunks
      if (itemIds.length > CHUNK_SIZE) {
        console.log(`📊 Processing ${itemIds.length} items in chunks of ${CHUNK_SIZE} to avoid 414 errors`);
        
        const itemIdChunks = chunkArray(itemIds, CHUNK_SIZE);
        const transactionPromises = itemIdChunks.map(chunk => 
          supabase
            .from('transactions')
            .select('*')
            .in('plaid_item_id', chunk)
            .order('date', { ascending: false })
        );

        const transactionResults = await Promise.all(transactionPromises);
        
        // Check for errors and combine results
        for (const result of transactionResults) {
          if (result.error) {
            console.error('Error in chunked transaction query:', result.error);
            throw result.error;
          }
          if (result.data) {
            allTransactions.push(...result.data);
          }
        }

        // Sort combined results by date (descending)
        allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } else {
        // Single query for small number of items
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .in('plaid_item_id', itemIds)
          .order('date', { ascending: false });

        if (txError) throw txError;
        allTransactions = transactions || [];
      }

      // Process accounts in chunks (same approach)
      if (itemDbIds.length > CHUNK_SIZE) {
        const itemDbIdChunks = chunkArray(itemDbIds, CHUNK_SIZE);
        const accountPromises = itemDbIdChunks.map(chunk => 
          supabase
            .from('accounts')
            .select('*')
            .in('item_id', chunk)
        );

        const accountResults = await Promise.all(accountPromises);
        
        for (const result of accountResults) {
          if (result.error) {
            console.error('Error in chunked account query:', result.error);
            throw result.error;
          }
          if (result.data) {
            allAccounts.push(...result.data);
          }
        }
      } else {
        // Single query for small number of items
        const { data: accounts, error: accError } = await supabase
          .from('accounts')
          .select('*')
          .in('item_id', itemDbIds);

        if (accError) throw accError;
        allAccounts = accounts || [];
      }

      console.log(`✅ Chunking fallback successful: ${allTransactions.length} transactions, ${allAccounts.length} accounts`);
    }

    console.log(`✅ Successfully fetched ${allTransactions.length} transactions and ${allAccounts.length} accounts`);

    return NextResponse.json({ 
      transactions: allTransactions, 
      accounts: allAccounts
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
} 