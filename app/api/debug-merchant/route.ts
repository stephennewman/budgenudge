import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const merchant = searchParams.get('merchant') || 'tmobile';

    // Search for transactions matching the merchant name
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .or(`merchant_name.ilike.%${merchant}%,name.ilike.%${merchant}%`)
      .order('date', { ascending: false })
      .limit(20);

    // Check if merchant is already tagged
    const { data: existingMerchant } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .ilike('merchant_name', merchant)
      .single();

    // Get all tagged merchants for comparison
    const { data: allTaggedMerchants } = await supabase
      .from('tagged_merchants')
      .select('merchant_name, is_active')
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      debug_info: {
        searched_for: merchant,
        transactions_found: transactions?.length || 0,
        transactions: transactions || [],
        existing_tagged_merchant: existingMerchant,
        all_tagged_merchants: allTaggedMerchants || [],
        search_query: `merchant_name.ilike.%${merchant}% OR name.ilike.%${merchant}%`
      }
    });

  } catch (error) {
    console.error('Debug merchant error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 