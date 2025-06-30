import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Starting scheduled SMS processing...');
    
    // Get the current time and add 1 minute buffer for processing
    const now = new Date();
    const processingTime = new Date(now.getTime() + 60000); // 1 minute from now
    
    console.log(`⏰ Cron Job Timezone Info:
      - Server Time (UTC): ${now.toISOString()}
      - Server Time (Local): ${now.toLocaleString()}
      - Processing Window: Messages scheduled before ${processingTime.toISOString()}
    `);
    
    // Find all pending SMS messages that should be sent
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_sms')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', processingTime.toISOString())
      .order('scheduled_time', { ascending: true });

    if (fetchError) {
      console.error('Error fetching scheduled messages:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch scheduled messages' 
      }, { status: 500 });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('📭 No scheduled messages to process');
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No scheduled messages to process' 
      });
    }

    console.log(`📨 Found ${pendingMessages.length} messages to process`);
    
    let successCount = 0;
    let failureCount = 0;

    // Process each scheduled message
    for (const message of pendingMessages) {
      try {
        // Send SMS via Resend API
        const smsResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'BudgeNudge <noreply@krezzo.com>',
            to: [message.phone_number],
            subject: 'BudgeNudge Scheduled Alert!',
            text: message.message
          }),
        });

        if (smsResponse.ok) {
          // Mark as sent
          await supabase
            .from('scheduled_sms')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);

          console.log(`✅ Scheduled SMS sent successfully: ${message.id}`);
          successCount++;
        } else {
          const errorText = await smsResponse.text();
          
          // Mark as failed
          await supabase
            .from('scheduled_sms')
            .update({
              status: 'failed',
              error_message: errorText,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);

          console.log(`❌ Scheduled SMS failed: ${message.id} - ${errorText}`);
          failureCount++;
        }
      } catch (error) {
        // Mark as failed with error
        await supabase
          .from('scheduled_sms')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        console.log(`❌ Scheduled SMS error: ${message.id} - ${error}`);
        failureCount++;
      }
    }

    console.log(`📊 Scheduled SMS processing complete: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({ 
      success: true, 
      processed: pendingMessages.length,
      sent: successCount,
      failed: failureCount,
      message: `Processed ${pendingMessages.length} scheduled messages`
    });

  } catch (error) {
    console.error('🚨 Scheduled SMS processing error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error during scheduled SMS processing' 
    }, { status: 500 });
  }
}

// Handle authorization for cron jobs
export async function POST(request: NextRequest) {
  // Vercel Cron jobs use POST with authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return GET(request);
} 