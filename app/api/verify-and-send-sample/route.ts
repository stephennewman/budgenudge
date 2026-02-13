import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient } from '@/utils/sms/slicktext-client';
import { createClient } from '@supabase/supabase-js';

// Create admin Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAMPLE_SMS_CONTENT = `📊 SAMPLE FINANCIAL ANALYSIS
July 2025

💰 Available Balance: $3,083.26

💳 This Month: $1,247.89
📈 25 transactions
📈 18% more than last month

🏷️ Top Categories:
1. Groceries: $347 (28%)
2. Restaurant: $286 (23%) 
3. Gas: $134 (11%)

🏪 Top Merchants:
1. Publix: $234
2. Starbucks: $89
3. Shell: $67

Want to see YOUR real data? 
👉 get.krezzo.com/sign-up

Reply STOP to opt-out`;

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, code } = await request.json();

    if (!phoneNumber || !code) {
      return NextResponse.json({ error: 'Phone number and code are required' }, { status: 400 });
    }

    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Verify the code
    const { data: verificationData, error: verifyError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('phone_number', cleanPhone)
      .eq('code', code)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (verifyError || !verificationData) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // Send sample SMS via SlickText
    const client = createSlickTextClient();
    const smsResult = await client.sendSMS({
      content: SAMPLE_SMS_CONTENT,
      phone_numbers: [`+1${cleanPhone}`]
    });

    if (!smsResult.success) {
      console.error('Failed to send sample SMS:', smsResult.error);
      return NextResponse.json({ error: 'Failed to send sample SMS' }, { status: 500 });
    }

    // Generate tracking token for this lead
    const trackingToken = crypto.randomUUID();
    
    // Store lead in database with tracking token
    const { error: leadError } = await supabase
      .from('sample_sms_leads')
      .insert({
        phone_number: cleanPhone,
        tracking_token: trackingToken,
        source: 'sample_sms_demo',
        opted_in_at: new Date().toISOString(),
        verified: true,
        sample_sent: true
      });

    if (leadError) {
      console.warn('Failed to store lead (non-blocking):', leadError);
    }

    // Delete used verification code
    await supabase
      .from('verification_codes')
      .delete()
      .eq('phone_number', cleanPhone);

    return NextResponse.json({ 
      success: true, 
      message: 'Sample SMS sent successfully',
      trackingToken // Return token to set in browser
    });

  } catch (error) {
    console.error('Error in verify-and-send-sample:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}