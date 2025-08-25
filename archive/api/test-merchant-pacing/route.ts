import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    console.log('🔍 Testing merchant pacing for user:', userId);

    // Test the exact query from the SMS template
    const { data: merchantPacingMerchants, error: merchantError } = await supabase
      .from('merchant_pacing_tracking')
      .select('ai_merchant_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    console.log('🔍 Query Result:', { merchantPacingMerchants, merchantError });

    // Also test a direct count
    const { count: merchantCount } = await supabase
      .from('merchant_pacing_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      merchantPacingMerchants,
      merchantError,
      merchantCount,
      userId
    });

  } catch (error) {
    console.error('Error testing merchant pacing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
