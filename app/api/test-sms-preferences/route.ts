import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('🧪 Testing SMS preferences system...');
    
    // Test 1: Check if table exists and is accessible
    const { error: tableError } = await supabase
      .from('user_sms_preferences')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Table access error:', tableError);
      return NextResponse.json({ 
        success: false, 
        error: 'Table access failed',
        details: tableError
      });
    }

    console.log('✅ Table exists and is accessible');

    // Test 2: Check all records in table
    const { data: allPrefs, error: allError } = await supabase
      .from('user_sms_preferences')
      .select('*');

    if (allError) {
      console.error('❌ Query error:', allError);
      return NextResponse.json({ 
        success: false, 
        error: 'Query failed',
        details: allError
      });
    }

    console.log(`📊 Found ${allPrefs?.length || 0} SMS preferences in database`);

    // Test 3: Get all users with items
    const { data: itemsWithUsers, error: itemsError } = await supabase
      .from('items')
      .select('user_id')
      .limit(5);

    if (itemsError) {
      console.error('❌ Items query error:', itemsError);
    }

    console.log(`👥 Found ${itemsWithUsers?.length || 0} users with items`);

    // Test 4: Try to create default preferences for a test user
    const testUserId = itemsWithUsers?.[0]?.user_id;
    if (testUserId) {
      const defaultPreferences = [
        { user_id: testUserId, sms_type: 'bills', enabled: true, frequency: 'daily' },
        { user_id: testUserId, sms_type: 'spending', enabled: true, frequency: 'daily' },
        { user_id: testUserId, sms_type: 'activity', enabled: true, frequency: 'daily' }
      ];

      const { data: createdPrefs, error: createError } = await supabase
        .from('user_sms_preferences')
        .upsert(defaultPreferences, { onConflict: 'user_id,sms_type' })
        .select();

      if (createError) {
        console.error('❌ Create preferences error:', createError);
      } else {
        console.log(`✅ Created/updated ${createdPrefs?.length || 0} preferences for test user`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'SMS preferences test completed',
      results: {
        tableAccessible: !tableError,
        totalPreferences: allPrefs?.length || 0,
        usersWithItems: itemsWithUsers?.length || 0,
        testUserId: testUserId || 'none',
        allPreferences: allPrefs || [],
        sampleUsers: itemsWithUsers || []
      }
    });

  } catch (error) {
    console.error('🚨 SMS preferences test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 