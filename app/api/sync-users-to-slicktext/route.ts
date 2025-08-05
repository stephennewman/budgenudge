import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { user_email_filter, limit = 10 } = await request.json();
    
    console.log('🔄 Starting batch sync of users to SlickText...');

    // Get users who have phone numbers but haven't been synced to SlickText
    let query = supabase
      .from('user_sms_settings')
      .select(`
        user_id,
        phone_number,
        created_at
      `)
      .not('phone_number', 'is', null)
      .limit(limit);

    if (user_email_filter) {
      // If specific email provided, get that user
      const { data: authUser } = await supabase.auth.admin.listUsers();
      const targetUser = authUser.users.find(u => u.email === user_email_filter);
      if (targetUser) {
        query = query.eq('user_id', targetUser.id);
      }
    }

    const { data: smsUsers, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!smsUsers || smsUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users found with phone numbers to sync',
        synced: 0
      });
    }

    console.log(`📱 Found ${smsUsers.length} users to potentially sync to SlickText`);

    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const smsUser of smsUsers) {
      try {
        // Get user details from auth
        const { data: authUser } = await supabase.auth.admin.getUserById(smsUser.user_id);
        
        if (!authUser.user?.email) {
          console.log(`⚠️ Skipping user ${smsUser.user_id} - no email`);
          skipCount++;
          continue;
        }

        // Check if already synced by looking for SlickText subscription record
        const { data: existingSync } = await supabase
          .from('sample_sms_leads')
          .select('id')
          .eq('phone_number', smsUser.phone_number)
          .eq('source', 'webapp_signup_to_slicktext')
          .single();

        if (existingSync) {
          console.log(`⏭️ User ${authUser.user.email} already synced to SlickText`);
          skipCount++;
          continue;
        }

        // Sync to SlickText
        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/add-user-to-slicktext`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: smsUser.user_id,
            email: authUser.user.email,
            phone: smsUser.phone_number,
            first_name: authUser.user.user_metadata?.full_name?.split(' ')[0] || authUser.user.user_metadata?.first_name || 'Krezzo',
            last_name: authUser.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || authUser.user.user_metadata?.last_name || 'User'
          })
        });

        const syncResult = await syncResponse.json();
        
        if (syncResponse.ok && syncResult.success) {
          console.log(`✅ Synced ${authUser.user.email} to SlickText`);
          successCount++;
          results.push({
            user_id: smsUser.user_id,
            email: authUser.user.email,
            phone: smsUser.phone_number,
            status: 'success',
            slicktext_contact_id: syncResult.slicktext_contact_id
          });
        } else {
          console.log(`❌ Failed to sync ${authUser.user.email}:`, syncResult.error);
          errorCount++;
          results.push({
            user_id: smsUser.user_id,
            email: authUser.user.email,
            phone: smsUser.phone_number,
            status: 'error',
            error: syncResult.error
          });
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (userError) {
        console.error(`❌ Error processing user ${smsUser.user_id}:`, userError);
        errorCount++;
        results.push({
          user_id: smsUser.user_id,
          status: 'error',
          error: userError instanceof Error ? userError.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 Batch sync completed: ${successCount} success, ${skipCount} skipped, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: 'Batch sync to SlickText completed',
      summary: {
        total_processed: smsUsers.length,
        successful: successCount,
        skipped: skipCount,
        errors: errorCount
      },
      results: results
    });

  } catch (error) {
    console.error('❌ Batch sync error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch sync failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}