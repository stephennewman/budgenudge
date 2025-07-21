import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// GET - Fetch user's tracked merchants
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's tracked merchants
    const { data: trackedMerchants, error } = await supabase
      .from('merchant_pacing_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracked merchants:', error);
      return NextResponse.json({ error: 'Failed to fetch tracked merchants' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tracked_merchants: trackedMerchants || []
    });

  } catch (error) {
    console.error('Merchant pacing tracking GET error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST - Add or update merchant tracking
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ai_merchant_name, is_active = true, auto_selected = false } = await request.json();

    if (!ai_merchant_name) {
      return NextResponse.json({ error: 'ai_merchant_name is required' }, { status: 400 });
    }

    // Upsert merchant tracking (insert or update if exists)
    const { data, error } = await supabase
      .from('merchant_pacing_tracking')
      .upsert({
        user_id: user.id,
        ai_merchant_name,
        is_active,
        auto_selected,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,ai_merchant_name'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting merchant tracking:', error);
      return NextResponse.json({ error: 'Failed to update merchant tracking' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      merchant_tracking: data,
      message: `Merchant tracking ${is_active ? 'enabled' : 'disabled'} for ${ai_merchant_name}`
    });

  } catch (error) {
    console.error('Merchant pacing tracking POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PUT - Update specific merchant tracking
export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ai_merchant_name, is_active } = await request.json();

    if (!id && !ai_merchant_name) {
      return NextResponse.json({ error: 'Either id or ai_merchant_name is required' }, { status: 400 });
    }

    // Build the update query
    let query = supabase
      .from('merchant_pacing_tracking')
      .update({ 
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    // Use either id or ai_merchant_name to identify the record
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('ai_merchant_name', ai_merchant_name);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error('Error updating merchant tracking:', error);
      return NextResponse.json({ error: 'Failed to update merchant tracking' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      merchant_tracking: data,
      message: `Merchant tracking updated for ${data.ai_merchant_name}`
    });

  } catch (error) {
    console.error('Merchant pacing tracking PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE - Remove merchant tracking
export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ai_merchant_name } = await request.json();

    if (!id && !ai_merchant_name) {
      return NextResponse.json({ error: 'Either id or ai_merchant_name is required' }, { status: 400 });
    }

    // Build the delete query
    let query = supabase
      .from('merchant_pacing_tracking')
      .delete()
      .eq('user_id', user.id);

    // Use either id or ai_merchant_name to identify the record
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('ai_merchant_name', ai_merchant_name);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting merchant tracking:', error);
      return NextResponse.json({ error: 'Failed to delete merchant tracking' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Merchant tracking removed for ${ai_merchant_name || 'selected merchant'}`
    });

  } catch (error) {
    console.error('Merchant pacing tracking DELETE error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 