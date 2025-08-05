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
    
    // Log the full contact data for now (until we add proper columns)
    console.log('📊 Contact Data Details:', {
      phone: cleanPhone,
      email: email || 'not-provided',
      firstName: firstName || 'not-provided', 
      lastName: lastName || 'not-provided',
      timestamp: new Date().toISOString()
    });
    
    // Generate tracking token
    const trackingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store additional contact data in a way that works with current schema
    // Keep source field short due to VARCHAR(50) limit
    const enhancedSource = `slicktext_form`;
    
    // Store in database with all contact fields
    const { data, error } = await supabase
      .from('sample_sms_leads')
      .insert({
        phone_number: cleanPhone,
        first_name: firstName,
        last_name: lastName,
        email: email,
        source: enhancedSource,
        tracking_token: trackingToken,
        opted_in_at: new Date().toISOString(),
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