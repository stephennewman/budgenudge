import { createClient } from '@supabase/supabase-js';
import { formatPhoneForSms, isValidPhoneNumber, type Carrier } from './carrier-detection';

/**
 * Gets user's phone number from Supabase user metadata
 */
export async function getUserPhoneNumber(userId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error || !user?.user) {
      console.error('Error fetching user:', error);
      return null;
    }

    // Phone number is stored in user metadata during signup
    const phone = user.user.user_metadata?.phone;
    
    if (phone && isValidPhoneNumber(phone)) {
      return phone;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user phone number:', error);
    return null;
  }
}

/**
 * Gets formatted SMS gateway email for a user
 */
export async function getUserSmsGateway(userId: string, carrier?: Carrier): Promise<string | null> {
  const phoneNumber = await getUserPhoneNumber(userId);
  
  if (!phoneNumber) {
    return null;
  }
  
  try {
    return formatPhoneForSms(phoneNumber, carrier);
  } catch (error) {
    console.error('Error formatting phone for SMS:', error);
    return null;
  }
}

/**
 * Gets SMS gateway email with fallback to hardcoded number
 * This ensures backward compatibility during the transition
 */
export async function getSmsGatewayWithFallback(
  userId?: string, 
  providedPhoneNumber?: string,
  carrier?: Carrier
): Promise<string> {
  // If phone number is provided directly, use it
  if (providedPhoneNumber && isValidPhoneNumber(providedPhoneNumber)) {
    try {
      return formatPhoneForSms(providedPhoneNumber, carrier);
    } catch (error) {
      console.error('Error formatting provided phone number:', error);
    }
  }
  
  // Try to get user's phone number from database
  if (userId) {
    const userSmsGateway = await getUserSmsGateway(userId, carrier);
    if (userSmsGateway) {
      return userSmsGateway;
    }
  }
  
  // Fallback to hardcoded number (maintains current functionality)
  console.log('📱 Falling back to default phone number - user phone not found');
  return '6173472721@tmomail.net';
} 