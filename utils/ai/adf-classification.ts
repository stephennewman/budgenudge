import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ADFClassificationInput {
  merchant_name?: string;
  name: string;
  amount: number;
  category?: string[];
  subcategory?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
}

export interface ADFClassificationResult {
  merchant_name: string;
  category_tag: string;
  expense_type: 'fixed_expense' | 'discretionary';
  adf_eligible: boolean;
  confidence: number;
  reasoning: string;
}

// Fixed Expense Patterns (Predictable, Hard to Control)
const FIXED_EXPENSE_KEYWORDS = [
  // Housing
  'rent', 'mortgage', 'property tax', 'hoa', 'homeowners',
  // Utilities  
  'electric', 'electricity', 'water', 'sewer', 'gas', 'internet', 'cable', 'phone bill',
  'verizon', 'at&t', 'comcast', 'spectrum', 'duke energy', 'florida power',
  // Transportation
  'car payment', 'auto loan', 'car insurance', 'registration', 'lease payment',
  // Insurance
  'health insurance', 'life insurance', 'auto insurance', 'home insurance',
  // Loans & Debt
  'student loan', 'credit card payment', 'loan payment', 'mortgage payment',
  // Fixed Services
  'gym membership', 'netflix', 'spotify', 'amazon prime', 'hulu', 'adobe',
];

// Discretionary Spending Patterns (Variable, Controllable)
const DISCRETIONARY_KEYWORDS = [
  // Food & Dining
  'restaurant', 'fast food', 'coffee', 'starbucks', 'mcdonald', 'dining',
  'groceries', 'publix', 'walmart', 'target', 'whole foods', 'grocery',
  // Transportation
  'gas', 'fuel', 'gasoline', 'circle k', 'wawa', 'shell', 'chevron',
  'uber', 'lyft', 'taxi', 'parking',
  // Shopping
  'amazon', 'shopping', 'retail', 'clothing', 'shoes', 'electronics',
  'home depot', 'lowes', 'best buy', 'apple store',
  // Entertainment
  'entertainment', 'movie', 'concert', 'sports', 'hobby', 'books',
  // Personal Care
  'haircut', 'salon', 'spa', 'pharmacy', 'medical', 'doctor',
];

export async function classifyForADF(input: ADFClassificationInput): Promise<ADFClassificationResult> {
  const rawMerchant = input.merchant_name || input.name;
  const existingMerchant = input.ai_merchant_name || '';
  const existingCategory = input.ai_category_tag || '';
  
  // Use existing AI tags if available, otherwise classify from scratch
  const merchantName = existingMerchant || rawMerchant;
  const categoryTag = existingCategory || '';

  const prompt = `Classify this transaction for financial behavior tracking:

Transaction Details:
- Merchant: "${merchantName}"
- Raw Name: "${input.name}"
- Amount: $${Math.abs(input.amount)}
- Category: "${categoryTag}"
- Plaid Category: ${input.category ? JSON.stringify(input.category) : 'null'}

Classify as either:
1. "fixed_expense" = Predictable monthly costs that are hard to change (rent, utilities, car payments, insurance, fixed subscriptions)
2. "discretionary" = Variable spending that can be controlled through daily choices (groceries, gas, dining, shopping, entertainment)

Guidelines:
- Fixed expenses are locked-in decisions (rent, utilities, loan payments, insurance)
- Discretionary spending represents daily choice opportunities (where to eat, how much to buy)
- Focus on controllability, not necessity (groceries are necessary but controllable)
- Regular bills like phone/internet = fixed_expense
- Shopping, dining, variable purchases = discretionary

Examples:
- "Duke Energy" ($120) → fixed_expense (utility bill)
- "Verizon Wireless" ($85) → fixed_expense (phone bill)  
- "Publix" ($45) → discretionary (grocery choices)
- "Starbucks" ($8) → discretionary (coffee choice)
- "Rent Payment" ($1500) → fixed_expense (housing cost)
- "Amazon" ($67) → discretionary (shopping choice)

Return JSON with: expense_type, confidence (0-100), reasoning`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a financial behavior classifier. Focus on controllability vs predictability. Return valid JSON with expense_type, confidence, and reasoning fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.2, // Low temperature for consistent classification
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    const aiResult = JSON.parse(content);
    
    // Validate and structure response
    const result: ADFClassificationResult = {
      merchant_name: merchantName,
      category_tag: categoryTag,
      expense_type: aiResult.expense_type === 'fixed_expense' ? 'fixed_expense' : 'discretionary',
      adf_eligible: aiResult.expense_type !== 'fixed_expense',
      confidence: Math.min(100, Math.max(0, aiResult.confidence || 80)),
      reasoning: aiResult.reasoning || 'AI classification'
    };

    console.log(`💰 ADF Classified: "${merchantName}" → ${result.expense_type} (${result.confidence}% confidence)`);
    
    return result;

  } catch (error) {
    console.error('❌ ADF classification failed:', error);
    
    // Fallback: Rule-based classification
    const fallbackResult = classifyWithRules(merchantName, categoryTag, input.amount);
    console.log(`🔄 ADF Fallback: "${merchantName}" → ${fallbackResult.expense_type}`);
    
    return fallbackResult;
  }
}

// Rule-based fallback classification
function classifyWithRules(merchantName: string, categoryTag: string, amount: number): ADFClassificationResult {
  const merchantLower = merchantName.toLowerCase();
  const categoryLower = categoryTag.toLowerCase();
  const searchText = `${merchantLower} ${categoryLower}`;
  
  // Check for fixed expense patterns
  const isFixedExpense = FIXED_EXPENSE_KEYWORDS.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
  
  if (isFixedExpense) {
    return {
      merchant_name: merchantName,
      category_tag: categoryTag,
      expense_type: 'fixed_expense',
      adf_eligible: false,
      confidence: 75,
      reasoning: 'Rule-based: matched fixed expense pattern'
    };
  }
  
  // Check for discretionary patterns
  const isDiscretionary = DISCRETIONARY_KEYWORDS.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
  
  if (isDiscretionary) {
    return {
      merchant_name: merchantName,
      category_tag: categoryTag,
      expense_type: 'discretionary',
      adf_eligible: true,
      confidence: 75,
      reasoning: 'Rule-based: matched discretionary pattern'
    };
  }
  
  // Default classification based on amount and category
  let expenseType: 'fixed_expense' | 'discretionary' = 'discretionary';
  let confidence = 60;
  let reasoning = 'Default: discretionary (unknown pattern)';
  
  // Large recurring amounts likely fixed expenses
  if (amount > 200) {
    expenseType = 'fixed_expense';
    confidence = 65;
    reasoning = 'Heuristic: large amount suggests fixed expense';
  }
  
  // Category-based hints
  if (categoryLower.includes('utilities') || categoryLower.includes('insurance')) {
    expenseType = 'fixed_expense';
    confidence = 80;
    reasoning = 'Category-based: utilities/insurance classification';
  }
  
  return {
    merchant_name: merchantName,
    category_tag: categoryTag,
    expense_type: expenseType,
    adf_eligible: expenseType === 'discretionary',
    confidence: confidence,
    reasoning: reasoning
  };
}

// Batch classification for multiple transactions
export async function classifyMultipleForADF(inputs: ADFClassificationInput[]): Promise<ADFClassificationResult[]> {
  const results: ADFClassificationResult[] = [];
  
  // Process in batches of 5 to avoid overwhelming OpenAI
  const batchSize = 5;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    
    // Process batch sequentially to respect rate limits
    for (const input of batch) {
      try {
        const result = await classifyForADF(input);
        results.push(result);
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to classify transaction: ${input.name}`, error);
        
        // Add fallback result
        const fallback = classifyWithRules(
          input.merchant_name || input.name,
          input.ai_category_tag || '',
          input.amount
        );
        results.push(fallback);
      }
    }
  }
  
  return results;
}
