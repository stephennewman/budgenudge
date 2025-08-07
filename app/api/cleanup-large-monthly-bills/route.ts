import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Remove large monthly bills from existing pacing tracking
export async function POST() {
  try {
    console.log('🧹 Starting cleanup of large monthly bills from pacing tracking...');
    
    // Define keywords and thresholds for large monthly bills
    const largeMonthlyBillKeywords = ['sentinel', 'rent', 'mortgage', 'insurance', 'prog select', 'usaa', 'geico', 'allstate', 'state farm', 'car payment', 'loan', 'housing'];
    const largeMonthlyBillCategories = ['housing', 'rent', 'mortgage', 'insurance', 'loan'];
    
    // Get all merchant pacing tracking records
    const { data: merchants, error: merchantError } = await supabase
      .from('merchant_pacing_tracking')
      .select('*');

    if (merchantError) {
      console.error('Error fetching merchant tracking records:', merchantError);
      return NextResponse.json({ success: false, error: 'Failed to fetch merchant records' });
    }

    // Get all category pacing tracking records  
    const { data: categories, error: categoryError } = await supabase
      .from('category_pacing_tracking')
      .select('*');

    if (categoryError) {
      console.error('Error fetching category tracking records:', categoryError);
      return NextResponse.json({ success: false, error: 'Failed to fetch category records' });
    }

    let removedMerchants = [];
    let removedCategories = [];

    // Identify large monthly bill merchants to remove
    if (merchants) {
      for (const merchant of merchants) {
        const isLargeMonthlyBill = largeMonthlyBillKeywords.some(keyword => 
          merchant.ai_merchant_name.toLowerCase().includes(keyword)
        );
        
        if (isLargeMonthlyBill) {
          // Get spending data to check if it's actually a large bill
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('ai_merchant_name', merchant.ai_merchant_name)
            .gte('amount', 0);

          if (transactions && transactions.length > 0) {
            const avgAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
            
            if (avgAmount >= 200) { // Large transaction threshold
              console.log(`🗑️ Removing large monthly bill merchant: ${merchant.ai_merchant_name} (avg: $${avgAmount.toFixed(2)})`);
              
              const { error: deleteError } = await supabase
                .from('merchant_pacing_tracking')
                .delete()
                .eq('id', merchant.id);

              if (!deleteError) {
                removedMerchants.push({
                  merchant: merchant.ai_merchant_name,
                  avgAmount: avgAmount.toFixed(2)
                });
              }
            }
          }
        }
      }
    }

    // Identify large monthly bill categories to remove
    if (categories) {
      for (const category of categories) {
        const isLargeMonthlyBillCategory = largeMonthlyBillCategories.some(keyword => 
          category.ai_category.toLowerCase().includes(keyword)
        );
        
        if (isLargeMonthlyBillCategory) {
          console.log(`🗑️ Removing large monthly bill category: ${category.ai_category}`);
          
          const { error: deleteError } = await supabase
            .from('category_pacing_tracking')
            .delete()
            .eq('id', category.id);

          if (!deleteError) {
            removedCategories.push(category.ai_category);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${removedMerchants.length} merchants and ${removedCategories.length} categories`,
      cleanup_summary: {
        merchants_removed: removedMerchants.length,
        categories_removed: removedCategories.length,
        total_removed: removedMerchants.length + removedCategories.length
      },
      details: {
        removed_merchants: removedMerchants,
        removed_categories: removedCategories
      },
      explanation: 'Large monthly bills (rent, mortgage, insurance) excluded from pacing analysis as they are binary (paid vs not paid) rather than gradual spending patterns'
    });

  } catch (error) {
    console.error('Large monthly bill cleanup error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
