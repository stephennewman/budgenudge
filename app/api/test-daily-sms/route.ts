import { NextResponse } from 'next/server';
import { sendEnhancedSlickTextSMS } from '@/utils/sms/slicktext-client';
import { generateSMSMessage } from '@/utils/sms/templates';

export async function GET() {
  try {
    console.log('📱 Starting NEW TEMPLATE daily SMS test for all users...');
    
    // Hardcoded user for now (can be expanded later)
    const userId = 'bc474c8b-4b47-4c7d-b202-f469330af2a2';
    const userPhone = '+16173472721';
    
    console.log(`🔍 Testing NEW templates for user: ${userId}`);
    
    // Test all 3 new templates
            const templateTypes = ['recurring', 'recent', 'merchant-pacing', 'category-pacing'] as const;
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const templateType of templateTypes) {
      try {
        console.log(`📝 Generating ${templateType} template for user ${userId}...`);
        
        // Generate message using new template system
        const smsMessage = await generateSMSMessage(userId, templateType);
        
        console.log(`📱 ${templateType} template generated: ${smsMessage.substring(0, 100)}...`);

        // Send SMS using SlickText
        const smsResult = await sendEnhancedSlickTextSMS({
          phoneNumber: userPhone,
          message: `🧪 DAILY ${templateType.toUpperCase()} TEMPLATE - BudgeNudge\n\n${smsMessage}`,
          userId: userId
        });

        if (smsResult.success) {
          successCount++;
          results.push({ 
            userId, 
            templateType,
            status: 'sent',
            messageLength: smsMessage.length,
            messageId: smsResult.messageId,
            preview: smsMessage.substring(0, 100)
          });
          console.log(`✅ ${templateType} template sent successfully to ${userPhone}`);
        } else {
          failureCount++;
          results.push({ 
            userId, 
            templateType,
            status: 'failed', 
            error: smsResult.error,
            preview: smsMessage.substring(0, 100)
          });
          console.log(`❌ Failed to send ${templateType} template: ${smsResult.error}`);
        }

        // Add delay between sends to avoid rate limiting
        if (templateType !== templateTypes[templateTypes.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (templateError) {
        failureCount++;
        results.push({ 
          userId, 
          templateType,
          status: 'error', 
          error: templateError instanceof Error ? templateError.message : 'Unknown error' 
        });
        console.error(`❌ Error generating ${templateType} template:`, templateError);
      }
    }

    console.log(`🎉 NEW TEMPLATE daily SMS test complete: ${successCount} sent, ${failureCount} failed`);

    return NextResponse.json({
      success: successCount > 0,
      templatesProcessed: templateTypes.length,
      successCount,
      failureCount,
      results,
      timestamp: new Date().toISOString(),
      message: `NEW template system daily test: ${successCount}/${templateTypes.length} templates sent successfully`
    });

  } catch (error) {
    console.error('🚨 NEW TEMPLATE daily SMS test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 