import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🧪 Testing auto AI tagging process manually...');
    
    // Get the cron secret from environment
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ 
        error: 'CRON_SECRET not configured' 
      }, { status: 500 });
    }

    // Call the auto AI tagging endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auto-ai-tag-new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        success: false,
        error: 'Auto AI tagging failed',
        details: result,
        status: response.status
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Auto AI tagging test completed successfully',
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Auto AI tagging test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Auto AI Tagging Test Endpoint',
    description: 'Manually triggers the auto AI tagging process for testing',
    usage: 'POST to this endpoint to test auto AI tagging',
    note: 'This calls the same endpoint that the cron job uses'
  });
} 