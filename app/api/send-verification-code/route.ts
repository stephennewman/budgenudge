import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient } from '@/utils/sms/slicktext-client';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client for storing verification codes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Clean phone number (remove formatting)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // Generate 4-digit verification code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store verification code in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    const { error: storeError } = await supabase
      .from('verification_codes')
      .upsert({
        phone_number: cleanPhone,
        code: code,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'phone_number'
      });

    if (storeError) {
      console.error('Error storing verification code:', storeError);
      return NextResponse.json({ error: 'Failed to store verification code' }, { status: 500 });
    }

    // Send SMS via SlickText
    const client = createSlickTextClient();
    const smsResult = await client.sendSMS({
      content: `Krezzo verification code: ${code}

Enter this code to get your sample financial analysis.
Msg&data rates apply. Reply STOP to opt-out.`,
      phone_numbers: [`+1${cleanPhone}`]
    });

    if (!smsResult.success) {
      console.error('Failed to send SMS:', smsResult.error);
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }

    console.log('✅ Verification code sent successfully to:', cleanPhone);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent successfully' 
    });

  } catch (error) {
    console.error('Error in send-verification-code:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}