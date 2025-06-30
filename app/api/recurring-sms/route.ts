import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  first_transaction_date: string;
  last_transaction_date: string;
}

interface RecurringTransactionWithNextDate extends RecurringTransaction {
  next_predicted_date: Date;
  days_until_next: number;
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

    // Default phone number (the one already configured)
    const targetPhoneNumber = phoneNumber || '6173472721@tmomail.net';
    
    console.log('🔄 Fetching recurring transactions for user:', userId);
    
    // Fetch recurring merchants from the database with date information
    const { data: recurringMerchants, error: dbError } = await supabase
      .from('merchant_analytics')
      .select('merchant_name, total_transactions, total_spending, avg_monthly_spending, recurring_reason, is_recurring, first_transaction_date, last_transaction_date')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .limit(20); // Get more to sort by date, then take top 12

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch recurring transactions' 
      }, { status: 500 });
    }

    if (!recurringMerchants || recurringMerchants.length === 0) {
      const noRecurringMessage = `📊 BudgeNudge Recurring Bills

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
          from: 'BudgeNudge <noreply@krezzo.com>',
          to: [targetPhoneNumber],
          subject: 'BudgeNudge Alert',
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

    // Calculate predicted next payment dates
    const today = new Date();
    const recurringWithDates: RecurringTransactionWithNextDate[] = recurringMerchants
      .filter(merchant => merchant.first_transaction_date && merchant.last_transaction_date)
      .map((merchant: RecurringTransaction) => {
        const firstDate = new Date(merchant.first_transaction_date);
        const lastDate = new Date(merchant.last_transaction_date);
        
        // Calculate average interval between transactions
        const daysBetween = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        const avgInterval = merchant.total_transactions > 1 
          ? Math.max(7, daysBetween / (merchant.total_transactions - 1)) // Minimum 7 days
          : 30; // Default to monthly if only one transaction
        
        // Predict next payment date
        const nextDate = new Date(lastDate.getTime() + (avgInterval * 24 * 60 * 60 * 1000));
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          ...merchant,
          next_predicted_date: nextDate,
          days_until_next: daysUntil
        };
      })
      .sort((a, b) => a.days_until_next - b.days_until_next); // Sort by soonest first

    // Format recurring transactions for SMS
    let smsMessage = `📊 BudgeNudge Recurring Bills
(Sorted by next payment due)

`;
    
    let totalMonthlyRecurring = 0;
    const messageLines: string[] = [];
    
    recurringWithDates.slice(0, 12).forEach((merchant: RecurringTransactionWithNextDate, index: number) => {
      const monthlyAmount = merchant.avg_monthly_spending || 0;
      totalMonthlyRecurring += monthlyAmount;
      
      // Format merchant name (truncate if too long)
      let merchantName = merchant.merchant_name;
      if (merchantName.length > 18) {
        merchantName = merchantName.substring(0, 15) + '...';
      }
      
      // Format next payment date
      let dateStr = '';
      if (merchant.days_until_next <= 0) {
        dateStr = 'DUE NOW! 🚨';
      } else if (merchant.days_until_next === 1) {
        dateStr = 'Tomorrow';
      } else if (merchant.days_until_next <= 7) {
        dateStr = `${merchant.days_until_next}d`;
      } else {
        const nextDate = merchant.next_predicted_date;
        dateStr = nextDate.toLocaleDateString('en-US', { 
          timeZone: 'America/New_York',
          month: 'short', 
          day: 'numeric' 
        });
      }
      
      messageLines.push(`${index + 1}. ${merchantName}
   $${monthlyAmount.toFixed(0)}/mo • ${dateStr}`);
    });
    
    smsMessage += messageLines.join('\n\n');
    
    // Add summary
    smsMessage += `

💰 TOTAL RECURRING: $${totalMonthlyRecurring.toFixed(0)}/month`;
    
    if (recurringWithDates.length > 12) {
      smsMessage += `

📝 Showing 12 of ${recurringWithDates.length} recurring bills`;
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
      merchantCount: recurringWithDates.length,
      totalMonthly: totalMonthlyRecurring.toFixed(2),
      messageLength: smsMessage.length,
      soonestPayment: recurringWithDates[0]?.days_until_next
    });
    
    // Send SMS via Resend API
    const smsResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BudgeNudge <noreply@krezzo.com>',
        to: [targetPhoneNumber],
        subject: 'BudgeNudge Alert',
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
      recurringCount: recurringWithDates.length,
      totalMonthly: totalMonthlyRecurring.toFixed(2),
      smsId: smsResult.id,
      soonestDays: recurringWithDates[0]?.days_until_next
    });
    
  } catch (error) {
    console.error('Error sending recurring transactions SMS:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 