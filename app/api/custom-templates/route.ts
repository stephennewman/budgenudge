import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { templateName, templateContent, variablesUsed } = await request.json();
    
    if (!templateName || !templateContent) {
      return NextResponse.json({ 
        error: 'Template name and content are required' 
      }, { status: 400 });
    }

    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Save the template
    const { data, error } = await supabase
      .from('custom_sms_templates')
      .upsert({
        user_id: user.id,
        template_name: templateName,
        template_content: templateContent,
        variables_used: variablesUsed || [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,template_name',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to save template:', error);
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'A template with this name already exists. Please choose a different name.' 
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to save template' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Template saved successfully!',
      template: data
    });
    
  } catch (error) {
    console.error('❌ Save template API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while saving template' 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Create Supabase client with proper server-side authentication
    const supabase = await createSupabaseClient();
    
    // Get current user (uses cookies automatically)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's templates
    const { data: templates, error } = await supabase
      .from('custom_sms_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to fetch templates:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch templates' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      templates: templates || []
    });
    
  } catch (error) {
    console.error('❌ Get templates API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching templates' 
    }, { status: 500 });
  }
}

// GET method for API documentation/testing
export async function OPTIONS() {
  return NextResponse.json({
    name: 'Custom SMS Templates API',
    description: 'Save and retrieve custom SMS templates',
    endpoints: {
      'POST /': {
        description: 'Save a new custom SMS template',
        body: {
          templateName: 'string - Name of the template',
          templateContent: 'string - Content/preview of the template',
          variablesUsed: 'string[] - Array of variable names used'
        }
      },
      'GET /': {
        description: 'Get all custom SMS templates for the current user'
      }
    },
    notes: [
      'Requires valid user authentication',
      'Template names must be unique per user',
      'Uses Row Level Security (RLS) for data protection'
    ]
  });
}
