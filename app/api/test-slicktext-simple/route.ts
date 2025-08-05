import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Testing simple SlickText integration...');

    // Test with hardcoded data
    const testData = {
      user_id: 'test-user-' + Date.now(),
      email: 'test@example.com',
      phone: '+16173472721', // Known working test phone
      first_name: 'Test',
      last_name: 'User'
    };

    console.log('📤 Testing with data:', testData);

    // Call the actual SlickText API
    const slickTextResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/add-user-to-slicktext`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const slickTextResult = await slickTextResponse.json();
    
    console.log('📱 SlickText response:', {
      status: slickTextResponse.status,
      ok: slickTextResponse.ok,
      result: slickTextResult
    });

    return NextResponse.json({
      success: true,
      testData,
      slickTextResponse: {
        status: slickTextResponse.status,
        ok: slickTextResponse.ok,
        result: slickTextResult
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Simple SlickText test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}