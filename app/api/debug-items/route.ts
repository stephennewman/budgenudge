import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get ALL items for this user (any status)
    const { data: allItems, error: allItemsError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId);

    // Get items with status 'good'
    const { data: goodItems, error: goodItemsError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'good');

    // Get items with any status (should be same as allItems)
    const { data: anyStatusItems, error: anyStatusError } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId);

    return NextResponse.json({
      userId,
      queries: {
        allItems: {
          count: allItems?.length || 0,
          error: allItemsError?.message,
          items: allItems
        },
        goodItems: {
          count: goodItems?.length || 0,
          error: goodItemsError?.message,
          items: goodItems
        },
        anyStatusItems: {
          count: anyStatusItems?.length || 0,
          error: anyStatusError?.message,
          items: anyStatusItems
        }
      }
    });

  } catch (error) {
    console.error('Debug items error:', error);
    return NextResponse.json({
      error: 'Failed to debug items',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
