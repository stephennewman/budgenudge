import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { tagMerchantWithAI, type MerchantTaggingInput } from '@/utils/ai/merchant-tagging';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transaction_ids, batch_size = 50 } = body;

    if (!transaction_ids || !Array.isArray(transaction_ids)) {
      return NextResponse.json({ error: 'transaction_ids array is required' }, { status: 400 });
    }

    console.log(`🏷️ AI Tagging ${transaction_ids.length} transactions for user ${user.id}`);

    // Fetch transactions that need tagging
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, amount, category, subcategory, ai_merchant_name, ai_category_tag')
      .in('id', transaction_ids)
      .is('ai_merchant_name', null); // Only process untagged transactions

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No untagged transactions found',
        processed: 0,
        cached: 0,
        api_calls: 0
      });
    }

    let processedCount = 0;
    let cachedCount = 0;
    let apiCallCount = 0;

    // Group transactions by merchant for caching efficiency
    const merchantGroups = new Map<string, typeof transactions>();
    transactions.forEach(tx => {
      const merchantKey = tx.merchant_name || tx.name || 'Unknown';
      if (!merchantGroups.has(merchantKey)) {
        merchantGroups.set(merchantKey, []);
      }
      merchantGroups.get(merchantKey)!.push(tx);
    });

    console.log(`📊 Processing ${merchantGroups.size} unique merchants`);

    // Check cache for existing merchant patterns
    const merchantPatterns = Array.from(merchantGroups.keys());
    const { data: cachedTags } = await supabase
      .from('merchant_ai_tags')
      .select('merchant_pattern, ai_merchant_name, ai_category_tag')
      .in('merchant_pattern', merchantPatterns);

    const cacheMap = new Map(cachedTags?.map(tag => [tag.merchant_pattern, tag]) || []);

    // Process transactions in batches
    const updates: Array<{id: string, ai_merchant_name: string, ai_category_tag: string}> = [];
    const newMerchantTags: Array<{merchant_pattern: string, ai_merchant_name: string, ai_category_tag: string}> = [];

    for (const [merchantPattern, merchantTransactions] of merchantGroups) {
      const cached = cacheMap.get(merchantPattern);
      
      if (cached) {
        // Use cached tags
        console.log(`💾 Using cached tags for ${merchantPattern}: ${cached.ai_merchant_name} (${cached.ai_category_tag})`);
        merchantTransactions.forEach(tx => {
          updates.push({
            id: tx.id,
            ai_merchant_name: cached.ai_merchant_name,
            ai_category_tag: cached.ai_category_tag
          });
        });
        cachedCount += merchantTransactions.length;
      } else {
        // Need to call AI
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
          
          // Cache the result
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
          processedCount += merchantTransactions.length;

          // Rate limiting: Wait between API calls
          if (apiCallCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay every 10 calls
          }

        } catch (error) {
          console.error(`❌ Failed to tag merchant ${merchantPattern}:`, error);
          // Skip this merchant, don't block the entire process
        }
      }
    }

    // Batch insert new merchant tags to cache
    if (newMerchantTags.length > 0) {
      const { error: cacheError } = await supabase
        .from('merchant_ai_tags')
        .insert(newMerchantTags);

      if (cacheError) {
        console.error('Warning: Failed to cache merchant tags:', cacheError);
        // Don't fail the entire operation
      } else {
        console.log(`💾 Cached ${newMerchantTags.length} new merchant patterns`);
      }
    }

    // Batch update transactions with AI tags
    if (updates.length > 0) {
      // Update in smaller batches to avoid query size limits
      const batchSize = Math.min(batch_size, 100);
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // Build the update query
        const updatePromises = batch.map(update => 
          supabase
            .from('transactions')
            .update({
              ai_merchant_name: update.ai_merchant_name,
              ai_category_tag: update.ai_category_tag
            })
            .eq('id', update.id)
        );

        await Promise.all(updatePromises);
      }

      console.log(`✅ Updated ${updates.length} transactions with AI tags`);
    }

    return NextResponse.json({
      success: true,
      processed: processedCount + cachedCount,
      cached: cachedCount,
      api_calls: apiCallCount,
      new_merchants_cached: newMerchantTags.length,
      updated_transactions: updates.length
    });

  } catch (error) {
    console.error('AI tagging error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to check tagging status
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count tagged vs untagged transactions
    const { data: stats } = await supabase
      .from('transactions')
      .select('ai_merchant_name, ai_category_tag')
      .limit(1000); // Reasonable limit for stats

    if (!stats) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const totalTransactions = stats.length;
    const taggedTransactions = stats.filter(t => t.ai_merchant_name && t.ai_category_tag).length;
    const untaggedTransactions = totalTransactions - taggedTransactions;

    // Count cached merchant patterns
    const { count: cachedMerchants } = await supabase
      .from('merchant_ai_tags')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      stats: {
        total_transactions: totalTransactions,
        tagged_transactions: taggedTransactions,
        untagged_transactions: untaggedTransactions,
        tagging_percentage: totalTransactions > 0 ? Math.round((taggedTransactions / totalTransactions) * 100) : 0,
        cached_merchants: cachedMerchants || 0
      }
    });

  } catch (error) {
    console.error('AI tagging stats error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 