import { sendUnifiedSMS } from './unified-sms';
import { getSmsGatewayWithFallback } from './user-phone';

export interface EnhancedSMSOptions {
  phoneNumber: string;
  message: string;
  userId?: string;
  preferBandwidth?: boolean; // Legacy compatibility, now maps to preferSlickText
}

export interface SMSResult {
  success: boolean;
  method: 'slicktext' | 'resend' | 'email-gateway';
  error?: string;
  messageId?: string;
}

/**
 * Enhanced SMS sending using the new unified SMS system
 * Legacy wrapper for backward compatibility
 */
export async function sendEnhancedSMS({ 
  phoneNumber, 
  message, 
  userId, 
  preferBandwidth = true 
}: EnhancedSMSOptions): Promise<SMSResult> {
  
  console.log('📱 Using enhanced SMS via unified system...');
  
  try {
    // Use the unified SMS system (SlickText + Resend fallback)
    const result = await sendUnifiedSMS({
      phoneNumber,
      message,
      userId,
      source: 'enhanced-sms'
    });
    
    if (result.success) {
      return {
        success: true,
        method: result.provider === 'slicktext' ? 'slicktext' : 'resend',
        messageId: result.messageId,
      };
    } else {
      return {
        success: false,
        method: 'email-gateway',
        error: result.error || 'Unknown error',
      };
    }
    
  } catch (error: any) {
    console.error('Enhanced SMS failed:', error);
    return {
      success: false,
      method: 'email-gateway',
      error: error.message || 'Unknown error',
    };
  }
} 