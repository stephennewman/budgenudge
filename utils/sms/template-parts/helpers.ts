import { supabase, type Transaction, type MerchantPacing } from './shared';

export async function getUserFirstName(userId: string): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single();

    if (profile?.first_name) {
      return profile.first_name;
    }

    // Fallback to user metadata
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    if (user.user?.user_metadata?.firstName) {
      return user.user.user_metadata.firstName;
    }

    return null;
  } catch (error) {
    console.error('Error getting user first name:', error);
    return null;
  }
}

// ===================================
// ENHANCED BILL DETECTION FOR TEMPLATES
// ===================================

export function runEnhancedBillDetectionInTemplate(transactions: any[]) {
  // Group transactions by merchant
  const merchantGroups: Record<string, any[]> = {};
  
  transactions.forEach(tx => {
    if ((tx.amount || 0) <= 0) return; // Only expenses
    
    const merchant = normalizeMerchantNameForTemplate(tx.ai_merchant_name || tx.merchant_name || tx.name || 'Unknown');
    
    if (!merchantGroups[merchant]) {
      merchantGroups[merchant] = [];
    }
    merchantGroups[merchant].push(tx);
  });
  
  const detectedBills = [];
  
  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    // Enhanced: Accept 2+ transactions (was 5+ in old system)
    if (txs.length < 2) continue;
    
    // Filter out non-bill merchants
    if (isNonBillMerchant(merchant)) continue;
    
    // Sort by date
    const sortedTxs = txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Analyze patterns
    const analysis = analyzeMerchantPatternForTemplate(sortedTxs);
    
    // Enhanced scoring with bill-specific criteria
    const score = calculateEnhancedBillScoreForTemplate(analysis, txs.length, merchant);
    
    // Higher threshold for better quality (60+ instead of 50+)
    if (score >= 60) {
      detectedBills.push({
        merchant: merchant,
        transactionCount: txs.length,
        averageAmount: analysis.averageAmount,
        frequency: analysis.frequency,
        confidenceScore: score
      });
    }
  }
  
  return detectedBills.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export function analyzeMerchantPatternForTemplate(transactions: any[]) {
  const amounts = transactions.map(tx => tx.amount);
  const dates = transactions.map(tx => new Date(tx.date));
  
  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const daysBetween = Math.round((dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(daysBetween);
  }
  
  const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const amountVariance = calculateVarianceForTemplate(amounts);
  const averageInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  
  // Determine frequency
  let frequency = 'unknown';
  if (averageInterval >= 25 && averageInterval <= 35) frequency = 'monthly';
  else if (averageInterval >= 12 && averageInterval <= 16) frequency = 'biweekly';
  else if (averageInterval >= 6 && averageInterval <= 8) frequency = 'weekly';
  else if (averageInterval >= 85 && averageInterval <= 95) frequency = 'quarterly';
  
  return {
    averageAmount,
    amountVariance,
    averageInterval,
    frequency
  };
}

export function isNonBillMerchant(merchant: string): boolean {
  const nonBillKeywords = [
    // Travel & Vacation
    'vrbo', 'airbnb', 'booking', 'expedia', 'hotel', 'motel', 'inn', 'resort', 'travelocity',
    'kayak', 'priceline', 'orbitz', 'trip', 'vacation', 'cruise', 'airline', 'flights',
    
    // Retail & Shopping
    'amazon', 'target', 'walmart', 'costco', 'sams club', 'best buy', 'home depot', 'lowes',
    'macys', 'nordstrom', 'kohls', 'tj maxx', 'marshalls', 'ross', 'old navy', 'gap',
    
    // Groceries & Food
    'publix', 'kroger', 'safeway', 'whole foods', 'trader joe', 'aldi', 'wegmans', 'harris teeter',
    'food lion', 'giant', 'stop shop', 'wegmans', 'meijer', 'hy vee', 'winn dixie',
    'mcdonald', 'burger king', 'wendy', 'taco bell', 'kfc', 'subway', 'chipotle', 'panera',
    'starbucks', 'dunkin', 'coffee', 'restaurant', 'cafe', 'diner', 'pizza', 'domino',
    
    // Gas Stations
    'shell', 'exxon', 'bp', 'chevron', 'mobil', 'citgo', 'sunoco', 'marathon', 'speedway',
    'wawa', 'sheetz', 'race trac', 'circle k', '7-eleven', 'casey', 'quick trip',
    
    // Entertainment
    'movie', 'theater', 'cinema', 'amc', 'regal', 'dave buster', 'top golf', 'bowling',
    'theme park', 'six flags', 'disney', 'universal', 'zoo', 'museum', 'aquarium',
    
    // One-time Services
    'uber', 'lyft', 'taxi', 'parking', 'toll', 'venmo', 'paypal', 'zelle', 'cash app',
    'apple pay', 'google pay', 'atm withdrawal', 'check deposit', 'transfer',
    
    // Variable Shopping
    'etsy', 'ebay', 'facebook', 'instagram', 'social', 'marketplace', 'craigslist'
  ];
  
  const merchantLower = merchant.toLowerCase();
  return nonBillKeywords.some(keyword => merchantLower.includes(keyword));
}

export function calculateEnhancedBillScoreForTemplate(analysis: any, txCount: number, merchant: string): number {
  let score = 0;
  
  // Bill-specific merchant bonus (0-20 points)
  if (isBillMerchant(merchant)) score += 20;
  
  // Transaction frequency score (0-25 points) - More strict for bills
  if (txCount >= 6) score += 25;
  else if (txCount >= 4) score += 20;
  else if (txCount >= 3) score += 15;
  else if (txCount >= 2) score += 8; // Lower for just 2 transactions
  
  // Regularity score (0-35 points) - Higher weight for bills
  if (analysis.frequency === 'monthly') score += 35;
  else if (analysis.frequency === 'quarterly') score += 30;
  else if (analysis.frequency === 'biweekly') score += 25;
  else if (analysis.frequency === 'weekly') score += 15; // Lower for weekly (less common for bills)
  else if (analysis.averageInterval > 25 && analysis.averageInterval < 40) score += 20; // Monthly-ish
  
  // Amount consistency score (0-25 points) - Strict for bills
  const varianceRatio = analysis.averageAmount > 0 ? analysis.amountVariance / analysis.averageAmount : 1;
  if (varianceRatio < 0.05) score += 25; // Very consistent
  else if (varianceRatio < 0.15) score += 20; // Mostly consistent
  else if (varianceRatio < 0.30) score += 15; // Somewhat variable (utilities)
  else if (varianceRatio < 0.50) score += 8;  // Variable (subscriptions with changes)
  
  // Amount range bonus (0-10 points) - Bills tend to be in certain ranges
  if (analysis.averageAmount >= 50) score += 10; // Substantial bills
  else if (analysis.averageAmount >= 20) score += 5; // Medium bills
  
  return Math.round(score);
}

export function isBillMerchant(merchant: string): boolean {
  const billKeywords = [
    // Utilities
    'electric', 'energy', 'power', 'gas', 'water', 'sewer', 'utility', 'duke energy', 
    'pge', 'con ed', 'national grid', 'xcel energy', 'dte energy', 'commonwealth edison',
    
    // Internet/Cable/Phone
    'internet', 'cable', 'verizon', 'att', 'tmobile', 't-mobile', 'sprint', 'comcast', 
    'spectrum', 'cox', 'charter', 'dish', 'directv', 'xfinity', 'fios', 'optimum',
    
    // Insurance
    'insurance', 'geico', 'state farm', 'allstate', 'progressive', 'farmers', 'usaa',
    'liberty mutual', 'nationwide', 'aetna', 'blue cross', 'humana', 'kaiser', 'cigna',
    
    // Financial Services
    'loan', 'mortgage', 'credit', 'bank', 'chase', 'wells fargo', 'citi', 'capital one',
    'discover', 'american express', 'servicing', 'lending', 'finance', 'payment',
    
    // Subscriptions
    'netflix', 'hulu', 'disney', 'spotify', 'apple music', 'amazon prime', 'gym',
    'fitness', 'membership', 'subscription', 'monthly', 'annual', 'recurring',
    
    // Healthcare
    'medical', 'health', 'doctor', 'dental', 'vision', 'pharmacy', 'hospital', 'clinic',
    'urgent care', 'therapy', 'prescription', 'medicare', 'medicaid',
    
    // Education
    'tuition', 'school', 'university', 'college', 'student loan', 'education', 'learning',
    
    // Government/Taxes
    'tax', 'irs', 'dmv', 'license', 'registration', 'permit', 'fine', 'court', 'government',
    
    // Charity/Donations
    'donation', 'charity', 'church', 'temple', 'mosque', 'tithe', 'offering', 'compassion',
    'red cross', 'salvation army', 'goodwill', 'united way'
  ];
  
  const merchantLower = merchant.toLowerCase();
  return billKeywords.some(keyword => merchantLower.includes(keyword));
}

export function normalizeMerchantNameForTemplate(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateVarianceForTemplate(numbers: number[]): number {
  if (numbers.length <= 1) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

// ===================================
// UNIFIED TEMPLATE SELECTOR (UPDATED)
// ===================================
export function findNextIncome(incomeCandidates: any[]): any {
  if (!incomeCandidates || incomeCandidates.length === 0) return null;

  // Check if we have structured income data from user_income_profiles
  if (incomeCandidates[0]?.source_name && incomeCandidates[0]?.frequency) {
    // Use structured income data
    const now = new Date();
    const upcomingIncomes: Array<{ source_name: string; expected_amount: number; next_predicted_date: string }>= [];

    for (const source of incomeCandidates) {
      let nextDate: Date;
      
      if (source.next_predicted_date && new Date(source.next_predicted_date) >= now) {
        // Use manual override if it's in the future
        nextDate = new Date(source.next_predicted_date);
      } else if (source.last_pay_date) {
        // Calculate from last payment date
        nextDate = new Date(source.last_pay_date);
        
        // Add frequency-based days
        switch (source.frequency) {
          case 'weekly':
            while (nextDate <= now) {
              nextDate.setDate(nextDate.getDate() + 7);
            }
            break;
          case 'bi-weekly':
            while (nextDate <= now) {
              nextDate.setDate(nextDate.getDate() + 14);
            }
            break;
          case 'bi-monthly':
            while (nextDate <= now) {
              nextDate.setMonth(nextDate.getMonth() + 1);
              nextDate.setDate(15); // Assume 15th of month
            }
            break;
          case 'monthly':
            while (nextDate <= now) {
              nextDate.setMonth(nextDate.getMonth() + 1);
            }
            break;
          default:
            continue; // Skip irregular sources
        }
      } else {
        continue; // Skip if no date information
      }

      upcomingIncomes.push({
        source_name: source.source_name,
        expected_amount: Number(source.expected_amount || 0),
        next_predicted_date: nextDate.toISOString().split('T')[0]
      });
    }

    // Return the soonest income
    const result = upcomingIncomes.sort((a, b) => new Date(a.next_predicted_date).getTime() - new Date(b.next_predicted_date).getTime())[0] || null;
    return result;
  }

  // Simple transaction-based income prediction for multiple sources
  const now = new Date();
  
  // Group transactions by likely income source
  const incomeGroups = new Map<string, any[]>();
  
  for (const transaction of incomeCandidates) {
    // Create a simple key from merchant and transaction name
    const key = `${transaction.merchant_name || ''} ${transaction.name || ''}`.trim();
    if (!key || key.length < 3) continue; // Skip if no meaningful identifier
    
    if (!incomeGroups.has(key)) {
      incomeGroups.set(key, []);
    }
    incomeGroups.get(key)!.push(transaction);
  }

  const incomePredictions: Array<{ source_name: string; expected_amount: number; next_predicted_date: string; confidence: number }> = [];

  for (const [sourceKey, transactions] of incomeGroups.entries()) {
    if (transactions.length === 0) continue;

    // Sort by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const mostRecent = sortedTransactions[0];
    const mostRecentDate = new Date(mostRecent.date);
    const mostRecentAmount = Math.abs(mostRecent.amount);

    // Calculate interval from last 2-3 transactions
    let interval = 14; // Default to bi-weekly
    if (sortedTransactions.length >= 2) {
      const intervals = [];
      for (let i = 0; i < Math.min(sortedTransactions.length - 1, 3); i++) {
        const current = new Date(sortedTransactions[i].date);
        const next = new Date(sortedTransactions[i + 1].date);
        const daysDiff = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) intervals.push(daysDiff);
      }
      
      if (intervals.length > 0) {
        // Use median interval for more stability
        intervals.sort((a, b) => a - b);
        interval = intervals[Math.floor(intervals.length / 2)];
      }
    }

    // Predict next date
    let nextDate = new Date(mostRecentDate);
    while (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + interval);
    }

    // Calculate expected amount (use most recent, but consider average if stable)
    let expectedAmount = mostRecentAmount;
    if (sortedTransactions.length >= 3) {
      const amounts = sortedTransactions.slice(0, 3).map(t => Math.abs(t.amount));
      const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
      
      // If amounts are stable (low variance), use average; otherwise use most recent
      if (variance < Math.pow(avgAmount * 0.1, 2)) { // Less than 10% variance
        expectedAmount = Math.round(avgAmount);
      }
    }

    incomePredictions.push({
      source_name: sourceKey,
      expected_amount: Number(expectedAmount || 0),
      next_predicted_date: nextDate.toISOString().split('T')[0],
      confidence: Math.min(transactions.length / 3, 1)
    });
  }

  // Sort by next date (soonest first)
  incomePredictions.sort((a, b) => new Date(a.next_predicted_date).getTime() - new Date(b.next_predicted_date).getTime());

  // Return the soonest income prediction
  return incomePredictions[0] || null;
}

// Helper function to normalize income source names
export function normalizeIncomeSourceName(name: string): string {
  return name
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\b(payroll|deposit|direct|payment|transfer|ach|tran)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Helper function to generate AI-inspired vibe message
export function generateAIVibeMessage(balance: number, transactions: any[] | null, bills: any[] | null): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Analyze spending patterns
  const hasSpending = transactions && transactions.length > 0;
  const totalSpending = hasSpending ? transactions.reduce((sum, t) => sum + t.amount, 0) : 0;
  const hasUpcomingBills = bills && bills.length > 0;
  const totalBills = hasUpcomingBills ? bills.reduce((sum, b) => sum + Number(b.expected_amount), 0) : 0;
  
  // Generate vibe based on financial situation
  if (balance > 5000 && !hasSpending) {
    return "You're crushing it! 💪 Strong balance, no spending today. Keep this momentum going!";
  } else if (balance > 2000 && totalSpending < 100) {
    return "Solid day! 🎯 Good balance, controlled spending. You're in the financial sweet spot.";
  } else if (balance > 1000 && totalBills < balance * 0.3) {
    return "You're on track! 📈 Bills are manageable, balance is healthy. Consider saving the rest.";
  } else if (balance < 500) {
    return "Stay focused! 🔍 Balance is low. Review your spending and prioritize essentials.";
  } else if (isWeekend && hasSpending) {
    return "Weekend vibes! 🌅 Enjoy your weekend spending, but keep it reasonable. Balance looks good.";
  } else if (hasUpcomingBills && totalBills > balance * 0.5) {
    return "Plan ahead! ⚠️ Big bills coming. Consider reducing discretionary spending this week.";
  } else {
    return "You're doing great! 🌟 Keep monitoring your spending and stay within your daily budget.";
  }
}

// Helper function to generate enhanced AI-inspired vibe message
export function generateEnhancedAIVibeMessage(balance: number, transactions: any[] | null, bills: any[] | null, firstName: string): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;
  
  // Analyze spending patterns
  const hasSpending = transactions && transactions.length > 0;
  const totalSpending = hasSpending ? transactions.reduce((sum, t) => sum + t.amount, 0) : 0;
  const hasUpcomingBills = bills && bills.length > 0;
  const totalBills = hasUpcomingBills ? bills.reduce((sum, b) => sum + Number(b.expected_amount), 0) : 0;
  
  // Generate personalized vibe based on financial situation
  if (balance > 5000 && !hasSpending) {
    return `Hey ${firstName}! 💪 You're absolutely crushing it today! Strong balance, zero spending - this is peak financial discipline! Keep this momentum rolling! 🚀`;
  } else if (balance > 2000 && totalSpending < 100) {
    return `Solid work, ${firstName}! 🎯 Great balance, controlled spending - you're in the financial sweet spot. This is how you build wealth! 💰`;
  } else if (balance > 1000 && totalBills < balance * 0.3) {
    return `You're on track, ${firstName}! 📈 Bills are manageable, balance is healthy. Consider putting the rest into savings or investments! 🎯`;
  } else if (balance < 500) {
    return `Stay focused, ${firstName}! 🔍 Balance is getting low. Time to review spending and prioritize essentials. You've got this! 💪`;
  } else if (isWeekend && hasSpending) {
    return `Weekend vibes, ${firstName}! 🌅 Enjoy your weekend, but keep spending reasonable. Your balance looks good for now! 😎`;
  } else if (isFriday) {
    return `TGIF, ${firstName}! 🎉 Weekend ahead - make smart choices with your money. Your future self will thank you! 🌟`;
  } else if (hasUpcomingBills && totalBills > balance * 0.5) {
    return `Plan ahead, ${firstName}! ⚠️ Big bills coming soon. Consider reducing discretionary spending this week to stay ahead! 📋`;
  } else if (hasSpending && totalSpending > 200) {
    return `Big spending day, ${firstName}! 💸 That's okay, but keep an eye on your balance. Tomorrow's a new day to make smart choices! 🌅`;
  } else {
    return `You're doing great, ${firstName}! 🌟 Keep monitoring your spending and stay within your daily budget. Small choices add up to big results! 🎯`;
  }
}

// Helper function to generate actionable items based on user's financial data
export function generateActionItems(categoryPacingData: any[], merchantPacingData: any[], upcomingBills: any[], balance: number): string[] {
  const actionItems: string[] = [];
  
      // Add category-specific actions
    if (categoryPacingData.length > 0) {
      const worstCategory = categoryPacingData[0];
      if (worstCategory.pacing > 120) {
        actionItems.push(`Cut back on ${worstCategory.category} spending - you're ${worstCategory.pacing.toFixed(0)}% over budget!`);
      } else if (worstCategory.pacing > 110) {
        actionItems.push(`Watch your ${worstCategory.category} spending - you're ${worstCategory.pacing.toFixed(0)}% over budget`);
      }
    }
  
      // Add merchant-specific actions
    if (merchantPacingData.length > 0) {
      const worstMerchant = merchantPacingData[0];
      if (worstMerchant.pacing > 120) {
        actionItems.push(`Limit visits to ${worstMerchant.merchant} - spending is ${worstMerchant.pacing.toFixed(0)}% over typical`);
      }
    }
  
      // Add bill-related actions
    if (upcomingBills && upcomingBills.length > 0) {
      const totalBills = upcomingBills.reduce((sum, b) => sum + Number(b.expected_amount), 0);
      if (totalBills > balance * 0.7) {
        actionItems.push(`High bills coming - reduce discretionary spending to maintain healthy balance`);
      } else if (totalBills > balance * 0.5) {
        actionItems.push(`Bills are manageable but plan ahead - consider setting aside some money`);
      }
    }
  
      // Add balance-related actions
    if (balance < 1000) {
      actionItems.push(`Build your emergency fund - aim for at least $1,000 in savings`);
    } else if (balance > 3000) {
      actionItems.push(`Great balance! Consider investing extra funds for long-term growth`);
    }
  
      // Add general financial wellness actions
    if (actionItems.length < 3) {
      actionItems.push(`Review your spending patterns this week - knowledge is power!`);
      if (actionItems.length < 3) {
        actionItems.push(`Set up automatic savings transfers for consistent wealth building`);
      }
    }
  
  // Limit to 3 most important actions
  return actionItems.slice(0, 3);
}

// ===================================
// BOGO DINNER PLAN TEMPLATE
// ===================================
