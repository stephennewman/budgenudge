import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { item_id } = await request.json();

    if (!item_id) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      );
    }

    // Get the authorization header (same pattern as transactions API)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client and get user with token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this item
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .select('id, plaid_item_id, plaid_access_token, institution_name')
      .eq('plaid_item_id', item_id)
      .eq('user_id', user.id)
      .single();

    if (itemError || !itemData) {
      console.error('❌ Item not found or not owned by user:', itemError);
      return NextResponse.json(
        { error: 'Item not found or access denied' },
        { status: 404 }
      );
    }

    // Mark item as disconnected
    const now = new Date();
    const { error: updateError } = await supabase
      .from('items')
      .update({
        deleted_at: now.toISOString(),
        status: 'disconnected'
      })
      .eq('id', itemData.id);

    if (updateError) {
      console.error('❌ Failed to disconnect item:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      disconnectedItemId: item_id,
      institutionName: itemData.institution_name || 'Unknown Institution',
      message: 'Account disconnected successfully'
    });

  } catch (error) {
    console.error('💥 Disconnect API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Disconnect API is working',
    timestamp: new Date().toISOString()
  });
}