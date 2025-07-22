import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🧪 Testing enhanced fields...');

    // Test if we can query the new fields
    const { data: testData, error: testError } = await supabaseService
      .from('transactions')
      .select('id, name, merchant_name, logo_url, location_city, is_subscription, pfc_primary, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (testError) {
      return NextResponse.json({ 
        success: false,
        error: 'Enhanced fields not available',
        details: testError.message,
        action: 'Run migration first: POST /api/migrate-enhanced-fields'
      }, { status: 400 });
    }

    console.log('✅ Enhanced fields are queryable');

    // Analyze the data
    const stats = {
      total_transactions: testData.length,
      with_logo: testData.filter(tx => tx.logo_url).length,
      with_location: testData.filter(tx => tx.location_city).length,
      subscriptions: testData.filter(tx => tx.is_subscription).length,
      with_enhanced_category: testData.filter(tx => tx.pfc_primary).length
    };

    const sample_transactions = testData.map(tx => ({
      name: tx.name.substring(0, 30),
      merchant: tx.merchant_name?.substring(0, 20) || 'none',
      enhanced_data: {
        logo: !!tx.logo_url,
        location: tx.location_city || null,
        subscription: tx.is_subscription,
        category: tx.pfc_primary || null
      }
    }));

    return NextResponse.json({ 
      success: true,
      message: 'Enhanced fields test completed',
      stats,
      sample_transactions,
      coverage: {
        logo_coverage: `${stats.with_logo}/${stats.total_transactions} (${Math.round(stats.with_logo/stats.total_transactions*100)}%)`,
        location_coverage: `${stats.with_location}/${stats.total_transactions} (${Math.round(stats.with_location/stats.total_transactions*100)}%)`,
        subscription_detection: `${stats.subscriptions}/${stats.total_transactions} (${Math.round(stats.subscriptions/stats.total_transactions*100)}%)`,
        enhanced_category_coverage: `${stats.with_enhanced_category}/${stats.total_transactions} (${Math.round(stats.with_enhanced_category/stats.total_transactions*100)}%)`
      },
      recommendations: stats.with_logo === 0 && stats.with_location === 0 && stats.subscriptions === 0 && stats.with_enhanced_category === 0
        ? [
            "No enhanced data found - this is normal if:",
            "1. Migration just completed (new transactions will have enhanced data)",
            "2. Enhanced webhook not yet deployed", 
            "3. No new transactions since enhancement"
          ]
        : [
            "Enhanced data capture is working!",
            "New transactions will automatically include enhanced fields",
            "Ready to deploy UI features using this data"
          ]
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 