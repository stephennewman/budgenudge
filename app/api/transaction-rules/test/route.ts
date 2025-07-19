import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { testRule } from '@/utils/rules/engine';
import { PatternType } from '@/utils/rules/types';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      merchant_name, 
      pattern_type, 
      pattern_value, 
      normalized_merchant_name, 
      override_category 
    } = body;

    // Validate required fields
    if (!merchant_name || !pattern_type || !pattern_value) {
      return NextResponse.json({ 
        error: 'Missing required fields: merchant_name, pattern_type, pattern_value' 
      }, { status: 400 });
    }

    // Test the rule
    const result = testRule(
      merchant_name,
      pattern_type as PatternType,
      pattern_value,
      normalized_merchant_name,
      override_category
    );

    return NextResponse.json({ 
      test_result: result,
      input: {
        merchant_name,
        pattern_type,
        pattern_value,
        normalized_merchant_name,
        override_category
      }
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/transaction-rules/test:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 