import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Exploring SlickText API endpoints...');
    
    const apiKey = process.env.SLICKTEXT_API_KEY;
    const brandId = process.env.SLICKTEXT_BRAND_ID;
    
    if (!apiKey || !brandId) {
      return NextResponse.json({
        success: false,
        error: 'Missing SlickText credentials'
      }, { status: 400 });
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const results = [];

    // Test different potential endpoints
    const endpointsToTest = [
      // Brand-specific endpoints
      { url: `https://dev.slicktext.com/v1/brands/${brandId}`, name: 'Brand Info' },
      { url: `https://dev.slicktext.com/v1/brands/${brandId}/campaigns`, name: 'Brand Campaigns' },
      { url: `https://dev.slicktext.com/v1/brands/${brandId}/contacts`, name: 'Brand Contacts' },
      { url: `https://dev.slicktext.com/v1/brands/${brandId}/messages`, name: 'Brand Messages' },
      { url: `https://dev.slicktext.com/v1/brands/${brandId}/inbox`, name: 'Brand Inbox' },
      { url: `https://dev.slicktext.com/v1/brands/${brandId}/inbox/messages`, name: 'Inbox Messages' },
      
      // Direct endpoints
      { url: `https://dev.slicktext.com/v1/campaigns`, name: 'Global Campaigns' },
      { url: `https://dev.slicktext.com/v1/contacts`, name: 'Global Contacts' },
      { url: `https://dev.slicktext.com/v1/messages`, name: 'Global Messages' },
      { url: `https://dev.slicktext.com/v1/sms`, name: 'Direct SMS' },
      { url: `https://dev.slicktext.com/v1/send`, name: 'Send Endpoint' },
    ];

    console.log(`🧪 Testing ${endpointsToTest.length} potential endpoints...`);

    for (const endpoint of endpointsToTest) {
      try {
        console.log(`Testing: ${endpoint.name} - ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          method: 'GET',
          headers,
        });

        const responseText = await response.text();
        let responseData = responseText;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Keep as text if not JSON
        }

        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          data: response.ok ? responseData : null,
          error: !response.ok ? responseData : null
        });

        console.log(`✅ ${endpoint.name}: ${response.status} ${response.statusText}`);
        
        // Don't overwhelm the API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
        
        console.log(`❌ ${endpoint.name}: ${error}`);
      }
    }

    const successfulEndpoints = results.filter(r => r.success);
    const failedEndpoints = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful: successfulEndpoints.length,
        failed: failedEndpoints.length
      },
      successfulEndpoints: successfulEndpoints.map(e => ({
        name: e.endpoint,
        url: e.url,
        status: e.status,
        hasData: !!e.data
      })),
      detailedResults: results,
      recommendations: successfulEndpoints.length > 0 ? 
        `Found ${successfulEndpoints.length} working endpoints. Check the detailed results for potential messaging endpoints.` :
        'No working endpoints found. The API structure might be different than expected.'
    });

  } catch (error: unknown) {
    console.error('❌ SlickText exploration error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Exploration failed'
    }, { status: 500 });
  }
} 