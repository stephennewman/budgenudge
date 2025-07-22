import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSmsGatewayWithFallback } from '@/utils/sms/user-phone';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RecurringTransaction {
  merchant_name: string;
  total_transactions: number;
  total_spending: number;
  avg_monthly_spending: number;
  recurring_reason?: string;
  is_recurring: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    // Get user's SMS gateway (with fallback to default)
    const targetPhoneNumber = phoneNumber || await getSmsGatewayWithFallback(userId);
    
    console.log('🔄 Fetching recurring transactions for user:', userId);
    
    // Fetch recurring merchants from the database
    const { data: recurringMerchants, error: dbError } = await supabase
      .from('merchant_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .order('avg_monthly_spending', { ascending: false }); // Removed .limit(15)

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch recurring transactions' 
      }, { status: 500 });
    }

    if (!recurringMerchants || recurringMerchants.length === 0) {
      const noRecurringMessage = `📊 Krezzo Recurring Bills

🎉 Great news! No recurring transactions detected yet.

This usually means:
• You're new to the app
• Your bills haven't repeated enough times
• You have excellent spending control!

Check back after a few weeks of transactions.

Generated: ${new Date().toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })} EST`;
      
      // Send SMS via Resend API
      const smsResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Krezzo <noreply@krezzo.com>',
          to: [targetPhoneNumber],
          subject: 'Krezzo Alert',
          text: noRecurringMessage,
        }),
      });

      if (!smsResponse.ok) {
        throw new Error(`SMS failed: ${smsResponse.status}`);
      }

      return NextResponse.json({ 
        success: true, 
        message: 'No recurring transactions SMS sent successfully',
        recurringCount: 0
      });
    }

    // Build the SMS message
          let smsMessage = `🔄 RECURRING SMS - Krezzo Monthly Bills Analysis

Generated: ${new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} EST

📊 TOP 12 RECURRING BILLS:

`;

    const messageLines: string[] = [];
    let totalMonthlyRecurring = 0;
    
    recurringMerchants.forEach((merchant: RecurringTransaction, index: number) => {
      const monthlyAmount = merchant.avg_monthly_spending || 0;
      totalMonthlyRecurring += monthlyAmount;
      
      // Format merchant name (truncate if too long)
      let merchantName = merchant.merchant_name;
      if (merchantName.length > 18) {
        merchantName = merchantName.substring(0, 15) + '...';
      }
      
      messageLines.push(`${index + 1}. ${merchantName}
   $${monthlyAmount.toFixed(0)}/mo • ${merchant.total_transactions} transactions`);
    });
    
    smsMessage += messageLines.join('\n\n');
    
    // Add summary
    smsMessage += `

💰 TOTAL RECURRING: $${totalMonthlyRecurring.toFixed(0)}/month`;
    
    if (recurringMerchants.length > 12) {
      smsMessage += `

📝 Showing 12 of ${recurringMerchants.length} recurring bills`;
    }
    
    // Add generation timestamp
    smsMessage += `

Generated: ${new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })} EST`;
    
    console.log('📱 Sending recurring transactions SMS:', {
      merchantCount: recurringMerchants.length,
      totalMonthly: totalMonthlyRecurring.toFixed(2),
      messageLength: smsMessage.length
    });
    
    // Send SMS via Resend API
    const smsResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Krezzo <noreply@krezzo.com>',
        to: [targetPhoneNumber],
        subject: 'Krezzo Alert',
        text: smsMessage,
      }),
    });

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      console.error('SMS send failed:', {
        status: smsResponse.status,
        statusText: smsResponse.statusText,
        error: errorText
      });
      throw new Error(`SMS failed: ${smsResponse.status} - ${errorText}`);
    }

    const smsResult = await smsResponse.json();
    console.log('✅ SMS sent successfully:', smsResult);

    return NextResponse.json({ 
      success: true, 
      message: 'Recurring transactions SMS sent successfully',
      recurringCount: recurringMerchants.length,
      totalMonthly: totalMonthlyRecurring.toFixed(2),
      smsId: smsResult.id
    });
    
  } catch (error) {
    console.error('Error sending recurring transactions SMS:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 