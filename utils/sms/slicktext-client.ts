/**
 * SlickText SMS API Client for Krezzo
 * Professional SMS delivery replacing email-to-SMS gateways
 * Documentation: https://api.slicktext.com/docs/v2/overview
 */

export interface SlickTextConfig {
  apiKey: string;
  brandId: string;
  baseUrl?: string;
}

export interface SlickTextContact {
  phone_number: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  opt_in_source?: string;
  list_ids?: string[];
  custom_fields?: Record<string, string>;
}

export interface SlickTextMessage {
  content: string;
  contact?: SlickTextContact;
  phone_numbers?: string[];
  scheduled_at?: string; // ISO 8601 format
}

export interface SlickTextResponse {
  success: boolean;
  data?: any;
  error?: string;
  messageId?: string;
  deliveryStatus?: string;
}

export class SlickTextClient {
  private config: SlickTextConfig;
  private baseUrl: string;

  constructor(config: SlickTextConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://dev.slicktext.com/v1';
    
    if (!config.apiKey) {
      throw new Error('SlickText API key is required');
    }
    if (!config.brandId) {
      throw new Error('SlickText Brand ID is required');
    }
  }

  /**
   * Get authentication headers for SlickText API
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Krezzo/1.0'
    };
  }

  /**
   * Make API request to SlickText with error handling
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}/brands/${this.config.brandId}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      // Handle rate limiting (SlickText: 8 requests/second, 480/minute)
      if (response.status === 429) {
        console.warn('🚦 SlickText rate limit hit, waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.makeRequest(endpoint, options);
      }

      const responseText = await response.text();

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        // Response might not be JSON
        data = { message: responseText };
      }

      if (!response.ok) {
        throw new Error(`SlickText API error: ${response.status} - ${data.message || responseText || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('❌ SlickText API request failed:', {
        url,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Create or update a contact in SlickText
   */
  async createContact(contact: SlickTextContact): Promise<SlickTextResponse> {
    try {
      // First, check if contact already exists
      const cleanPhone = contact.phone_number.replace(/\D/g, '');
      try {
        const contactsResponse = await this.makeRequest('/contacts');
        const existingContact = contactsResponse.data?.find((existingC: any) => {
          const existingPhone = existingC.mobile_number?.replace(/\D/g, '');
          return existingPhone === cleanPhone;
        });
        
        if (existingContact) {
          return {
            success: true,
            data: existingContact,
            messageId: existingContact.contact_id
          };
        }
      } catch (lookupError) {
        // Could not check for existing contact, proceeding with creation
      }
      
      const data = await this.makeRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          mobile_number: `+1${cleanPhone}`, // Format as +1XXXXXXXXXX
          first_name: contact.first_name || 'Krezzo',
          last_name: contact.last_name || 'User',
          email: contact.email,
          opt_in_status: 'subscribed',
          source: contact.opt_in_source || 'Krezzo Transaction Alerts'
        })
      });

      return {
        success: true,
        data,
        messageId: data.id
      };
    } catch (error) {
      // Handle duplicate contact error specifically
      if (error instanceof Error && error.message.includes('422') && 
          error.message.includes('mobile number already exists')) {
        
        try {
          const cleanPhone = contact.phone_number.replace(/\D/g, '');
          const contactsResponse = await this.makeRequest('/contacts');
          const existingContact = contactsResponse.data?.find((existingC: any) => {
            const existingPhone = existingC.mobile_number?.replace(/\D/g, '');
            return existingPhone === cleanPhone || 
                   existingPhone === cleanPhone.substring(1) || // Remove leading 1
                   '1' + existingPhone === cleanPhone; // Add leading 1
          });
          
          if (existingContact) {
            return {
              success: true,
              data: existingContact,
              messageId: existingContact.contact_id
            };
          }
        } catch (findError) {
          // Could not find existing contact after duplicate error
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Contact creation failed'
      };
    }
  }

  /**
   * Send SMS message via SlickText using correct API structure
   */
  async sendSMS(message: SlickTextMessage): Promise<SlickTextResponse> {
    try {
      const phoneNumbers = message.phone_numbers || 
        (message.contact ? [message.contact.phone_number] : []);

      if (phoneNumbers.length === 0) {
        throw new Error('No phone numbers provided');
      }

      // Method 1: First try to find or create contact, then send message
      try {
        let phoneNumber = phoneNumbers[0].replace(/\D/g, '');
        // Add country code if not present
        if (phoneNumber.length === 10) {
          phoneNumber = '+1' + phoneNumber;
        } else if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
          phoneNumber = '+' + phoneNumber;
        }

        // Check if contact exists
        let contactId: number | null = null;
        try {
          const contactsResponse = await this.makeRequest('/contacts');
          const cleanPhoneNumber = phoneNumber.replace(/\D/g, ''); // Remove +1 for comparison
          const existingContact = contactsResponse.data?.find((contact: any) => {
            const contactPhone = contact.mobile_number?.replace(/\D/g, '');
            return contactPhone === cleanPhoneNumber;
          });
          
          if (existingContact) {
            contactId = existingContact.contact_id;
          }
        } catch (error) {
          // Could not check existing contacts
        }

        // Create contact if it doesn't exist
        if (!contactId) {
          try {
            const createContactPayload = {
              first_name: message.contact?.first_name || 'Krezzo',
              last_name: message.contact?.last_name || 'User',
              mobile_number: phoneNumber, // phoneNumber already includes +1
              email: message.contact?.email,
              opt_in_status: 'subscribed',
              source: 'Krezzo Financial Alerts'
            };

            const contactResponse = await this.makeRequest('/contacts', {
              method: 'POST',
              body: JSON.stringify(createContactPayload)
            });

            contactId = contactResponse.contact_id;
          } catch (contactError) {
            
            // Check if this is a duplicate contact error (422)
            if (contactError instanceof Error && contactError.message.includes('422') && 
                contactError.message.includes('mobile number already exists')) {
              
              // Try to find the existing contact again with different search methods
              try {
                const retryContactsResponse = await this.makeRequest('/contacts');
                const cleanPhoneForRetry = phoneNumber.replace(/\D/g, '');
                const retryContact = retryContactsResponse.data?.find((contact: any) => {
                  const contactPhone = contact.mobile_number?.replace(/\D/g, '');
                  return contactPhone === cleanPhoneForRetry || 
                         contactPhone === cleanPhoneForRetry.substring(1) || // Remove leading 1
                         '1' + contactPhone === cleanPhoneForRetry; // Add leading 1
                });
                
                if (retryContact) {
                  contactId = retryContact.contact_id;
                }
              } catch (retryError) {
                // Retry contact search also failed
              }
            }
          }
        }

        // Method 2: Try sending via messages endpoint (most likely for individual SMS)
        try {
          const messagePayload: {
            body: string;
            contact_id: number | null;
            send_immediately: boolean;
            scheduled_at?: string;
          } = {
            body: message.content,  // Changed from 'message' to 'body'
            contact_id: contactId,
            send_immediately: !message.scheduled_at
          };

          if (message.scheduled_at) {
            messagePayload.scheduled_at = message.scheduled_at;
            messagePayload.send_immediately = false;
          }

          const messageResponse = await this.makeRequest('/messages', {
            method: 'POST',
            body: JSON.stringify(messagePayload)
          });

          return {
            success: true,
            data: messageResponse,
            messageId: messageResponse.id || messageResponse.message_id,
            deliveryStatus: 'sent'
          };
        } catch (messageError) {

          // Method 3: Try creating a campaign for the message
          try {
            const campaignPayload: {
              name: string;
              body: string;
              contact_ids?: number[];
              phone_numbers?: string[];
              send_immediately: boolean;
              scheduled_at?: string;
            } = {
              name: `Krezzo Alert ${Date.now()}`,
              body: message.content,  // Changed from 'message' to 'body'
              contact_ids: contactId ? [contactId] : undefined,
              phone_numbers: contactId ? undefined : [`+1${phoneNumber}`],
              send_immediately: !message.scheduled_at
            };

            if (message.scheduled_at) {
              campaignPayload.scheduled_at = message.scheduled_at;
              campaignPayload.send_immediately = false;
            }

            const campaignResponse = await this.makeRequest('/campaigns', {
              method: 'POST',
              body: JSON.stringify(campaignPayload)
            });

            return {
              success: true,
              data: campaignResponse,
              messageId: campaignResponse.id || campaignResponse.campaign_id,
              deliveryStatus: 'sent'
            };
          } catch (campaignError) {
            throw messageError; // Return the messages error as it's more likely to be the right approach
          }
        }
      } catch (error) {
        console.error('❌ SlickText SMS send failed:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ SlickText SMS send failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed'
      };
    }
  }

  /**
   * Send message to multiple recipients (broadcast)
   */
  async sendBroadcast(phoneNumbers: string[], content: string): Promise<SlickTextResponse> {
    return this.sendSMS({
      content,
      phone_numbers: phoneNumbers
    });
  }

  /**
   * Get contact information by phone number
   */
  async getContact(phoneNumber: string): Promise<SlickTextResponse> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Try different contact lookup methods
      try {
        const data = await this.makeRequest(`/contacts?phone_number=${cleanPhone}`);
        return { success: true, data };
      } catch {
        // Try alternative search format
        const searchData = await this.makeRequest(`/contacts/search?phone_number=${cleanPhone}`);
        return { success: true, data: searchData };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Contact lookup failed'
      };
    }
  }

  /**
   * Get brand information and credit balance
   */
  async getBrandInfo(): Promise<SlickTextResponse> {
    try {
      const data = await this.makeRequest('');
      
      return {
        success: true,
        data: {
          name: data.name,
          brand_id: data.brand_id,
          credits: data.message_credit_limit,
          phone_number: data.contact_phone,
          contact_email: data.contact_email
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Brand info fetch failed'
      };
    }
  }

  /**
   * Test the SlickText connection
   */
  async testConnection(): Promise<SlickTextResponse> {
    try {
      const brandInfo = await this.getBrandInfo();
      if (brandInfo.success) {
        return {
          success: true,
          data: brandInfo.data
        };
      } else {
        throw new Error(brandInfo.error);
      }
    } catch (error) {
      console.error('❌ SlickText connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

/**
 * Create SlickText client instance from environment variables
 */
export function createSlickTextClient(): SlickTextClient {
  const apiKey = process.env.SLICKTEXT_API_KEY;
  const brandId = process.env.SLICKTEXT_BRAND_ID;

  if (!apiKey) {
    throw new Error('SLICKTEXT_API_KEY environment variable is required');
  }
  if (!brandId) {
    throw new Error('SLICKTEXT_BRAND_ID environment variable is required');
  }

  return new SlickTextClient({ apiKey, brandId });
}

/**
 * Enhanced SMS utility that tries SlickText first, then fallback
 */
export async function sendEnhancedSlickTextSMS({
  phoneNumber,
  message,
  userId,
  userEmail,
  scheduledAt
}: {
  phoneNumber: string;
  message: string;
  userId?: string;
  userEmail?: string;
  scheduledAt?: string;
}): Promise<SlickTextResponse> {
  try {
    const client = createSlickTextClient();
    
    // Format phone number for SlickText
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
      formattedPhone = '+' + formattedPhone;
    }
    
    // Create contact with user info for better deliverability
    const contact: SlickTextContact = {
      phone_number: formattedPhone,
      email: userEmail,
      opt_in_source: 'Krezzo Financial Alerts',
      custom_fields: {
        user_id: userId || 'unknown',
        signup_date: new Date().toISOString()
      }
    };

    return await client.sendSMS({
      content: message,
      contact,
      scheduled_at: scheduledAt
    });
  } catch (error) {
    console.error('❌ Enhanced SlickText SMS failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Enhanced SMS failed'
    };
  }
} 