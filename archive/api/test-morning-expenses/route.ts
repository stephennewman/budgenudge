import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testing morning expenses SMS...');
    
    // Call the actual morning expenses SMS route
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/morning-expenses-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Morning expenses SMS test completed',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test morning expenses SMS error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
