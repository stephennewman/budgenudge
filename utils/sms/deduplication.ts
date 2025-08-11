import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type SMSTemplateType = 'recurring' | 'recent' | 'merchant-pacing' | 'category-pacing' | 
                             'weekly-summary' | 'monthly-summary' | 'cash-flow-runway' |
                             'onboarding-immediate' | 'onboarding-analysis-complete' | 'onboarding-day-before' | '415pm-special';
                             // TEMPORARILY DISABLED - Paycheck templates
                             // | 'paycheck-efficiency' | 'cash-flow-runway';

export type SMSSourceEndpoint = 'scheduled' | 'test' | 'manual' | 'webhook' | 'debug';

export interface SMSSendRecord {
  phoneNumber: string;
  templateType: SMSTemplateType;
  userId: string;
  sourceEndpoint: SMSSourceEndpoint;
  messageId?: string;
  success: boolean;
}

/**
 * Check if SMS can be sent (deduplication check)
 * Returns true if SMS can be sent, false if already sent today
 */
export async function canSendSMS(
  phoneNumber: string, 
  templateType: SMSTemplateType,
  checkDate?: Date
): Promise<{ canSend: boolean; reason?: string }> {
  try {
    const targetDate = checkDate || new Date();
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`🔍 Checking SMS deduplication: ${phoneNumber.slice(-4)} + ${templateType} on ${dateStr}`);
    
    const { data, error } = await supabase.rpc('can_send_sms', {
      p_phone_number: phoneNumber,
      p_template_type: templateType,
      p_check_date: dateStr
    });
    
    if (error) {
      console.error('❌ Error checking SMS deduplication:', error);
      // Fail safe - allow send if deduplication check fails
      return { canSend: true, reason: 'Deduplication check failed, allowing send' };
    }
    
    const canSend = data === true;
    const reason = canSend ? undefined : `Already sent ${templateType} to ${phoneNumber.slice(-4)} today`;
    
    console.log(`${canSend ? '✅' : '🚫'} SMS deduplication result: ${canSend ? 'CAN SEND' : 'ALREADY SENT'}`);
    
    return { canSend, reason };
    
  } catch (error) {
    console.error('❌ Unexpected error in SMS deduplication check:', error);
    // Fail safe - allow send if unexpected error
    return { canSend: true, reason: 'Unexpected error, allowing send' };
  }
}

/**
 * Log SMS send to deduplication table
 */
export async function logSMSSend(record: SMSSendRecord): Promise<{ success: boolean; logId?: number; error?: string }> {
  try {
    console.log(`📝 Logging SMS send: ${record.phoneNumber.slice(-4)} + ${record.templateType} via ${record.sourceEndpoint}`);
    
    const { data: logId, error } = await supabase.rpc('log_sms_send', {
      p_phone_number: record.phoneNumber,
      p_template_type: record.templateType,
      p_user_id: record.userId,
      p_source_endpoint: record.sourceEndpoint,
      p_message_id: record.messageId || null,
      p_success: record.success
    });
    
    if (error) {
      console.error('❌ Error logging SMS send:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ SMS send logged with ID: ${logId}`);
    return { success: true, logId };
    
  } catch (error) {
    console.error('❌ Unexpected error logging SMS send:', error);
    return { success: false, error: 'Unexpected error' };
  }
}

/**
 * Combined function: Check if can send, and if so, log the send
 * Use this for all SMS sending to ensure deduplication
 */
export async function checkAndLogSMS(record: SMSSendRecord): Promise<{
  canSend: boolean;
  reason?: string;
  logId?: number;
  error?: string;
}> {
  // First check if we can send
  const { canSend, reason } = await canSendSMS(record.phoneNumber, record.templateType);
  
  if (!canSend) {
    return { canSend, reason };
  }
  
  // If we can send, log it immediately to prevent race conditions
  const logResult = await logSMSSend(record);
  
  if (!logResult.success) {
    return { 
      canSend: false, 
      reason: 'Failed to log SMS send', 
      error: logResult.error 
    };
  }
  
  return { 
    canSend: true, 
    logId: logResult.logId 
  };
}

/**
 * Get SMS send history for a phone number
 */
export async function getSMSSendHistory(
  phoneNumber: string, 
  days: number = 7
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('sms_send_log')
      .select('*')
      .eq('phone_number', phoneNumber)
      .gte('sent_at', startDate.toISOString())
      .order('sent_at', { ascending: false });
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
    
  } catch (error) {
    return { success: false, error: 'Unexpected error' };
  }
}