import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find all tagged merchants with past prediction dates
    const { data: pastMerchants, error: fetchError } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lt('next_predicted_date', now.toISOString().split('T')[0]);

    if (fetchError) {
      console.error('Error fetching past merchants:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 });
    }

    if (!pastMerchants || pastMerchants.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No merchants with past dates found',
        updated_count: 0
      });
    }

    const updates = [];

    // Update each merchant's next predicted date based on their frequency
    for (const merchant of pastMerchants) {
      let nextDate: Date;
      
      switch (merchant.prediction_frequency) {
        case 'weekly':
          nextDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          nextDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          break;
        case 'quarterly':
          nextDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
          break;
        default:
          nextDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }

      const { error: updateError } = await supabase
        .from('tagged_merchants')
        .update({
          next_predicted_date: nextDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', merchant.id);

      if (updateError) {
        console.error(`Error updating merchant ${merchant.merchant_name}:`, updateError);
      } else {
        updates.push({
          merchant_name: merchant.merchant_name,
          old_date: merchant.next_predicted_date,
          new_date: nextDate.toISOString().split('T')[0]
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} merchants with past prediction dates`,
      updated_count: updates.length,
      updates: updates
    });

  } catch (error) {
    console.error('Fix past dates error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 