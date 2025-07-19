import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { UpdateRuleRequest } from '@/utils/rules/types';

// GET - Get a specific rule
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rule, error } = await supabase
      .from('transaction_rules')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Unexpected error in GET /api/transaction-rules/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a rule
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateRuleRequest = await request.json();

    // Verify the rule exists and belongs to the user
    const { data: existingRule, error: fetchError } = await supabase
      .from('transaction_rules')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Test regex pattern if provided
    if (body.pattern_type === 'regex' && body.pattern_value) {
      try {
        new RegExp(body.pattern_value, 'i');
      } catch (error) {
        return NextResponse.json({ 
          error: 'Invalid regex pattern: ' + (error instanceof Error ? error.message : 'Unknown error')
        }, { status: 400 });
      }
    }

    // Check if new rule name conflicts (only if rule_name is being changed)
    if (body.rule_name && body.rule_name !== existingRule.rule_name) {
      const { data: conflictingRule } = await supabase
        .from('transaction_rules')
        .select('id')
        .eq('user_id', user.id)
        .eq('rule_name', body.rule_name)
        .neq('id', id)
        .single();

      if (conflictingRule) {
        return NextResponse.json({ 
          error: 'A rule with this name already exists' 
        }, { status: 409 });
      }
    }

    // Update the rule
    const { data: updatedRule, error } = await supabase
      .from('transaction_rules')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating rule:', error);
      return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
    }

    return NextResponse.json({ rule: updatedRule });
  } catch (error) {
    console.error('Unexpected error in PUT /api/transaction-rules/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a rule
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the rule exists and belongs to the user
    const { data: existingRule, error: fetchError } = await supabase
      .from('transaction_rules')
      .select('id, rule_name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Delete the rule
    const { error } = await supabase
      .from('transaction_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting rule:', error);
      return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Rule "${existingRule.rule_name}" deleted successfully` 
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/transaction-rules/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 