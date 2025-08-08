const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function updateSendTime() {
  console.log('Updating send_time from 07:00:00 to 12:00:00...');
  
  try {
    // Update send_time for all users
    const { data, error } = await supabase
      .from('user_sms_settings')
      .update({ send_time: '12:00:00' })
      .eq('send_time', '07:00:00')
      .select();
    
    if (error) {
      console.error('Update failed:', error);
      return;
    }
    
    console.log('Update successful!');
    console.log('Updated records:', data);
    
    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_sms_settings')
      .select('user_id, send_time');
    
    if (verifyError) {
      console.error('Verification failed:', verifyError);
      return;
    }
    
    console.log('Current user_sms_settings:', verifyData);
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

updateSendTime(); 