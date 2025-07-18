const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testPhoneLookup() {
  console.log('Testing phone number lookup from auth.users...');
  
  try {
    const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    
    // Test 1: Get user by ID
    console.log('Test 1: Getting user by ID...');
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }
    
    console.log('User data:', {
      id: userData.user?.id,
      email: userData.user?.email,
      user_metadata: userData.user?.user_metadata,
      phone: userData.user?.user_metadata?.phone
    });

    // Test 2: List all users
    console.log('\nTest 2: Listing all users...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error listing users:', usersError);
      return;
    }

    console.log('All users:');
    users.users.forEach(user => {
      console.log(`  ${user.id}: ${user.email} - phone: ${user.user_metadata?.phone || 'BLANK'}`);
    });

    // Test 3: Simulate cron job logic
    console.log('\nTest 3: Simulating cron job phone lookup...');
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('id, user_id, plaid_item_id');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return;
    }

    console.log(`Found ${itemsWithUsers.length} items with users`);

    for (const userItem of itemsWithUsers) {
      const userId = userItem.user_id;
      console.log(`\nProcessing user ${userId}...`);
      
      // Get phone number from auth.users table (same as cron job)
      const { data: userData2, error: userError2 } = await supabase.auth.admin.getUserById(userId);
      if (userError2) {
        console.error(`Error fetching user ${userId}:`, userError2);
        continue;
      }
      
      const userPhoneNumber = userData2?.user?.user_metadata?.phone;
      console.log(`  Phone number found: ${userPhoneNumber || 'BLANK'}`);
      
      if (!userPhoneNumber || userPhoneNumber.trim() === '') {
        console.log(`  ❌ Would skip user ${userId} (no phone number)`);
      } else {
        console.log(`  ✅ Would send SMS to user ${userId} at ${userPhoneNumber}`);
      }
    }
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

testPhoneLookup(); 