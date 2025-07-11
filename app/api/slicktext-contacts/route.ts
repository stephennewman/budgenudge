import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient } from '../../../utils/sms/slicktext-client';

export async function GET() {
  try {
    console.log('🔍 Fetching SlickText contacts...');
    
    // Use a direct API call since we need to access the contacts endpoint
    const apiKey = process.env.SLICKTEXT_API_KEY;
    const brandId = process.env.SLICKTEXT_BRAND_ID;
    const baseUrl = 'https://dev.slicktext.com/v1';
    
    const response = await fetch(`${baseUrl}/brands/${brandId}/contacts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BudgeNudge/1.0'
      }
    });
    
    const responseText = await response.text();
    console.log(`📝 SlickText Contacts Response (${response.status}):`, responseText);
    
    if (!response.ok) {
      throw new Error(`SlickText API error: ${response.status} - ${responseText}`);
    }
    
    let contactsData: Record<string, unknown> = {};
    try {
      contactsData = JSON.parse(responseText);
    } catch {
      contactsData = { message: responseText };
    }
    
    const contacts = Array.isArray(contactsData.data) ? contactsData.data : 
                    Array.isArray(contactsData) ? contactsData : [];
    
    console.log(`✅ Found ${contacts.length} contacts in SlickText`);
    
    // Format contact information for easier reading
    const formattedContacts = contacts.map((contact: Record<string, unknown>) => ({
      contact_id: contact.contact_id || contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      mobile_number: contact.mobile_number || contact.phone_number,
      email: contact.email,
      opt_in_status: contact.opt_in_status,
      created_at: contact.created_at,
      source: contact.source || contact.opt_in_source
    }));
    
    return NextResponse.json({
      success: true,
      totalContacts: contacts.length,
      contacts: formattedContacts,
      rawResponse: contactsData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('❌ Failed to fetch SlickText contacts:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contacts',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();
    
    console.log(`🔍 Searching for contact: ${phoneNumber}`);
    
    const client = createSlickTextClient();
    const result = await client.getContact(phoneNumber);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        contact: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Contact not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
  } catch (error: unknown) {
    console.error('❌ Contact search failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Contact search failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 