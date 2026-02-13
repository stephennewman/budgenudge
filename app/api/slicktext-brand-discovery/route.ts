import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.SLICKTEXT_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'SLICKTEXT_API_KEY not found in environment',
        help: 'Please add your SlickText API key to environment variables'
      }, { status: 400 });
    }

    // Method 1: Try to get user/account info (might show brand ID)
    try {
      const response = await fetch('https://dev.slicktext.com/v1/user', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          method: 'user_endpoint',
          data: data,
          message: 'Found user data - check for brand_id or similar field',
          nextSteps: [
            'Look for brand_id, account_id, or similar in the response above',
            'Check your SlickText dashboard URL for brand ID',
            'Look in SlickText Settings → Account/Brand Information'
          ]
        });
      }
    } catch {
    }

    // Method 2: Try account endpoint
    try {
      const response = await fetch('https://dev.slicktext.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          method: 'account_endpoint',
          data: data,
          message: 'Found account data - check for brand_id or similar field'
        });
      }
    } catch {
    }

    // Method 3: Try brands list endpoint (if it exists)
    try {
      const response = await fetch('https://dev.slicktext.com/v1/brands', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          method: 'brands_list',
          data: data,
          message: 'Found brands list - your brand ID should be in this response!'
        });
      }
    } catch {
    }

    // If all methods failed, provide manual instructions
    return NextResponse.json({
      success: false,
      error: 'Could not automatically discover Brand ID',
      manualSteps: {
        message: 'Please find your Brand ID manually using these methods:',
        methods: [
          {
            step: 1,
            method: 'SlickText Dashboard URL',
            instruction: 'Log into SlickText and check the URL - it often contains your brand ID',
            example: 'https://app.slicktext.com/brands/123456/dashboard (123456 is your brand ID)'
          },
          {
            step: 2,
            method: 'Account Settings',
            instruction: 'Go to Settings → Account Information or Brand Settings',
            note: 'Look for Brand ID, Account ID, or similar identifier'
          },
          {
            step: 3,
            method: 'API Key Settings',
            instruction: 'In the same area where you found your API key, brand ID is often displayed',
            location: 'Settings → API & Webhooks → Brand Information'
          },
          {
            step: 4,
            method: 'Support',
            instruction: 'Contact SlickText support if you cannot locate your brand ID',
            note: 'They can provide it quickly via chat or email'
          }
        ]
      },
      nextStep: 'Once you have the Brand ID, add it as SLICKTEXT_BRAND_ID environment variable'
    });

  } catch (error: unknown) {
    console.error('❌ Brand discovery error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Brand discovery failed',
      troubleshooting: {
        possibleCauses: [
          'Invalid API key format',
          'API key might be for different SlickText environment',
          'Network connectivity issues',
          'SlickText API changes'
        ],
        suggestions: [
          'Verify API key is copied correctly from SlickText dashboard',
          'Check if you need to use a different base URL (production vs development)',
          'Try accessing SlickText dashboard to confirm account status'
        ]
      }
    }, { status: 500 });
  }
} 