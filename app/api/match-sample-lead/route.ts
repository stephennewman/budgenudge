import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Matches a user with their sample SMS lead when they add phone number to account
 * Called when users set up SMS preferences or add phone to profile
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, phoneNumber } = await request.json();

    if (!userId || !phoneNumber) {
      return NextResponse.json({ error: 'User ID and phone number are required' }, { status: 400 });
    }

    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Check if there's a sample SMS lead for this phone number
    const { data: lead, error: leadError } = await supabase
      .from('sample_sms_leads')
      .select('*')
      .eq('phone_number', cleanPhone)
      .eq('converted_to_signup', false)
      .single();

    if (leadError || !lead) {
      console.log('No matching sample SMS lead found for:', cleanPhone);
      return NextResponse.json({ 
        success: true, 
        matched: false,
        message: 'No sample SMS lead to match'
      });
    }

    // Update the lead to mark as converted
    const { error: updateError } = await supabase
      .from('sample_sms_leads')
      .update({
        converted_to_signup: true,
        conversion_date: new Date().toISOString(),
        user_id: userId  // Add this field to track which user converted
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error('Error updating sample lead:', updateError);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    console.log('✅ Sample SMS lead matched to user:', {
      leadId: lead.id,
      userId,
      phoneNumber: cleanPhone,
      originalDate: lead.created_at
    });

    return NextResponse.json({ 
      success: true, 
      matched: true,
      leadData: {
        originalOptInDate: lead.created_at,
        daysToConversion: Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
      }
    });

  } catch (error) {
    console.error('Error in match-sample-lead:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}