import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient, sendEnhancedSlickTextSMS } from '../../../utils/sms/slicktext-client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing SlickText SMS integration...');

    // Parse request body for optional parameters
    let phoneNumber: string | undefined;
    let message: string | undefined;
    let userId: string | undefined;
    let userEmail: string | undefined;
    let useRealData: boolean = false;

    try {
      const body = await request.json();
      phoneNumber = body.phoneNumber;
      message = body.message;
      userId = body.userId;
      userEmail = body.userEmail;
      useRealData = body.realData === true;
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Generate message - use real data if requested
    let testMessage = message;
    
    if (!testMessage) {
      if (useRealData) {
        console.log('📊 Fetching real transaction data for Stephen Newman...');
        testMessage = await buildRealDataMessage();
      } else {
        testMessage = `🚀 SlickText Integration Test - Krezzo

✅ Professional SMS delivery active
✅ Contact management enabled
✅ Two-way messaging ready
✅ Timestamp: ${new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} EST

This message was sent via SlickText API! 🎯`;
      }
    }

    // Default phone number (you can change this)
    const targetPhone = phoneNumber || '+16173472721';

    console.log('📱 SlickText test details:', {
      phoneNumber: targetPhone,
      messageLength: testMessage.length,
      userId: userId || 'test-user',
      userEmail: userEmail || undefined
    });

    // Test SlickText connection first
    const client = createSlickTextClient();
    const connectionTest = await client.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`SlickText connection failed: ${connectionTest.error}`);
    }

    console.log('✅ SlickText connection verified:', connectionTest.data);

    // Send test SMS
    const result = await sendEnhancedSlickTextSMS({
      phoneNumber: targetPhone,
      message: testMessage,
      userId: userId || 'test-user',
      userEmail: userEmail
    });

    if (result.success) {
      console.log('✅ SlickText SMS test successful:', {
        messageId: result.messageId,
        deliveryStatus: result.deliveryStatus
      });

      return NextResponse.json({
        success: true,
        method: 'slicktext',
        messageId: result.messageId,
        brandInfo: connectionTest.data,
        message: 'SlickText SMS sent successfully!',
        timestamp: new Date().toISOString(),
        phoneNumber: targetPhone
      });
    } else {
      throw new Error(result.error || 'SlickText SMS send failed');
    }

  } catch (error: unknown) {
    console.error('❌ SlickText test endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      method: 'slicktext',
      error: error instanceof Error ? error.message : 'SlickText test failed',
      timestamp: new Date().toISOString(),
      troubleshooting: {
        checklist: [
          'Verify SLICKTEXT_API_KEY is set correctly',
          'Verify SLICKTEXT_BRAND_ID is set correctly',
          'Check SlickText account credits and status',
          'Ensure phone number format is correct (+1XXXXXXXXXX)',
          'Check SlickText API documentation for any changes'
        ]
      }
        }, { status: 500 });
  }
}

// Function to build real transaction data message for Stephen Newman
async function buildRealDataMessage(): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get Stephen Newman's user ID
    const { data: userData } = await supabase.auth.admin.listUsers();
    let stephenUserId: string | null = null;
    
    if (userData?.users) {
      const stephenUser = userData.users.find(user => 
        user.email?.toLowerCase().includes('stephen') || 
        user.email?.toLowerCase().includes('newman')
      );
      stephenUserId = stephenUser?.id || null;
    }
    
    if (!stephenUserId) {
      // Fallback: get the first user with transactions
      const { data: items } = await supabase
        .from('items')
        .select('user_id')
        .limit(1);
      
      stephenUserId = items?.[0]?.user_id || null;
    }
    
    if (!stephenUserId) {
      throw new Error('No user found');
    }

    // Get user's items and accounts
    const { data: userItems } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', stephenUserId);
    
    if (!userItems || userItems.length === 0) {
      throw new Error('No connected accounts found');
    }
    
    const itemIds = userItems.map(item => item.plaid_item_id);
    const itemDbIds = userItems.map(item => item.id);
    
    // Get real transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .in('plaid_item_id', itemIds)
      .order('date', { ascending: false })
      .limit(50);
    
    // Get real account balances
    const { data: accounts } = await supabase
      .from('accounts')
      .select('name, type, current_balance, available_balance')
      .in('item_id', itemDbIds);
    
    if (!transactions || !accounts) {
      throw new Error('No data found');
    }

    // Calculate real balance
    const depositoryAccounts = accounts.filter(acc => acc.type === 'depository');
    const totalAvailable = depositoryAccounts.reduce(
      (sum, acc) => sum + (acc.available_balance || 0), 
      0
    );

    // Calculate real spending patterns
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Real Publix spending this month
    const publixThisMonth = transactions
      .filter(t => {
        const transDate = new Date(t.date);
        return (t.merchant_name || t.name || '').toLowerCase().includes('publix') && 
               transDate >= monthStart;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Real Amazon spending this month
    const amazonThisMonth = transactions
      .filter(t => {
        const transDate = new Date(t.date);
        return (t.merchant_name || t.name || '').toLowerCase().includes('amazon') && 
               transDate >= monthStart;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Recent real transactions
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(now.getDate() - 5);
    
    const recentTransactions = transactions
      .filter(t => new Date(t.date) >= fiveDaysAgo)
      .slice(0, 6);

    // Build real message
          let message = `💰 STEPHEN'S REAL KREZZO DATA\n\n`;
    message += `💳 AVAILABLE BALANCE: $${totalAvailable.toFixed(2)}\n\n`;
    
    message += `🏪 PUBLIX THIS MONTH: $${publixThisMonth.toFixed(2)}\n`;
    message += `📦 AMAZON THIS MONTH: $${amazonThisMonth.toFixed(2)}\n\n`;
    
    message += `📋 RECENT REAL TRANSACTIONS:\n`;
    recentTransactions.forEach(t => {
      const transDate = new Date(t.date);
      const dateStr = `${transDate.getMonth() + 1}/${transDate.getDate()}`;
      const merchant = (t.merchant_name || t.name || 'Unknown').substring(0, 20);
      message += `${dateStr}: ${merchant} $${Math.abs(t.amount).toFixed(2)}\n`;
    });
    
    message += `\n🎯 REAL DATA FROM YOUR ACCOUNTS`;
    message += `\n📊 Total transactions analyzed: ${transactions.length}`;
    message += `\n⚡ Generated: ${new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} EST`;
    
    return message;
    
  } catch (error) {
    console.error('Error building real data message:', error);
    return `❌ Error fetching real data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nFalling back to test message.`;
  }
}

export async function GET() {
  try {
    console.log('🔍 SlickText status check...');
    
    // Test connection without sending SMS
    const client = createSlickTextClient();
    const brandInfo = await client.getBrandInfo();
    
    if (brandInfo.success) {
      return NextResponse.json({
        success: true,
        method: 'slicktext',
        status: 'ready',
        brandInfo: brandInfo.data,
        message: 'SlickText API is ready to send SMS',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(brandInfo.error || 'Brand info fetch failed');
    }
    
  } catch (error: unknown) {
    console.error('❌ SlickText status check failed:', error);
    
    return NextResponse.json({
      success: false,
      method: 'slicktext',
      status: 'error',
      error: error instanceof Error ? error.message : 'SlickText status check failed',
      timestamp: new Date().toISOString(),
      troubleshooting: {
        possibleCauses: [
          'Missing or invalid SLICKTEXT_API_KEY environment variable',
          'Missing or invalid SLICKTEXT_BRAND_ID environment variable',
          'SlickText API service is down',
          'Account suspended or out of credits',
          'Network connectivity issues'
        ]
      }
    }, { status: 500 });
  }
} 