// SMS carrier gateway mappings
const SMS_GATEWAYS = {
  'tmobile': '@tmomail.net',
  'att': '@txt.att.net', 
  'verizon': '@vtext.com',
  'sprint': '@messaging.sprintpcs.com',
  'boost': '@sms.myboostmobile.com',
  'cricketwireless': '@sms.cricketwireless.net',
  'uscellular': '@email.uscc.net',
  'metropcs': '@mymetropcs.com',
  'virgin': '@vmobl.com',
  'tracfone': '@mmst5.tracfone.com'
} as const;

export type Carrier = keyof typeof SMS_GATEWAYS;

// Area code to carrier mapping (approximate - many overlap)
const AREA_CODE_CARRIERS: Record<string, Carrier[]> = {
  // Major metro areas often have multiple carriers
  '617': ['tmobile', 'att', 'verizon'], // Boston
  '212': ['tmobile', 'att', 'verizon'], // NYC
  '310': ['tmobile', 'att', 'verizon'], // LA
  '415': ['tmobile', 'att', 'verizon'], // SF
  '312': ['tmobile', 'att', 'verizon'], // Chicago
  // Default fallback for most area codes
  'default': ['tmobile', 'att', 'verizon', 'sprint']
};

/**
 * Attempts to detect carrier from phone number
 * Since we can't reliably detect carrier from phone number alone,
 * we'll default to T-Mobile (current working setup) but allow manual override
 */
export function detectCarrierFromPhone(phoneNumber: string): Carrier {
  // Clean phone number
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  
  if (cleaned.length >= 10) {
    const areaCode = cleaned.substring(0, 3);
    const carriers = AREA_CODE_CARRIERS[areaCode] || AREA_CODE_CARRIERS['default'];
    
    // Default to T-Mobile since we know it works
    return carriers.includes('tmobile') ? 'tmobile' : carriers[0];
  }
  
  return 'tmobile'; // Safe default
}

/**
 * Converts phone number to SMS gateway email
 */
export function formatPhoneForSms(phoneNumber: string, carrier?: Carrier): string {
  // Clean phone number - remove all non-digits
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  
  // Extract 10-digit phone number
  let phone10 = cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    phone10 = cleaned.substring(1);
  } else if (cleaned.length !== 10) {
    throw new Error('Invalid phone number format. Must be 10 or 11 digits.');
  }
  
  // Detect carrier if not provided
  const detectedCarrier = carrier || detectCarrierFromPhone(phone10);
  const gateway = SMS_GATEWAYS[detectedCarrier];
  
  return `${phone10}${gateway}`;
}

/**
 * Gets all possible SMS gateway emails for a phone number
 * Useful for fallback attempts
 */
export function getAllSmsGatewaysForPhone(phoneNumber: string): Array<{carrier: Carrier, email: string}> {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  let phone10 = cleaned;
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    phone10 = cleaned.substring(1);
  } else if (cleaned.length !== 10) {
    throw new Error('Invalid phone number format');
  }
  
  return Object.entries(SMS_GATEWAYS).map(([carrier, gateway]) => ({
    carrier: carrier as Carrier,
    email: `${phone10}${gateway}`
  }));
}

/**
 * Validates phone number format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
} 