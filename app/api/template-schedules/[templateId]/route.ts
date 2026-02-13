import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await context.params;
    
    if (!templateId) {
      return NextResponse.json({ 
        error: 'Template ID is required' 
      }, { status: 400 });
    }

    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the schedule for this specific template
    const { data: schedule, error } = await supabase
      .from('template_schedules')
      .select('*')
      .eq('template_id', templateId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Failed to fetch schedule:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch schedule' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      schedule: schedule || null
    });
    
  } catch (error) {
    console.error('❌ Get schedule API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching schedule' 
    }, { status: 500 });
  }
}
