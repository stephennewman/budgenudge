import { NextResponse } from 'next/server';
import { tagMerchantWithAI } from '@/utils/ai/merchant-tagging';

export async function POST(request: Request) {
  try {
    // Test with a sample transaction
    const testTransaction = {
      merchant_name: "PUBLIX SUPER MARKET #1234",
      name: "PUBLIX SUPER MARKET #1234 PURCHASE 07/19",
      amount: 45.67,
      category: ["Food and Drink", "Groceries"],
      subcategory: "Groceries"
    };

    console.log('🧪 Testing AI tagging with sample transaction:', testTransaction);

    // Call the AI tagging function
    const result = await tagMerchantWithAI(testTransaction);

    return NextResponse.json({
      success: true,
      message: 'AI tagging test completed successfully',
      input: testTransaction,
      output: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI tagging test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Tagging Test Endpoint - Use POST to test a sample transaction',
    sample_input: {
      merchant_name: "PUBLIX SUPER MARKET #1234",
      name: "PUBLIX SUPER MARKET #1234 PURCHASE 07/19",
      amount: 45.67,
      category: ["Food and Drink", "Groceries"],
      subcategory: "Groceries"
    }
  });
} 