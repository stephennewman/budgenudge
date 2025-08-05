import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, email, firstName, lastName } = await request.json();
    
    console.log('📱 SlickText Java Form capture:', { phoneNumber, email, firstName, lastName });
    
    // Clean phone number
    const cleanPhone = phoneNumber?.replace(/\D/g, '');
    
    // Generate tracking token
    const trackingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store in database
    const { data, error } = await supabase
      .from('sample_sms_leads')
      .insert({
        phone_number: cleanPhone,
        email: email,
        first_name: firstName,
        last_name: lastName,
        source: 'slicktext_java_form',
        tracking_token: trackingToken,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    console.log('✅ Successfully captured lead:', data);
    
    return NextResponse.json({ 
      success: true, 
      trackingToken,
      message: 'Lead captured successfully' 
    });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}