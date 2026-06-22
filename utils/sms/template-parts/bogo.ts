import { supabase, type Transaction, type MerchantPacing } from './shared';
import {
  getUserFirstName,
  runEnhancedBillDetectionInTemplate,
  analyzeMerchantPatternForTemplate,
  isNonBillMerchant,
  calculateEnhancedBillScoreForTemplate,
  isBillMerchant,
  normalizeMerchantNameForTemplate,
  calculateVarianceForTemplate,
  findNextIncome,
  normalizeIncomeSourceName,
  generateAIVibeMessage,
  generateEnhancedAIVibeMessage,
  generateActionItems,
} from './helpers';
import { generateBOGODinnerPlan } from '@/utils/bogo-dinner-plan';

export async function generateBOGODinnerPlanSMS(): Promise<string> {
  try {
    // Get the most recent post and its deals
    const { data: latestPost } = await supabase
      .from('deal_posts')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestPost) {
      return '🍽️ BOGO Dinner Plan\n\nNo deals available at the moment.';
    }

    // Fetch BOGO deals
    const { data: deals } = await supabase
      .from('deals')
      .select('id, title, price_text')
      .eq('post_id', latestPost.id)
      .ilike('promo_type', '%BOGO%')
      .limit(300);

    if (!deals || deals.length === 0) {
      return '🍽️ BOGO Dinner Plan\n\nNo BOGO deals available this week.';
    }

    // Add basic categorization and generate dinner plan
    const bogoDeals = deals.map(deal => ({
      ...deal,
      category: 'misc' // Basic categorization
    }));

    const dinnerPlan = generateBOGODinnerPlan(bogoDeals);
    
    // Format for SMS (condensed version)
    let smsText = '🍽️ BOGO Dinner Plan Sample\n\n';
    
    // Show first 3 main meals
    const mainMeals = dinnerPlan.mainMeals.slice(0, 3);
    mainMeals.forEach(meal => {
      smsText += `📍 ${meal.day}: ${meal.theme}\n`;
      meal.items.forEach(item => {
        const cleanName = item.name.split(',')[0]; // Take first part before comma
        smsText += `${item.emoji} ${cleanName} (BOGO ${item.price})\n`;
      });
      smsText += `💰 Get ${meal.totalItems} items, pay for ${meal.items.length} = $${meal.totalCost} for 2 dinners\n\n`;
    });

    // Add summary
    smsText += `🎯 Every item is BOGO = 50% off everything!\n`;
    smsText += `See full 7-day plan: budgenudge.com/bogo-dinner-plan`;

    return smsText;

  } catch (error) {
    console.error('Error generating BOGO dinner plan SMS:', error);
    return '🍽️ BOGO Dinner Plan\n\nError generating meal plan. Please try again later.';
  }
}
