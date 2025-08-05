import { NextRequest, NextResponse } from 'next/server';
import { createSlickTextClient } from '../../../utils/sms/slicktext-client';

export async function GET() {
  try {
    console.log('🔍 Testing SlickText configuration...');

    // Check environment variables
    const hasApiKey = !!process.env.SLICKTEXT_API_KEY;
    const hasBrandId = !!process.env.SLICKTEXT_BRAND_ID;
    const hasSiteUrl = !!process.env.NEXT_PUBLIC_SITE_URL;

    console.log('🔧 Environment check:', {
      hasApiKey,
      hasBrandId,
      hasSiteUrl,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL
    });

    if (!hasApiKey || !hasBrandId) {
      return NextResponse.json({
        success: false,
        error: 'Missing SlickText environment variables',
        hasApiKey,
        hasBrandId,
        hasSiteUrl
      }, { status: 500 });
    }

    // Test SlickText connection
    const client = createSlickTextClient();
    const connectionTest = await client.testConnection();

    return NextResponse.json({
      success: true,
      environmentCheck: {
        hasApiKey,
        hasBrandId,
        hasSiteUrl,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL
      },
      slickTextConnection: connectionTest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ SlickText config test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}