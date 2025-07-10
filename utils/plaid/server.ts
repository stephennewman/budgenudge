import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for Plaid operations
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Database operations for Plaid data
export async function storeItem(userId: string, itemId: string, accessToken: string, institutionId: string) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('items')
    .insert({
      user_id: userId,
      plaid_item_id: itemId,
      plaid_access_token: accessToken,
      plaid_institution_id: institutionId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getItemByUserId(userId: string) {
  const supabase = createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function storeTransactions(transactions: any[], itemId: string) {
  const supabase = createSupabaseServerClient();
  
  const formattedTransactions = transactions.map(tx => ({
    plaid_transaction_id: tx.transaction_id,
    plaid_item_id: itemId,
    account_id: tx.account_id,
    amount: tx.amount,
    date: tx.date,
    name: tx.name,
    merchant_name: tx.merchant_name,
    category: tx.category,
    subcategory: tx.category?.[1] || null,
    transaction_type: tx.transaction_type,
    pending: tx.pending,
    account_owner: tx.account_owner,
  }));

  // Batch transactions to prevent database timeouts
  const BATCH_SIZE = 100;
  const allResults = [];
  
  console.log(`💾 Storing ${formattedTransactions.length} transactions in batches of ${BATCH_SIZE}`);
  
  for (let i = 0; i < formattedTransactions.length; i += BATCH_SIZE) {
    const batch = formattedTransactions.slice(i, i + BATCH_SIZE);
    console.log(`💾 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(formattedTransactions.length/BATCH_SIZE)}: ${batch.length} transactions`);
    
    const { data, error } = await supabase
      .from('transactions')
      .upsert(batch, { 
        onConflict: 'plaid_transaction_id' 
      })
      .select();

    if (error) {
      console.error(`❌ Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
      throw error;
    }
    
    if (data) {
      allResults.push(...data);
    }
  }
  
  console.log(`💾 ✅ Successfully stored ${allResults.length} transactions in ${Math.ceil(formattedTransactions.length/BATCH_SIZE)} batches`);
  return allResults;
} 