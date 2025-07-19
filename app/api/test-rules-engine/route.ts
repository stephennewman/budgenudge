import { NextResponse } from 'next/server';
import { testRule, generateRuleSuggestions, RuleEngine } from '@/utils/rules/engine';
import { TransactionRule } from '@/utils/rules/types';

export async function GET() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as Record<string, unknown>[]
    };

    // Test 1: Pattern Matching
    const patternTests = [
      {
        name: 'Starts With Test',
        merchant: 'STARBUCKS #1234',
        pattern_type: 'starts_with' as const,
        pattern_value: 'STARBUCKS',
        expected: true
      },
      {
        name: 'Contains Test',
        merchant: "McDonald's Restaurant #567",
        pattern_type: 'contains' as const,
        pattern_value: 'McDonald',
        expected: true
      },
      {
        name: 'Regex Test',
        merchant: 'AMAZON PRIME VIDEO',
        pattern_type: 'regex' as const,
        pattern_value: '^AMAZON.*',
        expected: true
      },
      {
        name: 'Exact Test (Negative)',
        merchant: 'Walmart Store',
        pattern_type: 'exact' as const,
        pattern_value: 'Target Store',
        expected: false
      }
    ];

    patternTests.forEach(test => {
      const result = testRule(
        test.merchant,
        test.pattern_type,
        test.pattern_value
      );
      
      results.tests.push({
        category: 'Pattern Matching',
        test: test.name,
        input: `"${test.merchant}" ${test.pattern_type} "${test.pattern_value}"`,
        expected: test.expected,
        actual: result.matches,
        passed: result.matches === test.expected,
        details: result
      });
    });

    // Test 2: Rule Suggestions
    const suggestionTests = [
      'STARBUCKS #1234',
      'AMAZON PRIME VIDEO 240719',
      "McDONALD'S #567",
      'SHELL GAS STATION TXN123',
      'WALMART SUPERCENTER'
    ];

    suggestionTests.forEach(merchant => {
      const suggestions = generateRuleSuggestions(merchant);
      results.tests.push({
        category: 'Rule Suggestions',
        test: `Suggestions for "${merchant}"`,
        input: merchant,
        suggestionsCount: suggestions.length,
        suggestions: suggestions.map(s => ({
          description: s.description,
          confidence: s.confidence,
          pattern: `${s.pattern_type}: "${s.pattern_value}"`,
          action: s.action,
          category: s.category
        }))
      });
    });

    // Test 3: Rule Engine Processing
    const mockRules: TransactionRule[] = [
      {
        id: '1',
        user_id: 'test-user',
        rule_name: 'Normalize Starbucks',
        rule_type: 'merchant_normalize',
        pattern_type: 'starts_with',
        pattern_value: 'STARBUCKS',
        normalized_merchant_name: 'Starbucks',
        override_category: undefined,
        priority: 200,
        is_active: true,
        auto_generated: false,
        description: 'Test rule for Starbucks',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        user_id: 'test-user',
        rule_name: 'Amazon → Shopping',
        rule_type: 'combined',
        pattern_type: 'contains',
        pattern_value: 'AMAZON',
        normalized_merchant_name: 'Amazon',
        override_category: 'Shopping',
        priority: 150,
        is_active: true,
        auto_generated: false,
        description: 'Test rule for Amazon',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const ruleEngine = new RuleEngine(mockRules);

    const testTransactions = [
      { merchant: 'STARBUCKS #1234', category: 'Entertainment' },
      { merchant: 'AMAZON PRIME VIDEO', category: 'Entertainment' },
      { merchant: 'Regular Merchant', category: 'Food and Drink' }
    ];

    testTransactions.forEach(transaction => {
      const result = ruleEngine.applyRules(transaction.merchant, transaction.category);
      results.tests.push({
        category: 'Rule Engine Processing',
        test: `Process "${transaction.merchant}"`,
        input: {
          original_merchant: transaction.merchant,
          original_category: transaction.category
        },
        output: {
          effective_merchant: result.effective_merchant_name,
          effective_category: result.effective_category,
          rules_applied: result.applied_rule_names,
          rule_applied: result.rule_applied
        }
      });
    });

    // Summary
    const totalTests = results.tests.filter(t => t.hasOwnProperty('passed')).length;
    const passedTests = results.tests.filter(t => t.passed === true).length;

    return NextResponse.json({
      success: true,
      summary: {
        total_tests: totalTests,
        passed_tests: passedTests,
        failed_tests: totalTests - passedTests,
        success_rate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
      },
      ...results
    });

  } catch (error) {
    console.error('Error in rules engine test:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 