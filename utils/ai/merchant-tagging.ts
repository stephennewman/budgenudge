import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MerchantTaggingInput {
  merchant_name?: string;
  name: string;
  amount: number;
  category?: string[];
  subcategory?: string;
}

export interface MerchantTaggingResult {
  merchant_name: string;
  category_tag: string;
}

export async function tagMerchantWithAI(input: MerchantTaggingInput): Promise<MerchantTaggingResult> {
  const rawMerchant = input.merchant_name || input.name;
  
  const prompt = `Normalize this transaction data into clean merchant name and logical category:

Raw Merchant: "${rawMerchant}"
Description: "${input.name}"
Amount: $${Math.abs(input.amount)}
Plaid Category: ${input.category ? JSON.stringify(input.category) : 'null'}
Plaid Subcategory: "${input.subcategory || 'null'}"

Guidelines:
- Merchant name: Clean, branded name (remove locations, transaction codes, numbers)
- Category: Single logical word for budgeting (Restaurant, Groceries, Gas, Utilities, Subscription, Shopping, Transfer, Income, Healthcare, Entertainment, Other)
- Use Title Case for both
- Be consistent - same merchant should always get same name/category

Examples:
"APPLE.COM/BILL" → {"merchant_name": "Apple", "category_tag": "Subscription"}
"PUBLIX SUPER MARKET #1234" → {"merchant_name": "Publix", "category_tag": "Groceries"}
"TRINITY COMMONS COF Trinity" → {"merchant_name": "Trinity Commons Coffee", "category_tag": "Restaurant"}

Return only valid JSON:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a transaction data normalizer. Always respond with valid JSON containing merchant_name and category_tag fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.3, // Lower temperature for more consistent results
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    const result: MerchantTaggingResult = JSON.parse(content);
    
    // Validate response structure
    if (!result.merchant_name || !result.category_tag) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Clean up the results (ensure Title Case)
    result.merchant_name = toTitleCase(result.merchant_name.trim());
    result.category_tag = toTitleCase(result.category_tag.trim());

    console.log(`✅ AI Tagged: "${rawMerchant}" → "${result.merchant_name}" (${result.category_tag})`);
    
    return result;

  } catch (error) {
    console.error('❌ OpenAI tagging failed:', error);
    
    // Fallback: Return reasonable defaults
    const fallbackMerchant = cleanMerchantName(rawMerchant);
    const fallbackCategory = getFallbackCategory(input);
    
    console.log(`🔄 Fallback: "${rawMerchant}" → "${fallbackMerchant}" (${fallbackCategory})`);
    
    return {
      merchant_name: fallbackMerchant,
      category_tag: fallbackCategory
    };
  }
}

// Batch processing for multiple transactions
export async function tagMultipleMerchantsWithAI(inputs: MerchantTaggingInput[]): Promise<MerchantTaggingResult[]> {
  const prompt = `Normalize these transaction merchants into clean names and logical categories:

${inputs.map((input, index) => {
  const rawMerchant = input.merchant_name || input.name;
  return `${index + 1}. Raw: "${rawMerchant}", Description: "${input.name}", Amount: $${Math.abs(input.amount)}`;
}).join('\n')}

Guidelines:
- Merchant name: Clean, branded name (remove locations, codes, numbers)
- Category: Single logical word (Restaurant, Groceries, Gas, Utilities, Subscription, Shopping, Transfer, Income, Healthcare, Entertainment, Other)
- Use Title Case
- Be consistent

Return JSON array with merchant_name and category_tag for each:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a transaction data normalizer. Always respond with a valid JSON array of objects containing merchant_name and category_tag fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const results: MerchantTaggingResult[] = JSON.parse(content);
    
    // Clean up and validate results
    return results.map((result, index) => ({
      merchant_name: toTitleCase(result.merchant_name?.trim() || cleanMerchantName(inputs[index].merchant_name || inputs[index].name)),
      category_tag: toTitleCase(result.category_tag?.trim() || getFallbackCategory(inputs[index]))
    }));

  } catch (error) {
    console.error('❌ OpenAI batch tagging failed:', error);
    
    // Fallback: Process individually with fallback logic
    return inputs.map(input => {
      const rawMerchant = input.merchant_name || input.name;
      return {
        merchant_name: cleanMerchantName(rawMerchant),
        category_tag: getFallbackCategory(input)
      };
    });
  }
}

// Helper functions
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function cleanMerchantName(rawName: string): string {
  if (!rawName) return 'Unknown Merchant';
  
  let cleaned = rawName.trim();
  
  // Remove common patterns
  cleaned = cleaned.replace(/\s+#\d+/g, ''); // Remove #1234
  cleaned = cleaned.replace(/\s+\d{6}/g, ''); // Remove date codes
  cleaned = cleaned.replace(/\s*~\s*Tran:\s*\w+/g, ''); // Remove transaction codes
  cleaned = cleaned.replace(/\s+FL$|,\s*FL$/gi, ''); // Remove FL location
  cleaned = cleaned.replace(/\s+/g, ' ').trim(); // Clean spaces
  
  return toTitleCase(cleaned) || 'Unknown Merchant';
}

function getFallbackCategory(input: MerchantTaggingInput): string {
  // Simple fallback logic based on amount patterns
  if (input.amount < 0) return 'Income';
  if (input.amount > 200) return 'Utilities';
  if (input.category?.includes('Food')) return 'Restaurant';
  if (input.category?.includes('Gas')) return 'Gas';
  if (input.subcategory?.toLowerCase().includes('subscription')) return 'Subscription';
  
  return 'Other';
} 