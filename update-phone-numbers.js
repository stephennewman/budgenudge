require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updatePhoneNumbers() {
  console.log('📱 Updating phone numbers and send time in user_sms_settings...');

  try {
    // Update User 1 (stephen@krezzo.com) with phone number and 1:45 PM send time
    const { data: user1Update, error: user1Error } = await supabase
      .from('user_sms_settings')
      .update({ 
        phone_number: '+16173472721',
        send_time: '13:45' // 1:45 PM ET
      })
      .eq('user_id', 'bc474c8b-4b47-4c7d-b202-f469330af2a2')
      .select();

    if (user1Error) {
      console.error('Error updating User 1:', user1Error);
    } else {
      console.log('✅ Updated User 1 phone number and send time:', user1Update);
    }

    // Update User 2 (rakiveb524@dxirl.com) - leave blank for now
    const { data: user2Update, error: user2Error } = await supabase
      .from('user_sms_settings')
      .update({ phone_number: null })
      .eq('user_id', '72346277-b86c-4069-9829-fb524b86b2e0')
      .select();

    if (user2Error) {
      console.error('Error updating User 2:', user2Error);
    } else {
      console.log('✅ Updated User 2 phone number (set to null):', user2Update);
    }

    // Verify all user_sms_settings
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_sms_settings')
      .select('*');

    if (verifyError) {
      console.error('Error verifying data:', verifyError);
    } else {
      console.log('📊 All user_sms_settings:', verifyData);
    }

  } catch (error) {
    console.error('❌ Error updating phone numbers:', error);
  }
}

updatePhoneNumbers(); 