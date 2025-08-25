// Test ADF Classification Logic
const sampleTransactions = [
  // Fixed Expenses (Should be excluded from ADF)
  { name: "DUKE ENERGY FLA LLC", merchant_name: "Duke Energy", amount: 156.78, ai_category_tag: "Utilities" },
  { name: "VERIZON WIRELESS", merchant_name: "Verizon", amount: 85.23, ai_category_tag: "Utilities" },
  { name: "RENT PAYMENT", merchant_name: "Rent Payment", amount: 1500.00, ai_category_tag: "Transfer" },
  { name: "CAR PAYMENT", merchant_name: "Toyota Financial", amount: 425.00, ai_category_tag: "Transfer" },
  
  // Discretionary Spending (Should be included in ADF)
  { name: "PUBLIX SUPER MARKETS #1234", merchant_name: "Publix", amount: 67.45, ai_category_tag: "Groceries" },
  { name: "STARBUCKS STORE #5678", merchant_name: "Starbucks", amount: 8.95, ai_category_tag: "Restaurant" },
  { name: "CIRCLE K #9876", merchant_name: "Circle K", amount: 35.20, ai_category_tag: "Gas" },
  { name: "AMAZON.COM", merchant_name: "Amazon", amount: 89.99, ai_category_tag: "Shopping" },
  { name: "TARGET T-1234", merchant_name: "Target", amount: 45.67, ai_category_tag: "Shopping" },
  
  // Edge Cases
  { name: "NETFLIX.COM", merchant_name: "Netflix", amount: 15.99, ai_category_tag: "Subscription" },
  { name: "SPOTIFY PREMIUM", merchant_name: "Spotify", amount: 9.99, ai_category_tag: "Subscription" },
];

function testClassifyForADF(transaction) {
  const merchantLower = (transaction.merchant_name || '').toLowerCase();
  const categoryLower = (transaction.ai_category_tag || '').toLowerCase();
  const searchText = \`\${merchantLower} \${categoryLower}\`;
  
  const fixedKeywords = ['rent', 'duke energy', 'verizon', 'utilities', 'car payment', 'toyota'];
  const discretionaryKeywords = ['publix', 'starbucks', 'circle k', 'amazon', 'target', 'groceries', 'restaurant', 'gas', 'shopping'];
  
  const isFixedExpense = fixedKeywords.some(keyword => searchText.includes(keyword));
  
  if (isFixedExpense) {
    return { expense_type: 'fixed_expense', adf_eligible: false, confidence: 85 };
  }
  
  const isDiscretionary = discretionaryKeywords.some(keyword => searchText.includes(keyword));
  
  if (isDiscretionary) {
    return { expense_type: 'discretionary', adf_eligible: true, confidence: 80 };
  }
  
  if (categoryLower.includes('subscription') && transaction.amount < 20) {
    return { expense_type: 'discretionary', adf_eligible: true, confidence: 70 };
  }
  
  return { expense_type: 'discretionary', adf_eligible: true, confidence: 50 };
}

console.log('🧪 ADF Classification Test Results');
console.log('=====================================');

let totalSpending = 0;
let adfEligibleSpending = 0;
let fixedExpenseCount = 0;
let discretionaryCount = 0;

sampleTransactions.forEach((transaction) => {
  const result = testClassifyForADF(transaction);
  
  totalSpending += transaction.amount;
  if (result.adf_eligible) {
    adfEligibleSpending += transaction.amount;
    discretionaryCount++;
  } else {
    fixedExpenseCount++;
  }
  
  const emoji = result.expense_type === 'fixed_expense' ? '🔒' : '💰';
  const eligibility = result.adf_eligible ? 'ADF' : 'FIXED';
  
  console.log(\`\${emoji} \${eligibility} | $\${transaction.amount.toFixed(2).padStart(7)} | \${transaction.merchant_name.padEnd(20)} | \${result.confidence}%\`);
});

console.log('\\n📊 SUMMARY ANALYSIS');
console.log('===================');
console.log(\`Total Transactions: \${sampleTransactions.length}\`);
console.log(\`Fixed Expenses: \${fixedExpenseCount} (\${((fixedExpenseCount/sampleTransactions.length)*100).toFixed(1)}%)\`);
console.log(\`Discretionary: \${discretionaryCount} (\${((discretionaryCount/sampleTransactions.length)*100).toFixed(1)}%)\`);
console.log(\`\\nSpending Breakdown:\`);
console.log(\`Total Spending: $\${totalSpending.toFixed(2)}\`);
console.log(\`Fixed Expenses: $\${(totalSpending - adfEligibleSpending).toFixed(2)} (\${(((totalSpending - adfEligibleSpending)/totalSpending)*100).toFixed(1)}%)\`);
console.log(\`ADF Eligible: $\${adfEligibleSpending.toFixed(2)} (\${((adfEligibleSpending/totalSpending)*100).toFixed(1)}%)\`);

const adfDaily = adfEligibleSpending / 30;
console.log(\`\\n💡 ADF INSIGHTS:\`);
console.log(\`Daily ADF Average: $\${adfDaily.toFixed(2)}/day\`);
console.log(\`This represents controllable spending!\`);
