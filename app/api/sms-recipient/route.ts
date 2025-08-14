import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/utils/supabase/server';
import { checkAndLogSMS } from '@/utils/sms/deduplication';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';

// Minimal API: upsert additional phone on user_sms_settings
export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
    }

    // Normalize: keep digits, allow +1 prefix
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 11 && clean.startsWith('1')) clean = clean.substring(1);
    if (clean.length !== 10) {
      return NextResponse.json({ error: 'Invalid US phone' }, { status: 400 });
    }

    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Service role for DB write
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: upsertError } = await svc
      .from('user_sms_settings')
      .upsert({
        user_id: user.id,
        additional_phone: clean
      }, { onConflict: 'user_id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Send immediate confirmation via SlickText with dedupe isolation
    const dedupe = await checkAndLogSMS({
      phoneNumber: clean,
      templateType: 'onboarding-immediate',
      userId: user.id,
      sourceEndpoint: 'manual',
      success: true,
      dedupeKeyOverride: `onboarding-immediate|subject:${String(user.id).slice(0,8)}`
    });

    if (dedupe.canSend) {
      const message = `You’re subscribed to Krezzo daily texts. You’ll start receiving updates at 5 PM ET. Reply STOP to opt out.`;
      await sendEnhancedSlickTextSMS({
        phoneNumber: clean,
        message,
        userId: user.id
      });
    }

    return NextResponse.json({ success: true, confirmationSent: dedupe.canSend });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Read current additional recipient status for the signed-in user
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await svc
      .from('user_sms_settings')
      .select('additional_phone')
      .eq('user_id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const additional_phone = data?.additional_phone || null;
    const masked = additional_phone ? `***${String(additional_phone).slice(-4)}` : null;
    return NextResponse.json({ additional_phone: masked, raw_present: !!additional_phone });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


