import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { generateSMSMessage } from '@/utils/sms/templates';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolveUserPhone(userId?: string, provided?: string): Promise<string | null> {
  if (provided && provided.trim() !== '') return provided;
  if (!userId) return null;

  // Try user_sms_settings.phone_number
  const { data: settings } = await supabase
    .from('user_sms_settings')
    .select('phone_number')
    .eq('user_id', userId)
    .single();
  if (settings?.phone_number) return settings.phone_number;

  // Fallback to auth.users phone or signupPhone metadata
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const meta = authUser.user?.user_metadata as Record<string, unknown> | undefined;
  const signupPhone = (meta?.signupPhone as string | undefined) || (meta?.phone as string | undefined);
  return authUser.user?.phone || signupPhone || null;
}

export async function POST(request: NextRequest) {
  try {
    const { message, phoneNumber, scheduledTime, userId, templateType } = await request.json();

    // Resolve primary phone
    const targetPhoneNumber = await resolveUserPhone(userId, phoneNumber);
    if (!targetPhoneNumber) {
      return NextResponse.json({ success: false, error: 'No phone number found for user' }, { status: 400 });
    }

    let smsMessage = message || `🔔 MANUAL SMS - Krezzo Alert!\n\nTriggered at: ${new Date().toLocaleString()}\n\nThis is a test message from your Krezzo app.`;
    let transactionsText = '';

    if (userId && templateType && ['recurring','recent','merchant-pacing','category-pacing','weekly-summary','monthly-summary','cash-flow-runway','415pm-special'].includes(templateType)) {
      smsMessage = await generateSMSMessage(userId, templateType);
    } else if (userId && !message) {
      const { data: userItems } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (userItems && userItems.length > 0) {
        const itemIds = userItems.map(item => item.plaid_item_id);
        const { data: transactions } = await supabase
          .from('transactions')
          .select('date, merchant_name, name, amount')
          .in('plaid_item_id', itemIds)
          .order('date', { ascending: false })
          .limit(10);
        if (transactions && transactions.length > 0) {
          transactionsText = '\n\nRecent Transactions:';
          transactions.forEach(t => {
            const date = t.date;
            const merchant = (t.merchant_name || t.name).substring(0, 18);
            const amount = t.amount.toFixed(2);
            transactionsText += `\n${date}: ${merchant} - $${amount}`;
          });
          smsMessage += transactionsText;
        }
      }
    }

    if (scheduledTime) {
      if (!userId) {
        return NextResponse.json({ success: false, error: 'User ID required for scheduled messages' }, { status: 400 });
      }
      // For now we don’t persist scheduled messages in manual path
      return NextResponse.json({ success: true, scheduled: true });
    }

    // Send via SlickText to maximize deliverability (auto-creates contact)
    const sendResult = await sendEnhancedSlickTextSMS({ phoneNumber: targetPhoneNumber, message: smsMessage, userId });

    // Fan-out to additional recipient if configured
    let additionalSent = false;
    try {
      if (userId) {
        const { data: settings } = await supabase
          .from('user_sms_settings')
          .select('additional_phone')
          .eq('user_id', userId)
          .single();
        const additionalPhone = (settings as { additional_phone?: string } | null)?.additional_phone ?? null;
        if (additionalPhone && additionalPhone.trim() !== '') {
          const addResult = await sendEnhancedSlickTextSMS({ phoneNumber: additionalPhone, message: smsMessage, userId });
          additionalSent = !!addResult.success;
        }
      }
    } catch (e) {
      console.warn('manual-sms: additional recipient send skipped due to error', e);
    }

    return NextResponse.json({ success: true, sent: !!sendResult.success, sendResult, additionalSent });
  } catch (error) {
    console.error('Error in manual-sms POST:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
