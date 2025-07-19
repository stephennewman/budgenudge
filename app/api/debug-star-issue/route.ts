import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 DEBUG: Checking star issue for user:', user.id);

    // 1. Check all tagged merchants for user
    const { data: allMerchants, error: allError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('Error fetching all merchants:', allError);
    }

    // 2. Check active merchants (what recurring bills shows)
    const { data: activeMerchants, error: activeError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (activeError) {
      console.error('Error fetching active merchants:', activeError);
    }

    // 3. Check if database migration was applied (check for default value)
    const { data: tableInfo } = await supabase
      .rpc('get_table_info', { table_name: 'tagged_merchants' })
      .single();

    // 4. Get some sample transactions for testing
    const { data: sampleTransactions } = await supabase
      .from('transactions')
      .select('name, merchant_name, amount, date')
      .limit(5)
      .order('date', { ascending: false });

    const debugInfo = {
      timestamp: new Date().toISOString(),
      user_id: user.id,
      all_merchants: {
        count: allMerchants?.length || 0,
        merchants: allMerchants || []
      },
      active_merchants: {
        count: activeMerchants?.length || 0,
        merchants: activeMerchants || []
      },
      schema_info: tableInfo || 'Unable to fetch schema info',
      sample_transactions: sampleTransactions || [],
      potential_issues: [] as string[]
    };

    // Check for common issues
    if (allMerchants && allMerchants.length > 0) {
      const nullActiveCount = allMerchants.filter(m => m.is_active === null).length;
      const falseActiveCount = allMerchants.filter(m => m.is_active === false).length;
      
      if (nullActiveCount > 0) {
        debugInfo.potential_issues.push(`${nullActiveCount} merchants have is_active=null (migration not applied)`);
      }
      if (falseActiveCount > 0) {
        debugInfo.potential_issues.push(`${falseActiveCount} merchants have is_active=false`);
      }
      if (activeMerchants && activeMerchants.length !== allMerchants.length) {
        debugInfo.potential_issues.push(`${allMerchants.length - (activeMerchants?.length || 0)} merchants are inactive and hidden from recurring bills`);
      }
    }

    console.log('🔍 DEBUG Results:', debugInfo);

    return NextResponse.json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, merchant_name } = await request.json();

    if (action === 'test_star') {
      console.log('🌟 Testing star functionality for merchant:', merchant_name);
      
      // Test the analyze endpoint directly
      const analyzeResponse = await fetch('https://budgenudge.vercel.app/api/tagged-merchants/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ merchant_name })
      });

      const analyzeResult = await analyzeResponse.json();

      return NextResponse.json({
        success: true,
        test_result: {
          analyze_response: analyzeResult,
          analyze_status: analyzeResponse.status,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (action === 'fix_existing') {
      console.log('🔧 Fixing existing merchants with null is_active');
      
      // Update all merchants with null is_active to true
      const { data: updated, error: updateError } = await supabase
        .from('tagged_merchants')
        .update({ is_active: true })
        .eq('user_id', user.id)
        .is('is_active', null)
        .select();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: `Fixed ${updated?.length || 0} merchants`,
        updated_merchants: updated
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Debug POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 