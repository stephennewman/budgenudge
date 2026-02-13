import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { account_id } = await request.json();

    if (!account_id) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    // Get the authorization header (same pattern as other APIs)
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

    // Verify user owns this account via the item relationship
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select(`
        id,
        name,
        official_name,
        type,
        subtype,
        mask,
        item_id,
        items!inner (
          id,
          user_id,
          institution_name
        )
      `)
      .eq('id', account_id)
      .eq('items.user_id', user.id)
      .single();

    if (accountError || !accountData) {
      console.error('❌ Account not found or access denied:', accountError);
      return NextResponse.json(
        { error: 'Account not found or access denied' },
        { status: 404 }
      );
    }

    // Mark account as disconnected (soft delete)
    const now = new Date();
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        deleted_at: now.toISOString()
      })
      .eq('id', accountData.id);

    if (updateError) {
      console.error('❌ Failed to disconnect account:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      disconnectedAccountId: account_id,
      accountName: accountData.official_name || accountData.name || 'Unknown Account',
      accountType: `${accountData.type} ${accountData.subtype || ''}`.trim(),
      accountMask: accountData.mask,
      message: 'Account disconnected successfully'
    });

  } catch (error) {
    console.error('💥 Disconnect Account API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Disconnect Account API is working',
    timestamp: new Date().toISOString()
  });
}