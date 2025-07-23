import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: merchantId } = await params;
    const body = await request.json();
    const { 
      expected_amount, 
      prediction_frequency,
      confidence_score,
      is_active,
      account_identifier,
      next_predicted_date
    } = body;

    console.log(`🔄 Updating merchant ${merchantId} for user ${user.id}:`, {
      expected_amount,
      prediction_frequency,
      confidence_score,
      is_active,
      account_identifier,
      next_predicted_date
    });

    // Calculate next predicted date if frequency changed
    const updateData: Record<string, string | number | boolean> = {
      updated_at: new Date().toISOString()
    };

    if (expected_amount !== undefined) {
      updateData.expected_amount = parseFloat(expected_amount);
    }

    if (prediction_frequency !== undefined) {
      updateData.prediction_frequency = prediction_frequency;
      
      // Recalculate next predicted date based on new frequency
      const now = new Date();
      let next_predicted_date;
      switch (prediction_frequency) {
        case 'weekly':
          next_predicted_date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          break;
        case 'bi-monthly':
          next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
          break;
        case 'quarterly':
          next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
          break;
        default:
          next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
      updateData.next_predicted_date = next_predicted_date.toISOString().split('T')[0];
    }

    if (confidence_score !== undefined) {
      updateData.confidence_score = parseInt(confidence_score);
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    if (account_identifier !== undefined) {
      updateData.account_identifier = account_identifier;
    }

    if (next_predicted_date !== undefined && next_predicted_date !== '') {
      updateData.next_predicted_date = next_predicted_date;
    }

    // Update the tagged merchant
    const { data, error } = await supabase
      .from('tagged_merchants')
      .update(updateData)
      .eq('id', merchantId)
      .eq('user_id', user.id) // Ensure user can only update their own merchants
      .select()
      .single();

    if (error) {
      console.error('Error updating tagged merchant:', error);
      
      // Handle specific error cases
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'An account with this name already exists for this merchant. Please choose a different name.' 
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to update tagged merchant: ' + (error.message || 'Unknown error')
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        error: 'Tagged merchant not found or access denied' 
      }, { status: 404 });
    }

    console.log(`✅ Successfully updated merchant ${merchantId}: ${data.merchant_name}`, {
      account_identifier: data.account_identifier,
      expected_amount: data.expected_amount,
      is_active: data.is_active
    });

    return NextResponse.json({ 
      success: true, 
      message: `Successfully updated ${data.merchant_name}`,
      taggedMerchant: data 
    });

  } catch (error) {
    console.error('Tagged merchant PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: merchantId } = await params;

    // Get merchant name before deletion for response message
    const { data: merchantData } = await supabase
      .from('tagged_merchants')
      .select('merchant_name')
      .eq('id', merchantId)
      .eq('user_id', user.id)
      .single();

    // Delete the tagged merchant
    const { error } = await supabase
      .from('tagged_merchants')
      .delete()
      .eq('id', merchantId)
      .eq('user_id', user.id); // Ensure user can only delete their own merchants

    if (error) {
      console.error('Error deleting tagged merchant:', error);
      return NextResponse.json({ 
        error: 'Failed to delete tagged merchant' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully removed ${merchantData?.merchant_name || 'merchant'} from recurring bills`
    });

  } catch (error) {
    console.error('Tagged merchant DELETE error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 