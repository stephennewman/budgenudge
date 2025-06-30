import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Retrieve scheduled messages for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'all';

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    let query = supabase
      .from('scheduled_sms')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });

    // Filter by status if specified
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching scheduled messages:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch scheduled messages' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      messages: messages || [],
      count: messages?.length || 0
    });

  } catch (error) {
    console.error('Error in scheduled SMS GET:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE: Cancel a scheduled message
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!messageId || !userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Message ID and User ID are required' 
      }, { status: 400 });
    }

    // Update the message status to cancelled (only if it's still pending)
    const { data, error } = await supabase
      .from('scheduled_sms')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Error cancelling scheduled message:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to cancel scheduled message' 
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: false, 
        error: 'Message not found or already processed' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Scheduled message cancelled successfully',
      data
    });

  } catch (error) {
    console.error('Error in scheduled SMS DELETE:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 