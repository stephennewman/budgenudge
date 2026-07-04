// Send sample texts (5 PM Krezzo Report + morning insight) to a user's primary phone.
// Bypasses the daily dedupe log so scheduled sends are unaffected.
// Usage: npx tsx scripts/send-sample-texts.mjs <user_id>
import { config } from 'dotenv';
config({ path: '.env.local' });

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx scripts/send-sample-texts.mjs <user_id>');
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: settings } = await supabase
  .from('user_sms_settings')
  .select('phone_number')
  .eq('user_id', userId)
  .single();

const phone = settings?.phone_number;
if (!phone) {
  console.error('No phone number found');
  process.exit(1);
}
console.log('Sending samples to', phone.replace(/\d(?=\d{4})/g, '*'));

const { generateDailyReportV2 } = await import('../utils/sms/template-parts/daily-report-v2.ts');
const { generateMorningInsightText } = await import('../utils/sms/morning-insights.ts');
const { sendUnifiedSMS } = await import('../utils/sms/unified-sms.ts');

const report = await generateDailyReportV2(userId);
console.log('\n--- 5 PM Krezzo Report ---\n' + report);
const r1 = await sendUnifiedSMS({ phoneNumber: phone, message: report, userId, context: 'manual-sample' });
console.log('send result:', r1.success, r1.provider, r1.error || '');

const morning = await generateMorningInsightText(userId);
console.log('\n--- Morning insight ---\n' + morning);
if (morning) {
  const r2 = await sendUnifiedSMS({ phoneNumber: phone, message: morning, userId, context: 'manual-sample' });
  console.log('send result:', r2.success, r2.provider, r2.error || '');
}
