import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/utils/plaid/client';
import { createSupabaseServerClient, storeTransactions } from '@/utils/plaid/server';
import { createClient } from '@supabase/supabase-js';
import { tagMerchantWithAI, type MerchantTaggingInput } from '@/utils/ai/merchant-tagging';

// Set timeout to 60 seconds for Hobby plan (prevents 503 errors)
export const maxDuration = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// AI Tagging function for webhook-processed transactions
async function autoTagNewTransactions(newTransactions: Array<{
  id: string;
  merchant_name?: string;
  name: string;
  amount: number;
  category?: string[];
  subcategory?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
}>) {
  if (!newTransactions || newTransactions.length === 0) {
    return;
  }

  console.log(`🤖 Starting auto AI tagging for ${newTransactions.length} new transactions`);
  
  try {
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Filter for transactions that need AI tagging (don't have ai_merchant_name)
    const untaggedTransactions = newTransactions.filter(tx => !tx.ai_merchant_name);
    
    if (untaggedTransactions.length === 0) {
      console.log('🤖 ✅ All new transactions already have AI tags');
      return;
    }

    console.log(`🤖 Found ${untaggedTransactions.length} untagged transactions to process`);

    // Check cache for existing merchant patterns first
    const merchantPatterns = untaggedTransactions.map(tx => tx.merchant_name || tx.name);
    const { data: cachedTags } = await supabaseService
      .from('merchant_ai_tags')
      .select('merchant_pattern, ai_merchant_name, ai_category_tag')
      .in('merchant_pattern', merchantPatterns);

    const cacheMap = new Map(cachedTags?.map(tag => [tag.merchant_pattern, tag]) || []);

    // Group transactions by merchant for efficient processing
    const merchantGroups = new Map<string, typeof untaggedTransactions>();
    untaggedTransactions.forEach(tx => {
      const merchantKey = tx.merchant_name || tx.name || 'Unknown';
      if (!merchantGroups.has(merchantKey)) {
        merchantGroups.set(merchantKey, []);
      }
      merchantGroups.get(merchantKey)!.push(tx);
    });

    const updates: Array<{id: string, ai_merchant_name: string, ai_category_tag: string}> = [];
    const newMerchantTags: Array<{merchant_pattern: string, ai_merchant_name: string, ai_category_tag: string}> = [];
    let apiCallCount = 0;

    for (const [merchantPattern, merchantTransactions] of merchantGroups) {
      const cached = cacheMap.get(merchantPattern);
      
      if (cached) {
        // Use cached tags
        console.log(`🤖💾 Using cached tags for ${merchantPattern}: ${cached.ai_merchant_name} (${cached.ai_category_tag})`);
        merchantTransactions.forEach(tx => {
          updates.push({
            id: tx.id,
            ai_merchant_name: cached.ai_merchant_name,
            ai_category_tag: cached.ai_category_tag
          });
        });
      } else {
        // Need to call AI for new merchant
        const sampleTransaction = merchantTransactions[0];
        const input: MerchantTaggingInput = {
          merchant_name: sampleTransaction.merchant_name,
          name: sampleTransaction.name,
          amount: sampleTransaction.amount,
          category: sampleTransaction.category,
          subcategory: sampleTransaction.subcategory
        };

        try {
          const aiResult = await tagMerchantWithAI(input);
          
          // Cache the result for future use
          newMerchantTags.push({
            merchant_pattern: merchantPattern,
            ai_merchant_name: aiResult.merchant_name,
            ai_category_tag: aiResult.category_tag
          });

          // Apply to all transactions with this merchant
          merchantTransactions.forEach(tx => {
            updates.push({
              id: tx.id,
              ai_merchant_name: aiResult.merchant_name,
              ai_category_tag: aiResult.category_tag
            });
          });

          apiCallCount++;
          console.log(`🤖🧠 AI Tagged: ${merchantPattern} → ${aiResult.merchant_name} (${aiResult.category_tag})`);

          // Rate limiting for webhook context
          if (apiCallCount % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error(`🤖❌ Failed to tag merchant ${merchantPattern}:`, error);
          // Skip this merchant, don't block the entire process
        }
      }
    }

    // Cache new merchant tags
    if (newMerchantTags.length > 0) {
      const { error: cacheError } = await supabaseService
        .from('merchant_ai_tags')
        .insert(newMerchantTags);

      if (cacheError) {
        console.error('🤖⚠️ Warning: Failed to cache merchant tags:', cacheError);
      } else {
        console.log(`🤖💾 Cached ${newMerchantTags.length} new merchant patterns`);
      }
    }

    // Update transactions with AI tags
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabaseService
          .from('transactions')
          .update({
            ai_merchant_name: update.ai_merchant_name,
            ai_category_tag: update.ai_category_tag
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`🤖❌ Failed to update transaction ${update.id}:`, updateError);
        }
      }

      console.log(`🤖✅ Updated ${updates.length} transactions with AI tags`);
    }

    console.log(`🤖✅ Auto AI tagging completed: ${updates.length} transactions tagged, ${apiCallCount} API calls`);

  } catch (error) {
    console.error('🤖❌ Auto AI tagging failed:', error);
    // Don't throw - this should never break the webhook
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Use CORS headers
    
    const body = await request.json();
    
    console.log('🎯 WEBHOOK RECEIVED:', body);
    console.log(`🕐 WEBHOOK TIMESTAMP: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);

    // Verify webhook (you should implement proper verification in production)
    // const signature = request.headers.get('plaid-signature');
    // TODO: Verify webhook signature

    const { webhook_type, webhook_code, item_id } = body;

    // Handle different webhook types
    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionWebhook(webhook_code, item_id, body);
        break;
      
      case 'ITEM':
        await handleItemWebhook(webhook_code, item_id, body);
        break;
      
      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('❌ WEBHOOK ERROR:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleTransactionWebhook(webhook_code: string, item_id: string, body: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();
  
  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
      console.log(`🔄 Processing ${webhook_code} for item ${item_id}`);
      
      // Get access token for this item and verify it exists
      const { data: item } = await supabase
        .from('items')
        .select('plaid_access_token, plaid_item_id')
        .eq('plaid_item_id', item_id)
        .single();

      if (!item) {
        console.error(`❌ Item not found: ${item_id}`);
        return;
      }

      // Fetch new transactions
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.plaid_access_token,
          start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 90 days
          end_date: new Date().toISOString().split('T')[0],
        });

        // Store transactions in database using the verified database plaid_item_id
        const storedTransactions = await storeTransactions(response.data.transactions, item.plaid_item_id);
        
        // 🤖 Auto-tag new transactions with AI (background, non-blocking)
        if (storedTransactions && storedTransactions.length > 0) {
          autoTagNewTransactions(storedTransactions).catch(error => {
            console.warn('⚠️ Background AI tagging failed (non-critical):', error);
          });
          console.log(`🤖 Started background AI tagging for ${storedTransactions.length} new transactions`);
        }
        
        // Update account balances
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
            
            console.log(`💰 Updating balance for ${account.name}: Current=$${balance.current}, Available=$${balance.available}`);
            
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
          }
          console.log(`💰 ✅ Successfully updated balances for ${accountsResponse.data.accounts.length} accounts`);
        } catch (error) {
          console.error('❌ Error updating balances:', error);
        }
        
        console.log(`✅ WEBHOOK SUCCESS: Stored ${response.data.transactions.length} transactions for item ${item_id}`);
        
        // 📱 Simple transaction logging (SMS handled by scheduled jobs)
        if (response.data.transactions.length > 0) {
          console.log(`📱 NEW TRANSACTIONS DETECTED: ${response.data.transactions.length} transactions - SMS will be handled by 30min cron job`);
        } else {
          console.log(`📱 NO NEW TRANSACTIONS: Webhook fired but found ${response.data.transactions.length} new transactions`);
        }
      } catch (error) {
        console.error('❌ Error fetching transactions:', error);
      }
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      const { removed_transactions } = body;
      if (removed_transactions && Array.isArray(removed_transactions) && removed_transactions.length > 0) {
        await supabase
          .from('transactions')
          .delete()
          .in('plaid_transaction_id', removed_transactions);
        
        console.log(`🗑️ Removed ${removed_transactions.length} transactions`);
      }
      break;

    default:
      console.log(`Unhandled transaction webhook code: ${webhook_code}`);
  }
}



async function handleItemWebhook(webhook_code: string, item_id: string, body: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();

  switch (webhook_code) {
    case 'ERROR':
      console.error(`❌ Item error for ${item_id}:`, body.error);
      
      // Update item status
      await supabase
        .from('items')
        .update({ status: 'error' })
        .eq('plaid_item_id', item_id);
      break;

    case 'PENDING_EXPIRATION':
      console.log(`⚠️ Item ${item_id} has pending expiration`);
      
      // Update item status
      await supabase
        .from('items')
        .update({ status: 'pending_expiration' })
        .eq('plaid_item_id', item_id);
      break;

    default:
      console.log(`Unhandled item webhook code: ${webhook_code}`);
  }
} 