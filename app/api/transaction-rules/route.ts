import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { CreateRuleRequest } from '@/utils/rules/types';

// GET - List all rules for the current user
export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's rules
    const { data: rules, error } = await supabase
      .from('transaction_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching rules:', error);
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/transaction-rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new rule
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateRuleRequest = await request.json();
    
    // Validate required fields
    if (!body.rule_name || !body.rule_type || !body.pattern_type || !body.pattern_value) {
      return NextResponse.json({ 
        error: 'Missing required fields: rule_name, rule_type, pattern_type, pattern_value' 
      }, { status: 400 });
    }

    // Validate rule type requirements
    if ((body.rule_type === 'merchant_normalize' || body.rule_type === 'combined') && !body.normalized_merchant_name) {
      return NextResponse.json({ 
        error: 'normalized_merchant_name is required for merchant_normalize and combined rules' 
      }, { status: 400 });
    }

    if ((body.rule_type === 'category_override' || body.rule_type === 'combined') && !body.override_category) {
      return NextResponse.json({ 
        error: 'override_category is required for category_override and combined rules' 
      }, { status: 400 });
    }

    // Test regex pattern if provided
    if (body.pattern_type === 'regex') {
      try {
        new RegExp(body.pattern_value, 'i');
      } catch (error) {
        return NextResponse.json({ 
          error: 'Invalid regex pattern: ' + (error instanceof Error ? error.message : 'Unknown error')
        }, { status: 400 });
      }
    }

    // Check if rule name already exists for this user
    const { data: existingRule } = await supabase
      .from('transaction_rules')
      .select('id')
      .eq('user_id', user.id)
      .eq('rule_name', body.rule_name)
      .single();

    if (existingRule) {
      return NextResponse.json({ 
        error: 'A rule with this name already exists' 
      }, { status: 409 });
    }

    // Create the rule
    const { data: newRule, error } = await supabase
      .from('transaction_rules')
      .insert({
        user_id: user.id,
        rule_name: body.rule_name,
        rule_type: body.rule_type,
        pattern_type: body.pattern_type,
        pattern_value: body.pattern_value,
        normalized_merchant_name: body.normalized_merchant_name,
        override_category: body.override_category,
        priority: body.priority || 100,
        description: body.description,
        is_active: true,
        auto_generated: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating rule:', error);
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }

    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/transaction-rules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 