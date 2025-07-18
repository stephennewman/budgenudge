const { createClient } = require('@supabase/supabase-js');

// Production Supabase credentials
const supabaseUrl = 'https://oexkzqvoepdeywlyfsdj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leGt6cXZvZXBkZXl3bHlmc2RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDI3NjMwOCwiZXhwIjoyMDY1ODUyMzA4fQ.e6qBDSRAbVlUjs7vjdOJct-G1t_uYgB3L_uS5VnWaAw';

// Create client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setupAuthPhoneNumbers() {
  console.log('Setting up phone numbers in auth.users table...');
  
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    console.log(`Found ${users.users.length} users in auth.users`);

    // Find the first user (bc474c8b-4b47-4c7d-b202-f469330af2a2)
    const firstUser = users.users.find(user => user.id === 'bc474c8b-4b47-4c7d-b202-f469330af2a2');
    const otherUsers = users.users.filter(user => user.id !== 'bc474c8b-4b47-4c7d-b202-f469330af2a2');

    // Set phone number for first user
    if (firstUser) {
      console.log('Setting phone number for first user...');
      const { data: update1, error: error1 } = await supabase.auth.admin.updateUserById(
        'bc474c8b-4b47-4c7d-b202-f469330af2a2',
        {
          user_metadata: {
            ...firstUser.user_metadata,
            phone: '+16173472721'
          }
        }
      );
      
      if (error1) {
        console.error('Error updating first user:', error1);
      } else {
        console.log('✅ First user phone number set:', update1.user?.user_metadata?.phone);
      }
    } else {
      console.log('❌ First user not found');
    }

    // Clear phone numbers for other users
    for (const user of otherUsers) {
      console.log(`Clearing phone number for user ${user.id}...`);
      const { data: update, error } = await supabase.auth.admin.updateUserById(
        user.id,
        {
          user_metadata: {
            ...user.user_metadata,
            phone: null
          }
        }
      );
      
      if (error) {
        console.error(`Error updating user ${user.id}:`, error);
      } else {
        console.log(`✅ User ${user.id} phone number cleared`);
      }
    }

    // Verify the results
    console.log('Verifying all users...');
    const { data: verifyUsers, error: verifyError } = await supabase.auth.admin.listUsers();
    
    if (verifyError) {
      console.error('Verification failed:', verifyError);
      return;
    }
    
    console.log('📋 All users in auth.users:');
    verifyUsers.users.forEach(user => {
      const phone = user.user_metadata?.phone || 'BLANK';
      console.log(`  User ${user.id}: email=${user.email}, phone=${phone}`);
    });
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

setupAuthPhoneNumbers(); 