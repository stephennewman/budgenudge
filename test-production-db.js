const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testProductionDB() {
  console.log('Testing production Supabase database...');
  console.log('URL:', supabaseUrl);
  console.log('Service Role Key present:', !!serviceRoleKey);
  
  try {
    // Test 1: Count all items
    const { count, error: countError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });
    
    console.log('Count result:', { count, countError });
    
    // Test 2: Get all items
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id, status');
    
    console.log('Items result:', { 
      itemsCount: items?.length || 0, 
      items: items?.slice(0, 2), // Show first 2 items
      itemsError 
    });
    
    // Test 3: Check if we can access other tables
    const { data: users, error: usersError } = await supabase
      .from('user_sms_settings')
      .select('user_id, send_time')
      .limit(5);
    
    console.log('User SMS settings result:', { 
      usersCount: users?.length || 0, 
      users: users?.slice(0, 2),
      usersError 
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testProductionDB(); 