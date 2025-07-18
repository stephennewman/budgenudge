const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setupPhoneNumbers() {
  console.log('Setting up phone numbers for users...');
  
  try {
    // First, add phone_number column if it doesn't exist
    console.log('Adding phone_number column to user_sms_settings...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE user_sms_settings ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);'
    });
    
    if (alterError) {
      console.log('Column might already exist, continuing...');
    }

    // Set phone number for first user
    console.log('Setting phone number for first user...');
    const { data: update1, error: error1 } = await supabase
      .from('user_sms_settings')
      .update({ phone_number: '+16173472721' })
      .eq('user_id', 'bc474c8b-4b47-4c7d-b202-f469330af2a2')
      .select();
    
    if (error1) {
      console.error('Error updating first user:', error1);
    } else {
      console.log('✅ First user phone number set:', update1);
    }

    // Ensure second user has no phone number (blank)
    console.log('Ensuring second user has no phone number...');
    const { data: update2, error: error2 } = await supabase
      .from('user_sms_settings')
      .update({ phone_number: null })
      .neq('user_id', 'bc474c8b-4b47-4c7d-b202-f469330af2a2')
      .select();
    
    if (error2) {
      console.error('Error updating second user:', error2);
    } else {
      console.log('✅ Second user phone number cleared:', update2);
    }

    // Verify all settings
    console.log('Verifying all user_sms_settings...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_sms_settings')
      .select('user_id, send_time, phone_number');
    
    if (verifyError) {
      console.error('Verification failed:', verifyError);
      return;
    }
    
    console.log('📋 All user_sms_settings:');
    verifyData.forEach(setting => {
      console.log(`  User ${setting.user_id}: send_time=${setting.send_time}, phone=${setting.phone_number || 'BLANK'}`);
    });
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

setupPhoneNumbers(); 