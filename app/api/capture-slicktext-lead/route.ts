import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ORIGINS = [
  'https://get.krezzo.com',
  'https://krezzo.com',
  process.env.NEXT_PUBLIC_SITE_URL,
].filter(Boolean);

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  try {
    const { phoneNumber, email, firstName, lastName } = await request.json();
    
    // Clean phone number
    const cleanPhone = phoneNumber?.replace(/\D/g, '');
    
    // Generate tracking token
    const trackingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store in database with all contact fields
    const { error } = await supabase
      .from('sample_sms_leads')
      .insert({
        phone_number: cleanPhone,
        first_name: firstName,
        last_name: lastName,
        email: email,
        source: 'slicktext_form',
        tracking_token: trackingToken,
        opted_in_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Lead capture DB error:', error.message);
      return NextResponse.json({ 
        error: 'Database error', 
        details: error.message,
        code: error.code 
      }, { status: 500, headers: corsHeaders });
    }
    
    return NextResponse.json({ 
      success: true, 
      trackingToken,
      message: 'Lead captured successfully' 
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: getCorsHeaders(request) });
}