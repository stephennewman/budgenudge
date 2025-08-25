import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get recent users with email patterns containing "stephen" or "krezzo"
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Filter users containing stephen or krezzo
    const matchingUsers = users.filter(user => 
      user.email?.includes('stephen') || 
      user.email?.includes('krezzo')
    ).slice(0, 10);
    
    const profiles = matchingUsers.map(user => ({
      user_id: user.id,
      email: user.email,
      phone: user.phone || user.user_metadata?.signupPhone,
      created_at: user.created_at
    }));
    
    return NextResponse.json({ 
      users: profiles,
      total: profiles?.length || 0 
    });
    
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
