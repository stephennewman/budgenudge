import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    console.log(`🔧 Fixing income profile for user: ${userId}`);
    
    // 1. Get current profile
    const { data: existingProfile } = await supabase
      .from('user_income_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    console.log('Existing profile:', existingProfile);
    
    // 2. Run fresh income detection
    const analysisResponse = await fetch('http://localhost:3000/api/income-detection/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, lookback_months: 6 })
    });
    
    const analysisResult = await analysisResponse.json();
    
    if (!analysisResult.success || !analysisResult.result?.patterns_detected?.length) {
      return NextResponse.json({ 
        error: 'No income patterns detected',
        analysis: analysisResult 
      });
    }
    
    // 3. Transform to the expected format
    const incomeProfileData = {
      income_sources: analysisResult.result.patterns_detected.map((pattern: { source_name?: string; frequency?: string; intervals?: number[]; expected_amount?: number; confidence_score?: number; dates?: string[]; account_id?: string }) => ({
        source_name: pattern.source_name,
        pattern_type: pattern.frequency,
        schedule: {
          frequency: pattern.frequency,
          intervals: pattern.intervals
        },
        amount: pattern.expected_amount,
        expected_amount: pattern.expected_amount,
        confidence_score: pattern.confidence_score,
        next_predicted_date: pattern.dates?.[pattern.dates.length - 1] || null,
        last_pay_date: pattern.dates?.[pattern.dates.length - 2] || null,
        account_id: pattern.account_id,
        frequency: pattern.frequency,
        person: 'user'
      })),
      shared_account: false,
      setup_complete: true,
      analysis_confidence: analysisResult.result.analysis_confidence,
      last_updated: new Date().toISOString()
    };
    
    // 4. Update the profile
    const { error: updateError } = await supabase
      .from('user_income_profiles')
      .upsert({
        user_id: userId,
        profile_data: incomeProfileData,
        setup_completed: true,
        last_conversation_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Income profile fixed successfully',
      before: existingProfile?.profile_data,
      after: incomeProfileData,
      patternsFound: analysisResult.result.patterns_detected.length,
      confidence: analysisResult.result.analysis_confidence
    });
    
  } catch (error) {
    console.error('Fix profile error:', error);
    return NextResponse.json({ 
      error: 'Failed to fix income profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
