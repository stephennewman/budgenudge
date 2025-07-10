import { Configuration, MessagesApi, MessageRequest } from 'bandwidth-sdk';

const accountId = process.env.BANDWIDTH_ACCOUNT_ID;
const username = process.env.BANDWIDTH_USERNAME;
const password = process.env.BANDWIDTH_PASSWORD;
const applicationId = process.env.BANDWIDTH_APPLICATION_ID;

if (!accountId || !username || !password || !applicationId) {
  console.warn('Bandwidth credentials not configured - SMS will fall back to email gateway');
}

// Initialize Bandwidth configuration
const configuration = new Configuration({
  username: username || '',
  password: password || '',
  basePath: 'https://messaging.bandwidth.com/api/v2',
});

const client = accountId && username && password ? new MessagesApi(configuration) : null;

export interface BandwidthSMSOptions {
  to: string;
  message: string;
  from?: string;
}

/**
 * Send SMS via Bandwidth API (like Ramp uses for their 447267 short code)
 * This is the professional alternative to email-to-SMS gateways
 */
export async function sendBandwidthSMS({ to, message, from }: BandwidthSMSOptions): Promise<boolean> {
  if (!client || !accountId || !applicationId) {
    console.error('Bandwidth client not configured - missing credentials');
    return false;
  }

  try {
    // Format phone number (remove any non-digits except + for international)
    const cleanTo = formatPhoneForBandwidth(to);
    const fromNumber = from || process.env.BANDWIDTH_PHONE_NUMBER || '+1234567890';

    console.log(`📱 Sending SMS via Bandwidth API to ${cleanTo}...`);

    const messageRequest: MessageRequest = {
      applicationId: applicationId,
      to: [cleanTo],
      from: fromNumber,
      text: message,
    };

    const response = await client.createMessage(accountId, messageRequest);
    
    console.log('✅ Bandwidth SMS sent successfully:', response.data);
    return true;

  } catch (error: any) {
    console.error('❌ Bandwidth SMS failed:', error.response?.data || error.message || error);
    return false;
  }
}

/**
 * Format phone number for Bandwidth API
 * Bandwidth accepts E.164 format: +1XXXXXXXXXX
 */
export function formatPhoneForBandwidth(phoneNumber: string): string {
  // Remove all non-digits except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it doesn't start with +, assume US number and add +1
  if (!cleaned.startsWith('+')) {
    // If it's 10 digits, assume US
    if (cleaned.length === 10) {
      cleaned = `+1${cleaned}`;
    }
    // If it's 11 digits starting with 1, assume US
    else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = `+${cleaned}`;
    }
    // Otherwise, assume US and add +1
    else {
      cleaned = `+1${cleaned}`;
    }
  }
  
  return cleaned;
}

/**
 * Check if Bandwidth is properly configured
 */
export function isBandwidthConfigured(): boolean {
  return !!(accountId && username && password && applicationId);
} 