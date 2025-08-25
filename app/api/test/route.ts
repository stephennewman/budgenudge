import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('type') || 'default';
    
    // Handle different test types
    switch (testType) {
      case 'sms':
        return NextResponse.json({ message: 'SMS test endpoint', type: 'sms' });
      case 'ai':
        return NextResponse.json({ message: 'AI test endpoint', type: 'ai' });
      case 'transactions':
        return NextResponse.json({ message: 'Transaction test endpoint', type: 'transactions' });
      default:
        return NextResponse.json({ 
          message: 'Test endpoint - specify type via ?type=sms|ai|transactions',
          availableTypes: ['sms', 'ai', 'transactions']
        });
    }
  } catch {
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType, ...data } = body;
    
    return NextResponse.json({ 
      message: `POST test for ${testType || 'unknown'}`, 
      data 
    });
  } catch {
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
