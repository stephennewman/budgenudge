import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

// GET - Fetch user's tracked categories
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's tracked categories
    const { data: trackedCategories, error } = await supabase
      .from('category_pacing_tracking')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracked categories:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch tracked categories' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      tracked_categories: trackedCategories || []
    });

  } catch (error) {
    console.error('Category pacing tracking GET error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST - Add a category to tracking
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ai_category } = await request.json();
    
    if (!ai_category) {
      return NextResponse.json({ 
        success: false, 
        error: 'Category name is required' 
      }, { status: 400 });
    }

    // Insert or update the tracking record
    const { data: trackingRecord, error } = await supabase
      .from('category_pacing_tracking')
      .upsert({
        user_id: user.id,
        ai_category: ai_category,
        is_active: true,
        auto_selected: false
      }, {
        onConflict: 'user_id,ai_category'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding category to tracking:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to add category to tracking' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${ai_category} added to pacing tracking`,
      tracking_record: trackingRecord
    });

  } catch (error) {
    console.error('Category pacing tracking POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PUT - Update tracking status (enable/disable)
export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ai_category, is_active } = await request.json();
    
    if (!ai_category || typeof is_active !== 'boolean') {
      return NextResponse.json({ 
        success: false, 
        error: 'Category name and active status are required' 
      }, { status: 400 });
    }

    // Update the tracking record
    const { data: trackingRecord, error } = await supabase
      .from('category_pacing_tracking')
      .update({ 
        is_active: is_active,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('ai_category', ai_category)
      .select()
      .single();

    if (error) {
      console.error('Error updating category tracking:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update category tracking' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${ai_category} tracking ${is_active ? 'enabled' : 'disabled'}`,
      tracking_record: trackingRecord
    });

  } catch (error) {
    console.error('Category pacing tracking PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE - Remove a category from tracking
export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ai_category } = await request.json();
    
    if (!ai_category) {
      return NextResponse.json({ 
        success: false, 
        error: 'Category name is required' 
      }, { status: 400 });
    }

    // Delete the tracking record
    const { error } = await supabase
      .from('category_pacing_tracking')
      .delete()
      .eq('user_id', user.id)
      .eq('ai_category', ai_category);

    if (error) {
      console.error('Error removing category from tracking:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to remove category from tracking' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${ai_category} removed from pacing tracking`
    });

  } catch (error) {
    console.error('Category pacing tracking DELETE error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 