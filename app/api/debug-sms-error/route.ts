import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient } from '@/utils/sms/slicktext-client';

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

    // Test SMS via SlickText
    const client = createSlickTextClient();
    const smsResult = await client.sendSMS({
      content: `DEBUG: Test message for ${cleanPhone}`,
      phone_numbers: [`+1${cleanPhone}`]
    });

    // Return full response for debugging
    return NextResponse.json({ 
      phoneNumber: cleanPhone,
      formattedNumber: `+1${cleanPhone}`,
      smsResult: smsResult,
      success: smsResult.success,
      error: smsResult.error || null
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}