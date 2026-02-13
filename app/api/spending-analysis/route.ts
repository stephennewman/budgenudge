import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/utils/supabase/server';

interface CategoryAnalysis {
  name: string;
  total: number;
  percentage: number;
  count: number;
  icon: string;
}

interface MerchantAnalysis {
  name: string;
  total: number;
  count: number;
  category: string;
}

// Category icon mapping based on AI category tags
const categoryIcons: Record<string, string> = {
  'Food & Dining': '🍔',
  'Restaurants': '🍔', 
  'Groceries': '🛒',
  'Gas & Fuel': '⛽',
  'Transportation': '🚗',
  'Entertainment': '🎬',
  'Shopping': '🛍️',
  'Subscriptions': '📱',
  'Bills & Utilities': '💡',
  'Healthcare': '🏥',
  'Personal Care': '💄',
  'Travel': '✈️',
  'Education': '📚',
  'Business': '💼',
  'Fees & Charges': '💳',
  'Income': '💰',
  'Transfer': '🔄',
  'Other': '📦'
};

function getCategoryIcon(category: string): string {
  // Try exact match first
  if (categoryIcons[category]) {
    return categoryIcons[category];
  }
  
  // Try partial matches
  const lowercaseCategory = category.toLowerCase();
  if (lowercaseCategory.includes('food') || lowercaseCategory.includes('restaurant') || lowercaseCategory.includes('dining')) {
    return '🍔';
  }
  if (lowercaseCategory.includes('grocery') || lowercaseCategory.includes('supermarket')) {
    return '🛒';
  }
  if (lowercaseCategory.includes('gas') || lowercaseCategory.includes('fuel')) {
    return '⛽';
  }
  if (lowercaseCategory.includes('transport') || lowercaseCategory.includes('uber') || lowercaseCategory.includes('lyft')) {
    return '🚗';
  }
  if (lowercaseCategory.includes('entertainment') || lowercaseCategory.includes('movie') || lowercaseCategory.includes('music')) {
    return '🎬';
  }
  if (lowercaseCategory.includes('shopping') || lowercaseCategory.includes('retail')) {
    return '🛍️';
  }
  if (lowercaseCategory.includes('subscription') || lowercaseCategory.includes('netflix') || lowercaseCategory.includes('spotify')) {
    return '📱';
  }
  
  return '📦'; // Default icon
}

export async function POST() {
  try {
    const supabase = await createSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's item IDs to filter transactions
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('plaid_item_id')
      .eq('user_id', user.id);

    if (itemsError || !items?.length) {
      return NextResponse.json({ error: 'No connected accounts found' }, { status: 400 });
    }

    const itemIds = items.map(item => item.plaid_item_id);

    // Get all tagged transactions from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, amount, ai_merchant_name, ai_category_tag, date, merchant_name, name')
      .in('plaid_item_id', itemIds)
      .not('ai_merchant_name', 'is', null) // Only analyze tagged transactions
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .gt('amount', 0) // Only expenses (positive amounts in Plaid)
      .order('date', { ascending: false });

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ 
        categories: [],
        merchants: [],
        totalSpending: 0,
        timeframe: 'last 90 days'
      });
    }

    // Calculate total spending
    const totalSpending = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Group by category
    const categoryGroups = new Map<string, { total: number; count: number }>();
    transactions.forEach(tx => {
      const category = tx.ai_category_tag || 'Other';
      const existing = categoryGroups.get(category) || { total: 0, count: 0 };
      categoryGroups.set(category, {
        total: existing.total + tx.amount,
        count: existing.count + 1
      });
    });

    // Convert to category analysis with percentages
    const categories: CategoryAnalysis[] = Array.from(categoryGroups.entries())
      .map(([name, data]) => ({
        name,
        total: Math.round(data.total * 100) / 100, // Round to cents
        percentage: (data.total / totalSpending) * 100,
        count: data.count,
        icon: getCategoryIcon(name)
      }))
      .sort((a, b) => b.total - a.total) // Sort by spending amount
      .slice(0, 8); // Top 8 categories

    // Group by merchant
    const merchantGroups = new Map<string, { total: number; count: number; category: string }>();
    transactions.forEach(tx => {
      const merchantName = tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown';
      const existing = merchantGroups.get(merchantName) || { total: 0, count: 0, category: tx.ai_category_tag || 'Other' };
      merchantGroups.set(merchantName, {
        total: existing.total + tx.amount,
        count: existing.count + 1,
        category: existing.category
      });
    });

    // Convert to merchant analysis
    const merchants: MerchantAnalysis[] = Array.from(merchantGroups.entries())
      .map(([name, data]) => ({
        name,
        total: Math.round(data.total * 100) / 100, // Round to cents
        count: data.count,
        category: data.category
      }))
      .sort((a, b) => b.total - a.total) // Sort by spending amount
      .slice(0, 8); // Top 8 merchants

    const result = {
      categories,
      merchants,
      totalSpending: Math.round(totalSpending * 100) / 100,
      timeframe: 'last 90 days'
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Spending analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate spending analysis' },
      { status: 500 }
    );
  }
}