#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Create client with service role for admin access
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migrateAITags() {
  console.log('🚀 Starting AI tagging migration...');
  console.log('📊 Checking current status...');

  try {
    // Get all transactions that need tagging
    const { data: untaggedTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id')
      .is('ai_merchant_name', null)
      .limit(2000); // Process in chunks to avoid memory issues

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return;
    }

    const totalUntagged = untaggedTransactions?.length || 0;
    console.log(`📋 Found ${totalUntagged} untagged transactions`);

    if (totalUntagged === 0) {
      console.log('✅ All transactions are already tagged!');
      return;
    }

    // Check existing cache
    const { count: cachedMerchants } = await supabase
      .from('merchant_ai_tags')
      .select('*', { count: 'exact', head: true });

    console.log(`💾 Found ${cachedMerchants || 0} cached merchant patterns`);

    // Process in batches to avoid API rate limits and memory issues
    const batchSize = 100;
    let processedTotal = 0;
    let apiCallsTotal = 0;
    let cachedTotal = 0;

    for (let i = 0; i < totalUntagged; i += batchSize) {
      const batch = untaggedTransactions.slice(i, i + batchSize);
      const batchIds = batch.map(tx => tx.id);
      
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalUntagged / batchSize)} (${batch.length} transactions)`);

      // Call the AI tagging endpoint
      try {
        const response = await fetch(`${supabaseUrl.replace('supabase.co', 'vercel.app')}/api/ai-tag-transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}` // This won't work for auth, but we'll handle it differently
          },
          body: JSON.stringify({
            transaction_ids: batchIds,
            batch_size: batchSize
          })
        });

        if (!response.ok) {
          console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, response.status, response.statusText);
          continue;
        }

        const result = await response.json();
        
        if (result.success) {
          processedTotal += result.processed;
          apiCallsTotal += result.api_calls;
          cachedTotal += result.cached;
          
          console.log(`✅ Batch completed: ${result.processed} processed (${result.cached} cached, ${result.api_calls} API calls)`);
          console.log(`📊 Progress: ${processedTotal}/${totalUntagged} (${Math.round((processedTotal / totalUntagged) * 100)}%)`);
        } else {
          console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, result.error);
        }

        // Rate limiting: Wait between batches to avoid overwhelming the API
        if (apiCallsTotal > 0 && apiCallsTotal % 20 === 0) {
          console.log('⏳ Rate limiting: Waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error) {
        console.error(`❌ Network error for batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        continue;
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log(`📊 Final stats:`);
    console.log(`  - Total processed: ${processedTotal}`);
    console.log(`  - From cache: ${cachedTotal}`);
    console.log(`  - New AI calls: ${apiCallsTotal}`);
    console.log(`  - Estimated cost: $${(apiCallsTotal * 0.01).toFixed(2)}`);

    // Final verification
    const { data: finalStats } = await supabase
      .from('transactions')
      .select('ai_merchant_name, ai_category_tag')
      .limit(1000);

    if (finalStats) {
      const taggedCount = finalStats.filter(t => t.ai_merchant_name && t.ai_category_tag).length;
      const percentage = Math.round((taggedCount / finalStats.length) * 100);
      console.log(`✅ Final verification: ${taggedCount}/${finalStats.length} transactions tagged (${percentage}%)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Alternative: Direct database approach (if API approach doesn't work)
async function migrateAITagsDirect() {
  console.log('🚀 Starting direct AI tagging migration...');
  
  // We'll need to implement the OpenAI calls directly here
  // This is a backup approach if the API endpoint doesn't work for migration
  
  console.log('⚠️  Direct migration not implemented yet. Use API approach first.');
}

// Run the migration
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDirect = args.includes('--direct');
  
  if (isDirect) {
    migrateAITagsDirect();
  } else {
    migrateAITags();
  }
}

module.exports = { migrateAITags, migrateAITagsDirect }; 