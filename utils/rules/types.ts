// =====================================================
// Transaction Rules Engine Types
// =====================================================

export type RuleType = 'merchant_normalize' | 'category_override' | 'combined';
export type PatternType = 'exact' | 'contains' | 'starts_with' | 'ends_with' | 'regex';

export interface TransactionRule {
  id: string;
  user_id: string;
  rule_name: string;
  rule_type: RuleType;
  pattern_type: PatternType;
  pattern_value: string;
  normalized_merchant_name?: string;
  override_category?: string;
  priority: number;
  is_active: boolean;
  auto_generated: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleRequest {
  rule_name: string;
  rule_type: RuleType;
  pattern_type: PatternType;
  pattern_value: string;
  normalized_merchant_name?: string;
  override_category?: string;
  priority?: number;
  description?: string;
}

export interface UpdateRuleRequest extends Partial<CreateRuleRequest> {
  is_active?: boolean;
}

export interface ProcessedTransaction {
  original_merchant_name: string;
  original_category: string;
  effective_merchant_name: string;
  effective_category: string;
  applied_rule_ids: string[];
  applied_rule_names: string[];
  rule_applied: boolean;
}

export interface RuleExecutionLog {
  id: string;
  rule_id?: string;
  user_id: string;
  transaction_id?: string;
  original_merchant: string;
  original_category?: string;
  applied_merchant: string;
  applied_category?: string;
  rule_name: string;
  executed_at: string;
}

export interface RuleSuggestion {
  type: 'normalize' | 'categorize' | 'combined';
  pattern_type: PatternType;
  pattern_value: string;
  action: string;
  category?: string;
  description: string;
  confidence: number;
}

export interface RuleTestResult {
  matches: boolean;
  result_merchant?: string;
  result_category?: string;
  error?: string;
}

// Common categories for dropdowns
export const COMMON_CATEGORIES = [
  'Food and Drink',
  'Restaurants', 
  'Groceries',
  'Shopping',
  'Transportation',
  'Gas',
  'Entertainment',
  'Travel',
  'Healthcare',
  'Utilities',
  'Rent',
  'Mortgage',
  'Insurance',
  'Education',
  'Personal Care',
  'Fitness',
  'Pets',
  'Gifts',
  'Charity',
  'Other'
] as const;

export type CategoryName = typeof COMMON_CATEGORIES[number];

// Pattern type descriptions for UI
export const PATTERN_TYPE_DESCRIPTIONS: Record<PatternType, string> = {
  exact: 'Matches exactly (case-insensitive)',
  contains: 'Contains the text anywhere',
  starts_with: 'Starts with the text',
  ends_with: 'Ends with the text',
  regex: 'Matches regular expression pattern'
};

// Rule type descriptions for UI
export const RULE_TYPE_DESCRIPTIONS: Record<RuleType, string> = {
  merchant_normalize: 'Only normalize merchant names',
  category_override: 'Only override categories',
  combined: 'Normalize merchant and override category'
}; 