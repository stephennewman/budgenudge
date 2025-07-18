const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addPhoneColumn() {
  console.log('Adding phone_number column to user_sms_settings...');
  
  try {
    // Add the phone_number column
    const { error: alterError } = await supabase
      .from('user_sms_settings')
      .select('*')
      .limit(1)
      .then(() => {
        // If we can select, the table exists, now try to add column
        return supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE user_sms_settings ADD COLUMN phone_number VARCHAR(20);'
        });
      });
    
    if (alterError) {
      console.log('Column might already exist or RPC not available, trying direct approach...');
      
      // Try a different approach - update with phone_number field
      const { data, error } = await supabase
        .from('user_sms_settings')
        .update({ phone_number: '+16173472721' })
        .eq('user_id', 'bc474c8b-4b47-4c7d-b202-f469330af2a2')
        .select();
      
      if (error && error.message.includes('phone_number')) {
        console.log('Column does not exist. Need to add it manually in Supabase dashboard.');
        console.log('Please run this SQL in your Supabase SQL editor:');
        console.log(`
ALTER TABLE user_sms_settings ADD COLUMN phone_number VARCHAR(20);

UPDATE user_sms_settings 
SET phone_number = '+16173472721' 
WHERE user_id = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';

UPDATE user_sms_settings 
SET phone_number = NULL 
WHERE user_id != 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
        `);
        return;
      }
      
      if (error) {
        console.error('Error updating:', error);
        return;
      }
      
      console.log('✅ Phone numbers updated successfully:', data);
    } else {
      console.log('✅ Column added successfully');
      
      // Now set the phone numbers
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
    }

    // Verify the results
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

addPhoneColumn(); 