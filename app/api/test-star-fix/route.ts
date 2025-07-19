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

    // Get all tagged merchants
    const { data: allMerchants, error: allError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (allError) {
      return NextResponse.json({ error: 'Failed to fetch merchants', details: allError }, { status: 500 });
    }

    // Get active merchants (this is what recurring bills page uses)
    const { data: activeMerchants, error: activeError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (activeError) {
      return NextResponse.json({ error: 'Failed to fetch active merchants', details: activeError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_merchants: allMerchants?.length || 0,
        active_merchants: activeMerchants?.length || 0,
        migration_success: allMerchants?.every(m => m.is_active !== null) || false
      },
      all_merchants: allMerchants || [],
      active_merchants: activeMerchants || [],
      test_passed: (allMerchants?.length || 0) === (activeMerchants?.length || 0),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 