import { sendBandwidthSMS, formatPhoneForBandwidth, isBandwidthConfigured } from './bandwidth-client';
import { getSmsGatewayWithFallback } from './user-phone';

export interface EnhancedSMSOptions {
  phoneNumber: string;
  message: string;
  userId?: string;
  preferBandwidth?: boolean;
}

export interface SMSResult {
  success: boolean;
  method: 'bandwidth' | 'email-gateway';
  error?: string;
  messageId?: string;
}

/**
 * Enhanced SMS sending that tries Bandwidth first (like Ramp), 
 * then falls back to email-to-SMS gateway
 */
export async function sendEnhancedSMS({ 
  phoneNumber, 
  message, 
  userId, 
  preferBandwidth = true 
}: EnhancedSMSOptions): Promise<SMSResult> {
  
  // Try Bandwidth first (professional SMS like Ramp uses)
  if (preferBandwidth && isBandwidthConfigured()) {
    console.log('🎯 Trying Bandwidth API (professional SMS)...');
    
    const bandwidthSuccess = await sendBandwidthSMS({
      to: phoneNumber,
      message: message,
    });
    
    if (bandwidthSuccess) {
      return {
        success: true,
        method: 'bandwidth',
        messageId: 'bandwidth-' + Date.now(),
      };
    }
    
    console.log('⚠️ Bandwidth failed, falling back to email gateway...');
  }
  
  // Fallback to email-to-SMS gateway
  console.log('📧 Using email-to-SMS gateway fallback...');
  
  try {
    // Get SMS gateway (handles user phone lookup or fallback)
    const smsGateway = await getSmsGatewayWithFallback(userId);
    
    // Send via Resend to email-to-SMS gateway
    const smsResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BudgeNudge <stephen@krezzo.com>',
        to: [smsGateway],
        subject: 'Alert',
        text: message
      }),
    });

    if (smsResponse.ok) {
      const result = await smsResponse.json();
      return {
        success: true,
        method: 'email-gateway',
        messageId: result.id || 'email-gateway-' + Date.now(),
      };
    } else {
      return {
        success: false,
        method: 'email-gateway',
        error: `Email gateway failed: ${smsResponse.status}`,
      };
    }
    
  } catch (error: any) {
    return {
      success: false,
      method: 'email-gateway',
      error: error.message || 'Unknown error',
    };
  }
} 