import { NextResponse } from 'next/server';

// DEBUG endpoint to manually trigger auto-selection for users who missed it due to Plaid errors
export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    console.log(`🔧 DEBUG: Manually triggering auto-selection for user: ${user_id}`);

    // Trigger merchant auto-selection
    const merchantResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/merchant-pacing-tracking/auto-select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });

    let merchantResult = null;
    if (merchantResponse.ok) {
      merchantResult = await merchantResponse.json();
      console.log('✅ Merchant auto-selection completed:', merchantResult);
    } else {
      console.log('⚠️ Merchant auto-selection failed:', merchantResponse.status);
    }

    // Trigger category auto-selection  
    const categoryResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/category-pacing-tracking/auto-select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });

    let categoryResult = null;
    if (categoryResponse.ok) {
      categoryResult = await categoryResponse.json();
      console.log('✅ Category auto-selection completed:', categoryResult);
    } else {
      console.log('⚠️ Category auto-selection failed:', categoryResponse.status);
    }

    return NextResponse.json({
      success: true,
      user_id,
      merchant_result: merchantResult,
      category_result: categoryResult,
      message: 'Auto-selection manually triggered'
    });

  } catch (error: unknown) {
    console.error('Error in debug auto-select:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger auto-selection', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}