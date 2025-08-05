import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    console.log('🔍 Testing SlickText integration for email:', email);

    // Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      return NextResponse.json({
        error: 'Failed to get users',
        details: userError.message
      }, { status: 500 });
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        email
      }, { status: 404 });
    }

    console.log('👤 Found user:', {
      id: user.id,
      email: user.email,
      phone: user.phone,
      user_metadata: user.user_metadata
    });

    // Test SlickText integration
    const slickTextResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/add-user-to-slicktext`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        phone: user.phone,
        first_name: user.user_metadata?.firstName || 'Test',
        last_name: user.user_metadata?.lastName || 'User'
      })
    });

    const slickTextResult = await slickTextResponse.json();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        user_metadata: user.user_metadata
      },
      slickTextResult,
      slickTextStatus: slickTextResponse.status
    });

  } catch (error) {
    console.error('❌ Test SlickText integration error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}