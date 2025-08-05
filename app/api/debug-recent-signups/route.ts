import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('🔍 Getting recent user signups for debugging...');

    // Get the most recent 5 users
    const { data: recentUsers, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 10
    });

    if (error) {
      return NextResponse.json({
        error: 'Failed to get recent users',
        details: error.message
      }, { status: 500 });
    }

    // Format the user data for easier debugging
    const userSummary = recentUsers.users.map(user => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata,
      last_sign_in_at: user.last_sign_in_at
    }));

    // Also check SMS settings for these users
    const userIds = recentUsers.users.map(u => u.id);
    const { data: smsSettings } = await supabase
      .from('user_sms_settings')
      .select('*')
      .in('user_id', userIds);

    // Check SlickText leads
    const { data: slickTextLeads } = await supabase
      .from('sample_sms_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      recentUsers: userSummary,
      smsSettings,
      recentSlickTextLeads: slickTextLeads,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug recent signups error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}