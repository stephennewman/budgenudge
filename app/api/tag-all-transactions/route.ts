import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { tagMerchantWithAI } from '@/utils/ai/merchant-tagging';

interface TaggingResult {
  merchant: string;
  ai_merchant_name: string;
  ai_category_tag: string;
  transaction_count: number;
  was_cached: boolean;
}

interface TaggingError {
  merchant: string;
  error: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { max_transactions = 1000 } = body; // Increased default limit

    console.log(`🏷️ Starting bulk AI tagging for user ${user.id}`);

    // Get user's item IDs
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Get all untagged transactions (with reasonable limit)
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, amount, category, subcategory, ai_merchant_name')
      .in('plaid_item_id', itemIds)
      .is('ai_merchant_name', null)
      .order('date', { ascending: false })
      .limit(max_transactions);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No untagged transactions found',
        tagged: 0,
        total_found: 0
      });
    }

    console.log(`🔍 Found ${transactions.length} untagged transactions to process`);

    // Group transactions by merchant for efficient caching
    const merchantGroups = new Map<string, typeof transactions>();
    transactions.forEach(tx => {
      const merchantKey = tx.merchant_name || tx.name || 'Unknown';
      if (!merchantGroups.has(merchantKey)) {
        merchantGroups.set(merchantKey, []);
      }
      merchantGroups.get(merchantKey)!.push(tx);
    });

    console.log(`📊 Processing ${merchantGroups.size} unique merchants`);

    let processedCount = 0;
    let apiCallCount = 0;
    let cachedCount = 0;
    const results: TaggingResult[] = [];
    const errors: TaggingError[] = [];

    // Check existing cache
    const merchantPatterns = Array.from(merchantGroups.keys());
    const { data: cachedTags } = await supabase
      .from('merchant_ai_tags')
      .select('merchant_pattern, ai_merchant_name, ai_category_tag')
      .in('merchant_pattern', merchantPatterns);

    const cacheMap = new Map(cachedTags?.map(tag => [tag.merchant_pattern, tag]) || []);
    console.log(`💾 Found ${cachedTags?.length || 0} cached merchant patterns`);

    // Process merchants in smaller batches
    const merchantEntries = Array.from(merchantGroups.entries());
    
    for (let i = 0; i < merchantEntries.length; i++) {
      const [merchantPattern, merchantTransactions] = merchantEntries[i];
      const cached = cacheMap.get(merchantPattern);
      
      console.log(`🔄 Processing merchant ${i + 1}/${merchantEntries.length}: ${merchantPattern}`);

      let aiMerchantName: string;
      let aiCategoryTag: string;

      if (cached) {
        // Use cached result
        aiMerchantName = cached.ai_merchant_name;
        aiCategoryTag = cached.ai_category_tag;
        cachedCount += merchantTransactions.length;
        console.log(`💾 Using cached: ${merchantPattern} → ${aiMerchantName} (${aiCategoryTag})`);
      } else {
        // Call AI for new merchant
        try {
          const sampleTx = merchantTransactions[0];
          const input = {
            merchant_name: sampleTx.merchant_name,
            name: sampleTx.name,
            amount: sampleTx.amount,
            category: sampleTx.category,
            subcategory: sampleTx.subcategory
          };

          const aiResult = await tagMerchantWithAI(input);
          aiMerchantName = aiResult.merchant_name;
          aiCategoryTag = aiResult.category_tag;
          apiCallCount++;

          // Cache the result
          const { error: cacheError } = await supabase
            .from('merchant_ai_tags')
            .insert({
              merchant_pattern: merchantPattern,
              ai_merchant_name: aiMerchantName,
              ai_category_tag: aiCategoryTag
            });

          if (cacheError) {
            console.warn(`Failed to cache merchant pattern: ${cacheError.message}`);
          }

          console.log(`🧠 AI Tagged: ${merchantPattern} → ${aiMerchantName} (${aiCategoryTag})`);
          
          // Rate limiting: Wait between API calls
          if (apiCallCount % 5 === 0) {
            console.log('⏳ Rate limiting: Waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error) {
          console.error(`❌ Failed to tag merchant ${merchantPattern}:`, error);
          errors.push({
            merchant: merchantPattern,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          continue; // Skip this merchant
        }
      }

      // Update all transactions for this merchant in smaller batches
      const transactionIds = merchantTransactions.map(tx => tx.id);
      const batchSize = 50; // Process 50 transactions at a time
      let updatedCount = 0;
      
      for (let i = 0; i < transactionIds.length; i += batchSize) {
        const batch = transactionIds.slice(i, i + batchSize);
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            ai_merchant_name: aiMerchantName,
            ai_category_tag: aiCategoryTag
          })
          .in('id', batch);

        if (updateError) {
          console.error(`❌ Failed to update batch ${i + 1}-${i + batch.length} for ${merchantPattern}:`, updateError);
          errors.push({
            merchant: `${merchantPattern} (batch ${i + 1}-${i + batch.length})`,
            error: 'Database update failed'
          });
        } else {
          updatedCount += batch.length;
          console.log(`✅ Updated batch ${i + 1}-${i + batch.length} for ${merchantPattern}`);
        }
      }

      if (updatedCount > 0) {
        processedCount += updatedCount;
        results.push({
          merchant: merchantPattern,
          ai_merchant_name: aiMerchantName,
          ai_category_tag: aiCategoryTag,
          transaction_count: updatedCount,
          was_cached: !!cached
        });
      }
    }

    console.log(`✅ Bulk tagging completed: ${processedCount} transactions processed`);

    return NextResponse.json({
      success: true,
      message: `Successfully tagged ${processedCount} transactions across ${results.length} merchants`,
      stats: {
        total_found: transactions.length,
        processed: processedCount,
        unique_merchants: merchantGroups.size,
        api_calls: apiCallCount,
        cached: cachedCount,
        errors: errors.length
      },
      results: results.slice(0, 10), // Show first 10 for preview
      errors: errors,
      estimated_cost: `$${(apiCallCount * 0.01).toFixed(2)}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk tagging error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 