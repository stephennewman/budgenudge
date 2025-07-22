/**
 * Unified SMS Service for Krezzo
 * Supports gradual migration from Resend to SlickText
 * With fallback mechanisms and monitoring
 */

import { createSlickTextClient, sendEnhancedSlickTextSMS } from './slicktext-client';

// Migration configuration
interface SMSConfig {
  primaryProvider: 'resend' | 'slicktext';
  enableFallback: boolean;
  testMode: boolean;
  resendEnabled: boolean;
  slicktextEnabled: boolean;
}

interface SMSRequest {
  phoneNumber: string;
  message: string;
  userId?: string;
  userEmail?: string;
  context?: string; // 'webhook', 'manual', 'test', etc.
}

interface SMSResponse {
  success: boolean;
  provider: 'resend' | 'slicktext';
  messageId?: string;
  error?: string;
  fallbackUsed?: boolean;
  deliveryTime?: number;
}

/**
 * Get SMS configuration from environment variables
 */
function getSMSConfig(): SMSConfig {
  return {
    primaryProvider: (process.env.SMS_PRIMARY_PROVIDER as 'resend' | 'slicktext') || 'resend',
    enableFallback: process.env.SMS_ENABLE_FALLBACK !== 'false',
    testMode: process.env.SMS_TEST_MODE === 'true',
    resendEnabled: process.env.SMS_RESEND_ENABLED !== 'false',
    slicktextEnabled: process.env.SMS_SLICKTEXT_ENABLED === 'true'
  };
}

/**
 * Send SMS via Resend (current provider)
 */
async function sendViaResend({ phoneNumber, message, userEmail }: SMSRequest): Promise<SMSResponse> {
  const startTime = Date.now();
  
  try {
    console.log('📱 Sending SMS via Resend...');
    
    // Import Resend dynamically to avoid issues if not installed
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Enhanced carrier detection for email-to-SMS
    const carrierGateways: Record<string, string> = {
      'tmobile': 'tmomail.net',
      'att': 'txt.att.net', 
      'verizon': 'vtext.com',
      'sprint': 'messaging.sprintpcs.com',
      'uscellular': 'email.uscc.net',
      'cricket': 'sms.cricketwireless.net',
      'metropcs': 'mymetropcs.com',
      'boost': 'sms.myboostmobile.com',
      'virgin': 'vmobl.com',
      'straighttalk': 'vtext.com'
    };

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const carrier = process.env.SMS_CARRIER || 'tmobile';
    const gateway = carrierGateways[carrier] || 'tmomail.net';
    const emailAddress = `${cleanPhone}@${gateway}`;

    const result = await resend.emails.send({
              from: 'Krezzo <alerts@krezzo.com>',
      to: [emailAddress],
      subject: 'Transaction Alert',
      text: message,
    });

    const deliveryTime = Date.now() - startTime;

    console.log(`✅ Resend SMS sent successfully in ${deliveryTime}ms:`, result.data?.id);

    return {
      success: true,
      provider: 'resend',
      messageId: result.data?.id,
      deliveryTime
    };
  } catch (error) {
    const deliveryTime = Date.now() - startTime;
    console.error('❌ Resend SMS failed:', error);
    
    return {
      success: false,
      provider: 'resend',
      error: error instanceof Error ? error.message : 'Resend SMS failed',
      deliveryTime
    };
  }
}

/**
 * Send SMS via SlickText (new provider)
 */
async function sendViaSlickText(request: SMSRequest): Promise<SMSResponse> {
  const startTime = Date.now();
  
  try {
    console.log('📱 Sending SMS via SlickText...');
    
    const result = await sendEnhancedSlickTextSMS({
      phoneNumber: request.phoneNumber,
      message: request.message,
      userId: request.userId,
      userEmail: request.userEmail
    });

    const deliveryTime = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ SlickText SMS sent successfully in ${deliveryTime}ms:`, result.messageId);
      return {
        success: true,
        provider: 'slicktext',
        messageId: result.messageId,
        deliveryTime
      };
    } else {
      console.error('❌ SlickText SMS failed:', result.error);
      return {
        success: false,
        provider: 'slicktext',
        error: result.error,
        deliveryTime
      };
    }
  } catch (error) {
    const deliveryTime = Date.now() - startTime;
    console.error('❌ SlickText SMS error:', error);
    
    return {
      success: false,
      provider: 'slicktext',
      error: error instanceof Error ? error.message : 'SlickText SMS failed',
      deliveryTime
    };
  }
}

/**
 * Unified SMS sending with migration support
 */
export async function sendUnifiedSMS(request: SMSRequest): Promise<SMSResponse> {
  const config = getSMSConfig();
  const context = request.context || 'unknown';
  
  console.log(`🚀 SMS Request [${context}]:`, {
    provider: config.primaryProvider,
    fallback: config.enableFallback,
    testMode: config.testMode,
    phoneNumber: request.phoneNumber.slice(-4) // Log last 4 digits only
  });

  // Test mode - send via both providers for comparison
  if (config.testMode) {
    console.log('🧪 Test mode: Sending via both providers...');
    
    const [resendResult, slicktextResult] = await Promise.allSettled([
      config.resendEnabled ? sendViaResend(request) : Promise.resolve({ success: false, provider: 'resend' as const, error: 'Disabled' }),
      config.slicktextEnabled ? sendViaSlickText(request) : Promise.resolve({ success: false, provider: 'slicktext' as const, error: 'Disabled' })
    ]);

    // Log comparison results
    console.log('🧪 Test mode results:', {
      resend: resendResult.status === 'fulfilled' ? resendResult.value : { error: resendResult.reason },
      slicktext: slicktextResult.status === 'fulfilled' ? slicktextResult.value : { error: slicktextResult.reason }
    });

    // Return primary provider result
    const primaryResult = config.primaryProvider === 'slicktext' ? slicktextResult : resendResult;
    return primaryResult.status === 'fulfilled' ? primaryResult.value : {
      success: false,
      provider: config.primaryProvider,
      error: 'Test mode failed'
    };
  }

  // Normal mode - try primary provider first
  let primaryResult: SMSResponse;
  
  if (config.primaryProvider === 'slicktext' && config.slicktextEnabled) {
    primaryResult = await sendViaSlickText(request);
  } else if (config.primaryProvider === 'resend' && config.resendEnabled) {
    primaryResult = await sendViaResend(request);
  } else {
    console.warn(`⚠️ Primary provider ${config.primaryProvider} is disabled`);
    primaryResult = {
      success: false,
      provider: config.primaryProvider,
      error: `${config.primaryProvider} is disabled`
    };
  }

  // If primary succeeded, return success
  if (primaryResult.success) {
    return primaryResult;
  }

  // If primary failed and fallback is enabled, try fallback provider
  if (config.enableFallback) {
    console.log(`⚠️ Primary provider (${config.primaryProvider}) failed, trying fallback...`);
    
    let fallbackResult: SMSResponse;
    
    if (config.primaryProvider === 'slicktext' && config.resendEnabled) {
      fallbackResult = await sendViaResend(request);
    } else if (config.primaryProvider === 'resend' && config.slicktextEnabled) {
      fallbackResult = await sendViaSlickText(request);
    } else {
      console.warn('⚠️ No fallback provider available');
      return {
        ...primaryResult,
        error: `${primaryResult.error} (no fallback available)`
      };
    }

    if (fallbackResult.success) {
      console.log(`✅ Fallback provider succeeded: ${fallbackResult.provider}`);
      return {
        ...fallbackResult,
        fallbackUsed: true
      };
    } else {
      console.error('❌ Both primary and fallback providers failed');
      return {
        success: false,
        provider: config.primaryProvider,
        error: `Primary: ${primaryResult.error}, Fallback: ${fallbackResult.error}`,
        fallbackUsed: true
      };
    }
  }

  // No fallback enabled, return primary result
  return primaryResult;
}

/**
 * Migration helper: Test SlickText availability
 */
export async function testSlickTextAvailability(): Promise<boolean> {
  try {
    const client = createSlickTextClient();
    const result = await client.testConnection();
    return result.success;
  } catch (error) {
    console.error('SlickText availability test failed:', error);
    return false;
  }
}

/**
 * Migration helper: Get current SMS configuration
 */
export function getCurrentSMSConfig() {
  const config = getSMSConfig();
  return {
    ...config,
    slicktextAvailable: process.env.SLICKTEXT_API_KEY && process.env.SLICKTEXT_BRAND_ID,
    resendAvailable: process.env.RESEND_API_KEY
  };
} 