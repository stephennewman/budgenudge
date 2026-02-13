import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendUnifiedSMS } from '@/utils/sms/unified-sms';
import { generateSMSMessage } from '@/utils/sms/templates';
import { canSendSMS, logSMSSend } from '@/utils/sms/deduplication';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OnboardingSequenceRequest {
  userId: string;
  phoneNumber: string;
  firstName?: string;
}

interface OnboardingResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  scheduled?: boolean;
  scheduledAt?: string;
  messageId?: string;
  error?: string;
}

/**
 * Orchestrates the complete onboarding SMS sequence after bank connection
 * Message 1: Immediate (within 2 minutes)
 * Message 2: Analysis complete (5-10 minutes after Message 1)
 * Message 3: Day before first daily SMS (next evening)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, phoneNumber }: OnboardingSequenceRequest = await request.json();

    if (!userId || !phoneNumber) {
      return NextResponse.json(
        { error: 'userId and phoneNumber are required' },
        { status: 400 }
      );
    }

    // Clean phone number for SMS
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const results = {
      immediate: null as OnboardingResult | null,
      analysisComplete: null as OnboardingResult | null,
      dayBefore: null as OnboardingResult | null,
      sequenceId: `onboarding_${userId}_${Date.now()}`
    };

    // ===================================
    // MESSAGE 1: IMMEDIATE WELCOME
    // ===================================
    try {
      // Check deduplication
      const immediateCheck = await canSendSMS(cleanPhone, 'onboarding-immediate');
      if (!immediateCheck.canSend) {
        results.immediate = { skipped: true, reason: immediateCheck.reason };
      } else {
        // Generate and send immediate message
        const immediateMessage = await generateSMSMessage(userId, 'onboarding-immediate');
        
        const immediateResult = await sendUnifiedSMS({
          phoneNumber: cleanPhone,
          message: immediateMessage,
          userId: userId,
          userEmail: '', // Will be resolved by SMS service
          context: 'onboarding_immediate'
        });

        // Log the send attempt
        await logSMSSend({
          phoneNumber: cleanPhone,
          templateType: 'onboarding-immediate',
          userId: userId,
          sourceEndpoint: 'manual',
          messageId: immediateResult.messageId,
          success: immediateResult.success
        });

        results.immediate = immediateResult;
      }
    } catch (error) {
      console.error('❌ Error sending immediate message:', error);
      results.immediate = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // ===================================
    // MESSAGE 2: ANALYSIS COMPLETE (Scheduled)
    // ===================================
    try {
      // Schedule message for 8 minutes from now (gives AI time to complete)
      const analysisCompleteTime = new Date(Date.now() + 8 * 60 * 1000); // 8 minutes
      
      await scheduleOnboardingMessage({
        userId,
        phoneNumber: cleanPhone,
        templateType: 'onboarding-analysis-complete',
        scheduledAt: analysisCompleteTime,
        sequenceId: results.sequenceId
      });

      results.analysisComplete = { 
        scheduled: true, 
        scheduledAt: analysisCompleteTime.toISOString() 
      };
    } catch (error) {
      console.error('❌ Error scheduling analysis complete message:', error);
      results.analysisComplete = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // ===================================
    // MESSAGE 3: DAY BEFORE (Scheduled)
    // ===================================
    try {
      // Schedule for 6 PM the same day (if after 6 PM) or next day at 6 PM
      const now = new Date();
      const todayAt6PM = new Date(now);
      todayAt6PM.setHours(18, 0, 0, 0);
      
      const dayBeforeTime = now > todayAt6PM 
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // Tomorrow at 6 PM
        : todayAt6PM; // Today at 6 PM
      
      dayBeforeTime.setHours(18, 0, 0, 0); // Ensure 6 PM

      await scheduleOnboardingMessage({
        userId,
        phoneNumber: cleanPhone,
        templateType: 'onboarding-day-before',
        scheduledAt: dayBeforeTime,
        sequenceId: results.sequenceId
      });

      results.dayBefore = { 
        scheduled: true, 
        scheduledAt: dayBeforeTime.toISOString() 
      };
    } catch (error) {
      console.error('❌ Error scheduling day-before message:', error);
      results.dayBefore = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    return NextResponse.json({
      success: true,
      sequenceId: results.sequenceId,
      results: results,
      summary: {
        immediate: results.immediate?.success ? 'sent' : 'failed',
        analysisComplete: results.analysisComplete?.scheduled ? 'scheduled' : 'failed',
        dayBefore: results.dayBefore?.scheduled ? 'scheduled' : 'failed'
      }
    });

  } catch (error) {
    console.error('❌ Error in onboarding SMS sequence:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start onboarding sequence',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Schedule a message to be sent later via database storage
 * This creates a simple scheduling mechanism using database records
 */
async function scheduleOnboardingMessage({
  userId,
  phoneNumber,
  templateType,
  scheduledAt,
  sequenceId
}: {
  userId: string;
  phoneNumber: string;
  templateType: 'onboarding-analysis-complete' | 'onboarding-day-before';
  scheduledAt: Date;
  sequenceId: string;
}) {
  // Store scheduled message in database
  // We'll use a simple table to track scheduled onboarding messages
  const { error } = await supabase
    .from('scheduled_onboarding_sms')
    .insert({
      user_id: userId,
      phone_number: phoneNumber,
      template_type: templateType,
      scheduled_at: scheduledAt.toISOString(),
      sequence_id: sequenceId,
      status: 'pending',
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error storing scheduled message:', error);
    throw new Error(`Failed to schedule ${templateType} message: ${error.message}`);
  }
}

/**
 * Process scheduled onboarding messages (called by cron job)
 */
export async function GET() {
  try {
    // Get pending messages that are due
    const now = new Date();
    const { data: pendingMessages, error } = await supabase
      .from('scheduled_onboarding_sms')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending messages:', error);
      return NextResponse.json({ error: 'Failed to fetch pending messages' }, { status: 500 });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No pending messages'
      });
    }

    const results = [];
    for (const message of pendingMessages) {
      try {
        // Check deduplication
        const canSend = await canSendSMS(message.phone_number, message.template_type);
        if (!canSend.canSend) {
          // Mark as completed (already sent)
          await supabase
            .from('scheduled_onboarding_sms')
            .update({ 
              status: 'completed',
              processed_at: new Date().toISOString(),
              result: 'already_sent'
            })
            .eq('id', message.id);

          results.push({ id: message.id, status: 'already_sent' });
          continue;
        }

        // Generate message content
        const messageContent = await generateSMSMessage(message.user_id, message.template_type);

        // Send SMS
        const smsResult = await sendUnifiedSMS({
          phoneNumber: message.phone_number,
          message: messageContent,
          userId: message.user_id,
          userEmail: '',
          context: `onboarding_${message.template_type}`
        });

        // Log the send attempt
        await logSMSSend({
          phoneNumber: message.phone_number,
          templateType: message.template_type,
          userId: message.user_id,
          sourceEndpoint: 'scheduled',
          messageId: smsResult.messageId,
          success: smsResult.success
        });

        // Update scheduled message status
        await supabase
          .from('scheduled_onboarding_sms')
          .update({ 
            status: smsResult.success ? 'completed' : 'failed',
            processed_at: new Date().toISOString(),
            result: smsResult.success ? 'sent' : 'failed',
            message_id: smsResult.messageId,
            error_details: smsResult.success ? null : smsResult.error
          })
          .eq('id', message.id);

        results.push({ 
          id: message.id, 
          status: smsResult.success ? 'sent' : 'failed',
          messageId: smsResult.messageId
        });

      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('scheduled_onboarding_sms')
          .update({ 
            status: 'failed',
            processed_at: new Date().toISOString(),
            result: 'error',
            error_details: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', message.id);

        results.push({ 
          id: message.id, 
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results: results,
      summary: {
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        already_sent: results.filter(r => r.status === 'already_sent').length,
        errors: results.filter(r => r.status === 'error').length
      }
    });

  } catch (error) {
    console.error('❌ Error processing scheduled onboarding messages:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process scheduled messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
