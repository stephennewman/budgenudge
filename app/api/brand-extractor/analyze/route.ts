import { NextRequest, NextResponse } from 'next/server';
import { BrandExtractor } from '@/utils/brand-extractor';

export async function POST(request: NextRequest) {
  try {
    const { email_or_domain } = await request.json();

    if (!email_or_domain || typeof email_or_domain !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid email or domain' },
        { status: 400 }
      );
    }

    const extractor = new BrandExtractor();
    
    // Infer website
    const website = await extractor.inferWebsite(email_or_domain.trim());
    
    if (!website) {
      return NextResponse.json(
        { error: 'Could not infer website. Please check the domain.' },
        { status: 400 }
      );
    }

    // Scrape brand elements
    const brandData = await extractor.scrapeBrandElements(website);
    
    if (!brandData) {
      return NextResponse.json(
        { error: 'Failed to scrape brand elements.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      brand_data: brandData
    });

  } catch (error) {
    console.error('Brand extraction error:', error);
    return NextResponse.json(
      { error: 'An error occurred while analyzing the brand' },
      { status: 500 }
    );
  }
}
