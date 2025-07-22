const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEnhancedDataCapture() {
  console.log('🧪 Testing enhanced data capture...\n');

  try {
    // Check if new columns exist
    const { data: sample, error: sampleError } = await supabase
      .from('transactions')
      .select('logo_url, location_city, is_subscription, pfc_primary')
      .limit(1);

    if (sampleError) {
      console.error('❌ Database columns not yet created:', sampleError.message);
      console.log('📝 Run this migration first:');
      console.log('   supabase db push');
      return false;
    }

    console.log('✅ Enhanced columns exist in database');

    // Check recent transactions for enhanced data
    const { data: recent, error: recentError } = await supabase
      .from('transactions')
      .select('id, name, merchant_name, logo_url, location_city, is_subscription, pfc_primary, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('❌ Error fetching recent transactions:', recentError);
      return false;
    }

    console.log('📊 Recent transactions enhanced data status:');
    recent.forEach((tx, i) => {
      const enhanced = [
        tx.logo_url ? '🖼️' : '⚪',
        tx.location_city ? '📍' : '⚪', 
        tx.is_subscription ? '🔄' : '⚪',
        tx.pfc_primary ? '🏷️' : '⚪'
      ].join(' ');
      
      console.log(`  ${i+1}. ${tx.name.substring(0, 30).padEnd(30)} | ${enhanced}`);
    });

    // Summary stats
    const withLogo = recent.filter(tx => tx.logo_url).length;
    const withLocation = recent.filter(tx => tx.location_city).length;
    const subscriptions = recent.filter(tx => tx.is_subscription).length;
    const withCategory = recent.filter(tx => tx.pfc_primary).length;

    console.log('\n📈 Enhanced Data Coverage (last 10 transactions):');
    console.log(`  🖼️ Merchant logos:    ${withLogo}/10 (${(withLogo*10)}%)`);
    console.log(`  📍 Location data:     ${withLocation}/10 (${(withLocation*10)}%)`);
    console.log(`  🔄 Subscriptions:     ${subscriptions}/10 (${(subscriptions*10)}%)`);
    console.log(`  🏷️ Enhanced categories: ${withCategory}/10 (${(withCategory*10)}%)`);

    if (withLogo === 0 && withLocation === 0 && subscriptions === 0 && withCategory === 0) {
      console.log('\n⚠️  No enhanced data found - this is normal if:');
      console.log('   1. Migration just ran (new transactions will have data)');
      console.log('   2. Enhanced storeTransactions not yet deployed');
      console.log('   3. No new transactions since enhancement');
    } else {
      console.log('\n🎉 Enhanced data capture is working!');
    }

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testEnhancedDataCapture(); 