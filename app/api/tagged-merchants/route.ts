import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all tagged merchants for the user
    const { data: taggedMerchants, error } = await supabase
      .from('tagged_merchants')
      .select('*')
      .eq('user_id', user.id)
      .order('confidence_score', { ascending: false });

    if (error) {
      console.error('Error fetching tagged merchants:', error);
      return NextResponse.json({ error: 'Failed to fetch tagged merchants' }, { status: 500 });
    }

    // Get AI merchant names separately if we have merchants
    let processedMerchants = taggedMerchants || [];
    
    if (processedMerchants.length > 0) {
      // Get unique merchant patterns
      const patterns = [...new Set(processedMerchants.map(m => m.merchant_pattern).filter(Boolean))];
      
      if (patterns.length > 0) {
        // Fetch AI merchant data
        const { data: aiData } = await supabase
          .from('merchant_ai_tags')
          .select('merchant_pattern, ai_merchant_name, ai_category_tag')
          .in('merchant_pattern', patterns);
        
        // Create a lookup map
        const aiLookup = new Map();
        if (aiData) {
          aiData.forEach(ai => {
            aiLookup.set(ai.merchant_pattern, ai);
          });
        }
        
        // Add AI data to merchants
        processedMerchants = processedMerchants.map(merchant => ({
          ...merchant,
          ai_merchant_name: aiLookup.get(merchant.merchant_pattern)?.ai_merchant_name || null,
          ai_category_tag: aiLookup.get(merchant.merchant_pattern)?.ai_category_tag || null
        }));
      }
    }

    return NextResponse.json({ 
      success: true, 
      taggedMerchants: processedMerchants
    });

  } catch (error) {
    console.error('Tagged merchants API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

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
      expected_amount, 
      prediction_frequency,
      confidence_score = 75,
      auto_detected = false 
    } = body;

    // Validate required fields
    if (!merchant_name || !expected_amount || !prediction_frequency) {
      return NextResponse.json({ 
        error: 'Missing required fields: merchant_name, expected_amount, prediction_frequency' 
      }, { status: 400 });
    }

    // Calculate next predicted date based on frequency
    const now = new Date();
    let next_predicted_date;
    switch (prediction_frequency) {
      case 'weekly':
        next_predicted_date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      case 'bi-monthly':
        next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
        break;
      case 'quarterly':
        next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
        break;
      default:
        next_predicted_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    // Insert new tagged merchant
    const { data, error } = await supabase
      .from('tagged_merchants')
      .insert({
        user_id: user.id,
        merchant_name,
        merchant_pattern: merchant_name,
        expected_amount: parseFloat(expected_amount),
        prediction_frequency,
        confidence_score: parseInt(confidence_score),
        auto_detected,
        is_active: true, // ✅ FIXED: Ensure manually added merchants are active by default
        next_predicted_date: next_predicted_date.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tagged merchant:', error);
      return NextResponse.json({ 
        error: error.code === '23505' ? 'Merchant already tagged' : 'Failed to create tagged merchant' 
      }, { status: error.code === '23505' ? 409 : 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully tagged ${merchant_name} as recurring`,
      taggedMerchant: data 
    });

  } catch (error) {
    console.error('Tagged merchants POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 