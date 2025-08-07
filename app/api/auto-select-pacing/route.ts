import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// POST - Trigger auto-selection for both merchant and category pacing after account connection
export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🤖 Starting pacing auto-selection for user: ${user.id}`);

    // Check if user has any Plaid items (accounts connected)
    const { data: items } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No accounts connected yet - auto-selection skipped',
        merchant_result: null,
        category_result: null
      });
    }

    // Run merchant pacing auto-selection
    let merchantResult = null;
    try {
      const merchantResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/merchant-pacing-tracking/auto-select`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
        }
      });
      
      if (merchantResponse.ok) {
        merchantResult = await merchantResponse.json();
        console.log('✅ Merchant auto-selection completed:', merchantResult.message);
      }
    } catch (error) {
      console.error('❌ Merchant auto-selection failed:', error);
    }

    // Run category pacing auto-selection
    let categoryResult = null;
    try {
      const categoryResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/category-pacing-tracking/auto-select`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
        }
      });
      
      if (categoryResponse.ok) {
        categoryResult = await categoryResponse.json();
        console.log('✅ Category auto-selection completed:', categoryResult.message);
      }
    } catch (error) {
      console.error('❌ Category auto-selection failed:', error);
    }

    const totalAutoSelected = (merchantResult?.auto_selected?.length || 0) + (categoryResult?.auto_selected?.length || 0);

    return NextResponse.json({ 
      success: true, 
      message: `Auto-selection completed: ${totalAutoSelected} items selected`,
      merchant_result: merchantResult,
      category_result: categoryResult,
      summary: {
        merchants_selected: merchantResult?.auto_selected?.length || 0,
        categories_selected: categoryResult?.auto_selected?.length || 0,
        total_selected: totalAutoSelected
      }
    });

  } catch (error) {
    console.error('Pacing auto-selection error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 