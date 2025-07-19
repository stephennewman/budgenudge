// =====================================================
// Transaction Rules Engine - Client Side
// =====================================================

import { TransactionRule, ProcessedTransaction, RuleSuggestion, PatternType, RuleTestResult } from './types';

export class RuleEngine {
  private rules: TransactionRule[] = [];
  
  constructor(rules: TransactionRule[]) {
    // Sort by priority (highest first), then by creation date
    this.rules = rules
      .filter(r => r.is_active)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }
  
  /**
   * Apply rules to a transaction
   */
  applyRules(
    originalMerchantName: string, 
    originalCategory?: string
  ): ProcessedTransaction {
    let merchantName = originalMerchantName || '';
    let category = originalCategory;
    const appliedRuleIds: string[] = [];
    const appliedRuleNames: string[] = [];
    
    for (const rule of this.rules) {
      if (this.matchesPattern(merchantName, rule)) {
        // Apply merchant normalization
        if (rule.normalized_merchant_name && 
            (rule.rule_type === 'merchant_normalize' || rule.rule_type === 'combined')) {
          merchantName = this.applyMerchantNormalization(merchantName, rule);
          appliedRuleIds.push(rule.id);
          appliedRuleNames.push(rule.rule_name);
        }
        
        // Apply category override  
        if (rule.override_category && 
            (rule.rule_type === 'category_override' || rule.rule_type === 'combined')) {
          category = rule.override_category;
          if (!appliedRuleIds.includes(rule.id)) {
            appliedRuleIds.push(rule.id);
            appliedRuleNames.push(rule.rule_name);
          }
        }
        
        // Stop at first matching rule (highest priority wins)
        break;
      }
    }
    
    return {
      original_merchant_name: originalMerchantName,
      original_category: originalCategory || '',
      effective_merchant_name: merchantName,
      effective_category: category || '',
      applied_rule_ids: appliedRuleIds,
      applied_rule_names: appliedRuleNames,
      rule_applied: appliedRuleIds.length > 0
    };
  }
  
  /**
   * Test if a pattern matches text
   */
  private matchesPattern(text: string, rule: TransactionRule): boolean {
    return testPattern(text, rule.pattern_type, rule.pattern_value);
  }
  
  /**
   * Apply merchant normalization with regex support
   */
  private applyMerchantNormalization(merchantName: string, rule: TransactionRule): string {
    if (rule.pattern_type === 'regex' && rule.normalized_merchant_name) {
      try {
        // Support regex capture groups
        const regex = new RegExp(rule.pattern_value, 'i');
        const match = merchantName.match(regex);
        if (match) {
          // Replace $1, $2, etc. with capture groups
          return rule.normalized_merchant_name.replace(/\$(\d+)/g, (_, group) => {
            const groupIndex = parseInt(group);
            return match[groupIndex] || '';
          });
        }
      } catch (error) {
        console.warn('Regex error in rule:', rule.rule_name, error);
        return rule.normalized_merchant_name;
      }
    }
    return rule.normalized_merchant_name || merchantName;
  }
}

/**
 * Test if a pattern matches text (standalone function)
 */
export function testPattern(text: string, patternType: PatternType, patternValue: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerPattern = patternValue.toLowerCase();
  
  switch (patternType) {
    case 'exact':
      return lowerText === lowerPattern;
    case 'contains':
      return lowerText.includes(lowerPattern);
    case 'starts_with':
      return lowerText.startsWith(lowerPattern);
    case 'ends_with':
      return lowerText.endsWith(lowerPattern);
    case 'regex':
      try {
        return new RegExp(patternValue, 'i').test(text);
      } catch (error) {
        console.warn('Invalid regex pattern:', patternValue, error);
        return false;
      }
    default:
      return false;
  }
}

/**
 * Test a rule against sample text
 */
export function testRule(
  merchantName: string,
  patternType: PatternType,
  patternValue: string,
  normalizedMerchantName?: string,
  overrideCategory?: string
): RuleTestResult {
  try {
    const matches = testPattern(merchantName, patternType, patternValue);
    
    if (!matches) {
      return { matches: false };
    }
    
    let resultMerchant = merchantName;
    if (normalizedMerchantName) {
      if (patternType === 'regex') {
        // Handle regex capture groups
        const match = merchantName.match(new RegExp(patternValue, 'i'));
        if (match) {
          resultMerchant = normalizedMerchantName.replace(/\$(\d+)/g, (_, group) => {
            const groupIndex = parseInt(group);
            return match[groupIndex] || '';
          });
        }
      } else {
        resultMerchant = normalizedMerchantName;
      }
    }
    
    return {
      matches: true,
      result_merchant: resultMerchant,
      result_category: overrideCategory
    };
  } catch (error) {
    return {
      matches: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate smart rule suggestions based on merchant name patterns
 */
export function generateRuleSuggestions(merchantName: string): RuleSuggestion[] {
  const suggestions: RuleSuggestion[] = [];
  
  if (!merchantName || merchantName.trim() === '') {
    return suggestions;
  }
  
  // Detect store numbers: "STARBUCKS #1234", "McDONALD'S #4567"
  const storeNumberMatch = merchantName.match(/^(.+?)\s*#\d+/i);
  if (storeNumberMatch) {
    const baseName = storeNumberMatch[1].trim();
    suggestions.push({
      type: 'normalize',
      pattern_type: 'starts_with',
      pattern_value: baseName,
      action: baseName,
      description: `Normalize all ${baseName} locations (remove store numbers)`,
      confidence: 90
    });
  }
  
  // Detect date codes: "MERCHANT 240719", "STORE 20250115"
  const dateCodeMatch = merchantName.match(/^(.+?)\s+\d{6,8}/);
  if (dateCodeMatch) {
    const baseName = dateCodeMatch[1].trim();
    suggestions.push({
      type: 'normalize',
      pattern_type: 'starts_with',
      pattern_value: baseName,
      action: baseName,
      description: `Remove date codes from ${baseName} transactions`,
      confidence: 85
    });
  }
  
  // Detect transaction IDs: "PAYMENT TXN123456"
  if (merchantName.match(/TXN\d+|PAYMENT\s+\d+|ID\d+/i)) {
    const cleanName = merchantName.replace(/\s*(TXN|ID)\d+/gi, '').trim();
    if (cleanName.length > 3) {
      suggestions.push({
        type: 'normalize',
        pattern_type: 'contains',
        pattern_value: cleanName,
        action: cleanName,
        description: `Remove transaction IDs from ${cleanName}`,
        confidence: 75
      });
    }
  }
  
  // Detect common chain stores
  const chainStores = [
    { pattern: 'STARBUCKS', name: 'Starbucks', category: 'Food and Drink' },
    { pattern: 'MCDONALDS', name: "McDonald's", category: 'Restaurants' },
    { pattern: 'AMAZON', name: 'Amazon', category: 'Shopping' },
    { pattern: 'WALMART', name: 'Walmart', category: 'Shopping' },
    { pattern: 'TARGET', name: 'Target', category: 'Shopping' },
    { pattern: 'SHELL', name: 'Shell', category: 'Gas' },
    { pattern: 'EXXON', name: 'Exxon', category: 'Gas' },
    { pattern: 'UBER', name: 'Uber', category: 'Transportation' }
  ];
  
  for (const store of chainStores) {
    if (merchantName.toUpperCase().includes(store.pattern)) {
      suggestions.push({
        type: 'combined',
        pattern_type: 'contains',
        pattern_value: store.pattern,
        action: store.name,
        category: store.category,
        description: `Normalize ${store.name} and categorize as ${store.category}`,
        confidence: 95
      });
      break; // Only suggest one chain store match
    }
  }
  
  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Apply rules to a list of transactions
 */
export function applyRulesToTransactions<T extends { merchant_name?: string; name?: string; subcategory?: string }>(
  transactions: T[],
  rules: TransactionRule[]
): (T & ProcessedTransaction)[] {
  const ruleEngine = new RuleEngine(rules);
  
  return transactions.map(transaction => {
    const merchantName = transaction.merchant_name || transaction.name || '';
    const category = transaction.subcategory;
    
    const processed = ruleEngine.applyRules(merchantName, category);
    
    return {
      ...transaction,
      ...processed
    };
  });
} 