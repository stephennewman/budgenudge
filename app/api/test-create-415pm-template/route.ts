import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🔧 Creating 415pm-special template for user: ${userId}`);

    // Check if template already exists
    const { data: existingTemplate } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('sms_type', '415pm-special')
      .single();

    if (existingTemplate) {
      console.log(`✅ Template already exists for user ${userId}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Template already exists',
        template: existingTemplate
      });
    }

    // Create the template
    const { data: newTemplate, error: createError } = await supabase
      .from('user_sms_preferences')
      .insert({
        user_id: userId,
        sms_type: '415pm-special',
        enabled: true,
        frequency: 'daily',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error(`❌ Error creating template:`, createError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create template',
        details: createError.message 
      }, { status: 500 });
    }

    console.log(`✅ Successfully created 415pm-special template for user ${userId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Template created successfully',
      template: newTemplate
    });

  } catch (error) {
    console.error('❌ Error in test create template:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
