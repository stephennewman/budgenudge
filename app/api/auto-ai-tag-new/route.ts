import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tagMerchantWithAI, type MerchantTaggingInput } from '@/utils/ai/merchant-tagging';

// Shared AI tagging logic for both GET (cron) and POST (manual) calls
async function executeAITagging(request?: Request) {
  try {
    // Verify authorization for manual calls (POST) or allow Vercel cron (GET)
    if (request) {
      const isVercelCron = request.headers.get('x-vercel-cron');
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;
      
      if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🆕 PHASE 2: Find all untagged transactions from the last 90 days (extended coverage)
    // This catches any historical transactions that might have been missed
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: untaggedTransactions, error: fetchError } = await supabaseService
      .from('transactions')
      .select('id, merchant_name, name, amount, category, subcategory, ai_merchant_name, ai_category_tag, date')
      .is('ai_merchant_name', null)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(500); // Process up to 500 transactions

    if (fetchError) {
      console.error('🤖❌ Failed to fetch untagged transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!untaggedTransactions || untaggedTransactions.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No untagged transactions found',
        processed: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Group transactions by merchant for efficient processing
    const merchantGroups = new Map<string, typeof untaggedTransactions>();
    untaggedTransactions.forEach(tx => {
      const merchantKey = tx.merchant_name || tx.name || 'Unknown';
      if (!merchantGroups.has(merchantKey)) {
        merchantGroups.set(merchantKey, []);
      }
      merchantGroups.get(merchantKey)!.push(tx);
    });

    // ✅ FIX: Batch cache lookups to avoid 414 errors
    const merchantPatterns = Array.from(merchantGroups.keys());
    const cacheMap = new Map<string, {merchant_pattern: string, ai_merchant_name: string, ai_category_tag: string}>();
    
    // Process merchant patterns in batches of 50 to avoid URL length issues
    const batchSize = 50;
    for (let i = 0; i < merchantPatterns.length; i += batchSize) {
      const batch = merchantPatterns.slice(i, i + batchSize);
      
      const { data: cachedTags, error: cacheError } = await supabaseService
        .from('merchant_ai_tags')
        .select('merchant_pattern, ai_merchant_name, ai_category_tag')
        .in('merchant_pattern', batch);

      if (cacheError) {
        console.error(`🤖⚠️ Warning: Failed to fetch cache batch ${i / batchSize + 1}:`, cacheError);
      } else if (cachedTags) {
        cachedTags.forEach(tag => {
          cacheMap.set(tag.merchant_pattern, tag);
        });
      }
    }

    const updates: Array<{id: string, ai_merchant_name: string, ai_category_tag: string}> = [];
    const newMerchantTags: Array<{merchant_pattern: string, ai_merchant_name: string, ai_category_tag: string}> = [];
    let apiCallCount = 0;
    let cachedCount = 0;

    for (const [merchantPattern, merchantTransactions] of merchantGroups) {
      const cached = cacheMap.get(merchantPattern);
      
      if (cached) {
        // Use cached tags
        merchantTransactions.forEach(tx => {
          updates.push({
            id: tx.id,
            ai_merchant_name: cached.ai_merchant_name,
            ai_category_tag: cached.ai_category_tag
          });
        });
        cachedCount += merchantTransactions.length;
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
          // Rate limiting to prevent API overload
          if (apiCallCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`🤖❌ Failed to tag merchant ${merchantPattern}:`, error);
          // Continue with other merchants
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
      }
    }

    // Update transactions with AI tags in batches
    if (updates.length > 0) {
      const batchSize = 50;
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        for (const update of batch) {
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

        // Small delay between batches
        if (i + batchSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

    }

    const summary = {
      success: true,
      message: 'Auto AI tagging completed successfully',
      stats: {
        total_untagged_found: untaggedTransactions.length,
        processed: updates.length,
        cached: cachedCount,
        api_calls: apiCallCount,
        new_merchants_cached: newMerchantTags.length
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(summary);

  } catch (error) {
    console.error('🤖❌ Auto AI tagging process failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Auto AI tagging failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// ✅ GET method for Vercel cron jobs (calls every 15 minutes)
export async function GET() {
  return await executeAITagging();
}

// POST method for manual testing and API calls
export async function POST(request: Request) {
  return await executeAITagging(request);
} 