const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addMissingUser() {
  console.log('Adding missing user_sms_settings for second user...');
  
  try {
    // Add SMS settings for the second user
    const { data, error } = await supabase
      .from('user_sms_settings')
      .insert({
        user_id: '72346277-b86c-4069-9829-fb524b86b2e0',
        send_time: '12:00:00'
      })
      .select();
    
    if (error) {
      console.error('Insert failed:', error);
      return;
    }
    
    console.log('Insert successful!');
    console.log('Added record:', data);
    
    // Verify all users now have settings
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_sms_settings')
      .select('user_id, send_time');
    
    if (verifyError) {
      console.error('Verification failed:', verifyError);
      return;
    }
    
    console.log('All user_sms_settings:', verifyData);
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

addMissingUser(); 