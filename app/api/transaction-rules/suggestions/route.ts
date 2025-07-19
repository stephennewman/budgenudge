import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { generateRuleSuggestions } from '@/utils/rules/engine';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { merchant_name } = body;

    if (!merchant_name) {
      return NextResponse.json({ 
        error: 'merchant_name is required' 
      }, { status: 400 });
    }

    // Generate suggestions
    const suggestions = generateRuleSuggestions(merchant_name);

    return NextResponse.json({ 
      merchant_name,
      suggestions 
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/transaction-rules/suggestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 