import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// Helper function to extract core merchant name for fuzzy matching
function extractCoreMerchantName(merchantName: string): string {
  if (!merchantName) return '';
  
  return merchantName
    .toLowerCase()
    .replace(/[#*]/g, '') // Remove # and * characters
    .replace(/\b(store|shop|location|branch|#)\s*\d+/gi, '') // Remove "store 123", "shop 456", etc.
    .replace(/\b\d+\b/g, '') // Remove standalone numbers
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Helper function to find similar merchants using fuzzy matching
function buildSimilarMerchantQuery(merchantPattern: string) {
  const coreName = extractCoreMerchantName(merchantPattern);
  
  // If core name is too short, fall back to exact matching
  if (coreName.length < 3) {
    return `merchant_name.eq.${merchantPattern},name.eq.${merchantPattern}`;
  }
  
  // Build fuzzy matching queries
  const patterns = [
    `merchant_name.ilike.%${coreName}%`,
    `name.ilike.%${coreName}%`,
    // Also include exact matches for safety
    `merchant_name.eq.${merchantPattern}`,
    `name.eq.${merchantPattern}`
  ];
  
  return patterns.join(',');
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
    const { 
      merchant_pattern, 
      ai_merchant_name, 
      ai_category_tag,
      apply_to_existing = true,
      preview_only = false // New parameter to preview matches
    } = body;

    if (!merchant_pattern || !ai_merchant_name || !ai_category_tag) {
      return NextResponse.json({ 
        error: 'Missing required fields: merchant_pattern, ai_merchant_name, ai_category_tag' 
      }, { status: 400 });
    }

    console.log(`🏷️ Manual override: ${merchant_pattern} → ${ai_merchant_name} (${ai_category_tag})`);

    // Get user's item IDs for transaction queries
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Find all transactions that match this merchant pattern (smart matching)
    const similarMerchantQuery = buildSimilarMerchantQuery(merchant_pattern);
    const { data: matchingTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, merchant_name, name, ai_merchant_name, ai_category_tag, amount, date')
      .in('plaid_item_id', itemIds)
      .or(similarMerchantQuery)
      .order('date', { ascending: false })
      .limit(500); // Reasonable limit

    if (fetchError) {
      console.error('Failed to fetch transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    const matchedCount = matchingTransactions?.length || 0;
    console.log(`🔍 Found ${matchedCount} matching transactions for pattern: ${merchant_pattern}`);

    // If preview_only, return the matches without updating
    if (preview_only) {
      return NextResponse.json({
        preview: true,
        merchant_pattern,
        ai_merchant_name,
        ai_category_tag,
        matched_transactions: matchedCount,
        sample_transactions: (matchingTransactions || []).slice(0, 10).map(tx => ({
          merchant_name: tx.merchant_name,
          name: tx.name,
          current_ai_merchant: tx.ai_merchant_name,
          current_ai_category: tx.ai_category_tag,
          amount: tx.amount,
          date: tx.date
        })),
        core_merchant_name: extractCoreMerchantName(merchant_pattern)
      });
    }

    // Update or insert the manual override in cache
    const { error: upsertError } = await supabase
      .from('merchant_ai_tags')
      .upsert({
        merchant_pattern,
        ai_merchant_name,
        ai_category_tag,
        is_manual_override: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'merchant_pattern'
      });

    if (upsertError) {
      console.error('Failed to update merchant cache:', upsertError);
      return NextResponse.json({ error: 'Failed to update merchant cache' }, { status: 500 });
    }

    let updatedTransactionCount = 0;
    let updatedMerchantPatterns: string[] = [];

    if (apply_to_existing && matchingTransactions && matchingTransactions.length > 0) {
      // Update all matching transactions in batches
      const transactionIds = matchingTransactions.map(tx => tx.id);
      const batchSize = 50;
      
      for (let i = 0; i < transactionIds.length; i += batchSize) {
        const batch = transactionIds.slice(i, i + batchSize);
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            ai_merchant_name,
            ai_category_tag
          })
          .in('id', batch);

        if (updateError) {
          console.error(`Failed to update transaction batch ${i + 1}-${i + batch.length}:`, updateError);
        } else {
          updatedTransactionCount += batch.length;
          console.log(`✅ Updated ${batch.length} transactions (batch ${i + 1}-${i + batch.length})`);
        }
      }

      // Collect unique merchant patterns that were updated
      updatedMerchantPatterns = [...new Set(matchingTransactions.map(tx => 
        tx.merchant_name || tx.name || 'Unknown'
      ))];

      // Update cache for all similar merchant patterns found
      if (updatedMerchantPatterns.length > 1) {
        const merchantCacheUpdates = updatedMerchantPatterns
          .filter(pattern => pattern !== merchant_pattern) // Don't duplicate the main one
          .map(pattern => ({
            merchant_pattern: pattern,
            ai_merchant_name,
            ai_category_tag,
            is_manual_override: true,
            updated_at: new Date().toISOString()
          }));

        if (merchantCacheUpdates.length > 0) {
          const { error: cacheError } = await supabase
            .from('merchant_ai_tags')
            .upsert(merchantCacheUpdates, {
              onConflict: 'merchant_pattern'
            });

          if (cacheError) {
            console.warn('Warning: Failed to update some merchant cache entries:', cacheError);
          } else {
            console.log(`💾 Updated cache for ${merchantCacheUpdates.length} similar merchant patterns`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Smart merchant override applied: ${ai_merchant_name} (${ai_category_tag})`,
      merchant_pattern,
      ai_merchant_name,
      ai_category_tag,
      updated_transactions: updatedTransactionCount,
      updated_merchant_patterns: updatedMerchantPatterns,
      core_merchant_name: extractCoreMerchantName(merchant_pattern),
      smart_matching: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual override error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 