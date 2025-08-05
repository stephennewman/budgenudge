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
    
    // Store additional contact data in a way that works with current schema
    const enhancedSource = `slicktext_java_form:${firstName || 'Unknown'}:${lastName || 'Unknown'}:${email || 'no-email'}`;
    
    // Store in database (only fields that exist in current schema)
    const { data, error } = await supabase
      .from('sample_sms_leads')
      .insert({
        phone_number: cleanPhone,
        source: enhancedSource, // Store contact data in source field for now
        tracking_token: trackingToken,
        opted_in_at: new Date().toISOString(),
        // Note: email, first_name, last_name will be added via migration
        // For now, storing as enhanced source field with format:
        // slicktext_java_form:FirstName:LastName:email@example.com
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database error details:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json({ 
        error: 'Database error', 
        details: error.message,
        code: error.code 
      }, { status: 500 });
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