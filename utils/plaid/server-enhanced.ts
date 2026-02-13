import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for Plaid operations
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ENHANCED: Minimal addition of 4 high-value fields
export async function storeTransactions(transactions: any[], itemId: string) {
  const supabase = createSupabaseServerClient();
  
  const formattedTransactions = transactions.map(tx => ({
    // ✅ EXISTING FIELDS (unchanged)
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
    
    // 🆕 NEW FIELDS (safe additions - all optional)
    logo_url: tx.logo_url || null,
    location_city: tx.location?.city || null,
    is_subscription: (tx.payment_meta?.reason === 'SUBSCRIPTION') || false,
    pfc_primary: tx.personal_finance_category?.primary || null,
  }));

  // Very conservative batching with delays to prevent database timeouts
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 100; // Small delay between batches
  const allResults = [];
  
  for (let i = 0; i < formattedTransactions.length; i += BATCH_SIZE) {
    const batch = formattedTransactions.slice(i, i + BATCH_SIZE);
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .upsert(batch, { 
          onConflict: 'plaid_transaction_id' 
        })
        .select();

      if (error) {
        console.error(`❌ Database Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        console.error(`❌ Error code: ${error.code}, Message: ${error.message}`);
        console.error(`❌ Error details:`, error.details);
        console.error(`❌ Sample transaction from failed batch:`, JSON.stringify(batch[0], null, 2));
        throw error;
      }
      
      if (data) {
        allResults.push(...data);
        
      }
    } catch (batchError) {
      console.error(`❌ Unexpected error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
      console.error(`❌ Batch size: ${batch.length}, Sample transaction:`, JSON.stringify(batch[0], null, 2));
      throw batchError;
    }
    
    // Add delay between batches to reduce database load
    if (i + BATCH_SIZE < formattedTransactions.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
  
  return allResults;
} 