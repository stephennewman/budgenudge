import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { generateSMSMessage } from '@/utils/sms/templates';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const startTime = new Date();
  const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2'; // Stephen's user ID
  
  try {
    console.log('🧪 Starting NEW SMS template test...');
    
    // Get user's bank connections
    const { data: userItems, error: itemsError } = await supabase
      .from('items')
      .select('id, plaid_item_id')
      .eq('user_id', userId);

    if (itemsError || !userItems || userItems.length === 0) {
      console.log('📭 TEST SMS: No bank connections found for user');
      return NextResponse.json({ 
        success: false, 
        error: 'No bank connections found',
        timestamp: startTime.toISOString()
      });
    }

    console.log(`📊 TEST SMS: Found ${userItems.length} bank connections`);

    // Test all 3 new templates
    const templateTypes = ['recurring', 'recent', 'merchant-pacing', 'category-pacing'] as const;
    const results = [];

    for (const templateType of templateTypes) {
      try {
        console.log(`📝 Testing ${templateType} template...`);
        
        // Generate message using new template system
        const smsMessage = await generateSMSMessage(userId, templateType);
        
        console.log(`📱 ${templateType} template generated (${smsMessage.length} chars): ${smsMessage.substring(0, 100)}...`);

        // Send SMS using SlickText
        const testNumber = '+16173472721'; // Your phone number
        const fullMessage = `🧪 NEW ${templateType.toUpperCase()} TEMPLATE (${startTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST)\n\n${smsMessage}`;
        
        console.log(`📤 Sending ${templateType} SMS to ${testNumber} (${fullMessage.length} total chars)`);
        
        const smsResult = await sendEnhancedSlickTextSMS({
          phoneNumber: testNumber,
          message: fullMessage,
          userId: userId
        });

        results.push({
          templateType,
          success: smsResult.success,
          messageLength: fullMessage.length,
          preview: smsMessage.substring(0, 100),
          error: smsResult.error || null,
          messageId: smsResult.messageId || null
        });

        console.log(`${smsResult.success ? '✅' : '❌'} ${templateType} template ${smsResult.success ? 'sent successfully' : 'failed'}`);

        // Add delay between sends
        if (templateType !== templateTypes[templateTypes.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (templateError) {
        console.error(`❌ Error with ${templateType} template:`, templateError);
        results.push({
          templateType,
          success: false,
          error: templateError instanceof Error ? templateError.message : 'Unknown error'
        });
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const successCount = results.filter(r => r.success).length;

    console.log(`🎉 NEW template test complete: ${successCount}/${results.length} templates sent successfully in ${duration}ms`);

    return NextResponse.json({
      success: successCount > 0,
      templatesCount: results.length,
      successCount,
      results,
      durationMs: duration,
      timestamp: endTime.toISOString(),
      message: `NEW template system test: ${successCount}/${results.length} templates sent successfully`
    });

  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.error('❌ NEW template test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: duration,
      timestamp: endTime.toISOString()
    }, { status: 500 });
  }
} 