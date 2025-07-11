/**
 * SlickText SMS API Client for BudgeNudge
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
      'User-Agent': 'BudgeNudge/1.0'
    };
  }

  /**
   * Make API request to SlickText with error handling
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}/brands/${this.config.brandId}${endpoint}`;
    
    try {
      console.log(`🌐 SlickText API Request: ${options.method || 'GET'} ${url}`);
      
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
      console.log(`📝 SlickText Response (${response.status}):`, responseText);

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
      console.log('👤 Creating SlickText contact:', contact.phone_number);
      
      const data = await this.makeRequest('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: contact.phone_number.replace(/\D/g, ''), // Remove non-digits
          first_name: contact.first_name || 'BudgeNudge',
          last_name: contact.last_name || 'User',
          email: contact.email,
          opt_in_source: contact.opt_in_source || 'BudgeNudge Transaction Alerts',
          list_ids: contact.list_ids || [],
          custom_fields: contact.custom_fields || {}
        })
      });

      return {
        success: true,
        data,
        messageId: data.id
      };
    } catch (error) {
      console.log('⚠️ Contact creation failed (continuing anyway):', error);
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
      console.log('📱 Sending SlickText SMS...', {
        contentLength: message.content.length,
        phoneNumbers: message.phone_numbers?.length || (message.contact ? 1 : 0)
      });

      const phoneNumbers = message.phone_numbers || 
        (message.contact ? [message.contact.phone_number] : []);

      if (phoneNumbers.length === 0) {
        throw new Error('No phone numbers provided');
      }

      // Method 1: First try to find or create contact, then send message
      try {
        const phoneNumber = phoneNumbers[0].replace(/\D/g, '');
        console.log('📤 Step 1: Ensuring contact exists for', phoneNumber);

        // Check if contact exists
        let contactId: number | null = null;
        try {
          const contactsResponse = await this.makeRequest('/contacts');
          const existingContact = contactsResponse.data?.find((contact: any) => 
            contact.mobile_number?.replace(/\D/g, '') === phoneNumber
          );
          
          if (existingContact) {
            contactId = existingContact.contact_id;
            console.log('✅ Found existing contact:', contactId);
          }
        } catch (error) {
          console.log('⚠️ Could not check existing contacts:', error);
        }

        // Create contact if it doesn't exist
        if (!contactId) {
          try {
            const createContactPayload = {
              first_name: message.contact?.first_name || 'BudgeNudge',
              last_name: message.contact?.last_name || 'User',
              mobile_number: `+1${phoneNumber}`,
              email: message.contact?.email,
              opt_in_status: 'subscribed',
              source: 'BudgeNudge Financial Alerts'
            };

            console.log('📤 Creating new contact:', createContactPayload);

            const contactResponse = await this.makeRequest('/contacts', {
              method: 'POST',
              body: JSON.stringify(createContactPayload)
            });

            contactId = contactResponse.contact_id;
            console.log('✅ Created new contact:', contactId);
          } catch (contactError) {
            console.log('⚠️ Contact creation failed, will try without contact_id:', contactError);
          }
        }

        // Method 2: Try sending via messages endpoint (most likely for individual SMS)
        try {
          const messagePayload = {
            body: message.content,  // Changed from 'message' to 'body'
            contact_id: contactId,
            send_immediately: !message.scheduled_at
          };

          if (message.scheduled_at) {
            messagePayload.scheduled_at = message.scheduled_at;
            messagePayload.send_immediately = false;
          }

          console.log('📤 Sending message via messages endpoint:', messagePayload);

          const messageResponse = await this.makeRequest('/messages', {
            method: 'POST',
            body: JSON.stringify(messagePayload)
          });

          console.log('✅ SlickText SMS sent successfully via messages:', messageResponse);

          return {
            success: true,
            data: messageResponse,
            messageId: messageResponse.id || messageResponse.message_id,
            deliveryStatus: 'sent'
          };
        } catch (messageError) {
          console.log('⚠️ Messages endpoint failed, trying campaigns:', messageError);

          // Method 3: Try creating a campaign for the message
          try {
            const campaignPayload = {
              name: `BudgeNudge Alert ${Date.now()}`,
              body: message.content,  // Changed from 'message' to 'body'
              contact_ids: contactId ? [contactId] : undefined,
              phone_numbers: contactId ? undefined : [`+1${phoneNumber}`],
              send_immediately: !message.scheduled_at
            };

            if (message.scheduled_at) {
              campaignPayload.scheduled_at = message.scheduled_at;
              campaignPayload.send_immediately = false;
            }

            console.log('📤 Creating campaign:', campaignPayload);

            const campaignResponse = await this.makeRequest('/campaigns', {
              method: 'POST',
              body: JSON.stringify(campaignPayload)
            });

            console.log('✅ SlickText SMS sent successfully via campaign:', campaignResponse);

            return {
              success: true,
              data: campaignResponse,
              messageId: campaignResponse.id || campaignResponse.campaign_id,
              deliveryStatus: 'sent'
            };
          } catch (campaignError) {
            console.log('❌ All methods failed:', { messageError, campaignError });
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
      console.log('🧪 Testing SlickText connection...');
      
      const brandInfo = await this.getBrandInfo();
      if (brandInfo.success) {
        console.log('✅ SlickText connection successful:', brandInfo.data);
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
    
    // Create contact with user info for better deliverability
    const contact: SlickTextContact = {
      phone_number: phoneNumber,
      email: userEmail,
      opt_in_source: 'BudgeNudge Financial Alerts',
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