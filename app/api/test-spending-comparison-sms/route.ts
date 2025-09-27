import { NextResponse } from 'next/server';

// SMS template for spending comparison
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
  }

  // Mock spending comparison data
  const mockData = {
    summary: {
      currentPeriod: {
        start: "2024-12-01",
        end: "2024-12-31"
      },
      baselinePeriod: {
        start: "2024-10-01",
        end: "2024-11-30",
        months: 2
      },
      totals: {
        currentAmount: 2847.32,
        baselineAverage: 2156.78,
        change: 690.54,
        changePercent: 32.0
      }
    },
    merchants: [
      { merchant: "Publix", currentAmount: 423.45, baselineAverage: 387.21, change: 36.24, changePercent: 9.4, transactions: 18 },
      { merchant: "Circle K", currentAmount: 298.76, baselineAverage: 234.89, change: 63.87, changePercent: 27.2, transactions: 24 },
      { merchant: "Starbucks", currentAmount: 187.43, baselineAverage: 156.78, change: 30.65, changePercent: 19.5, transactions: 16 },
      { merchant: "Amazon", currentAmount: 234.67, baselineAverage: 198.45, change: 36.22, changePercent: 18.3, transactions: 8 },
      { merchant: "Walmart", currentAmount: 145.89, baselineAverage: 178.92, change: -33.03, changePercent: -18.5, transactions: 6 }
    ],
    categories: [
      { category: "Groceries", currentAmount: 756.32, baselineAverage: 687.45, change: 68.87, changePercent: 10.0, transactions: 42 },
      { category: "Gas", currentAmount: 487.23, baselineAverage: 412.78, change: 74.45, changePercent: 18.0, transactions: 33 },
      { category: "Restaurant", currentAmount: 543.67, baselineAverage: 456.89, change: 86.78, changePercent: 19.0, transactions: 38 },
      { category: "Shopping", currentAmount: 398.45, baselineAverage: 334.56, change: 63.89, changePercent: 19.1, transactions: 22 }
    ]
  };

  // Generate SMS content
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(0)}%`;
  };

  // SMS Template 1: Summary Overview
  const smsSummary = `💰 Dec Spending vs Baseline
Total: ${formatCurrency(mockData.summary.totals.currentAmount)} (${formatPercent(mockData.summary.totals.changePercent)} vs avg)

Top Merchants:
${mockData.merchants.slice(0, 3).map(m => `• ${m.merchant}: ${formatCurrency(m.currentAmount)} (${formatPercent(m.changePercent)})`).join('\n')}

Top Categories:
${mockData.categories.slice(0, 2).map(c => `• ${c.category}: ${formatCurrency(c.currentAmount)} (${formatPercent(c.changePercent)})`).join('\n')}`;

  // SMS Template 2: Detailed Merchant Breakdown
  const smsMerchants = `🏪 Dec Merchant Spending:
${mockData.merchants.map(m =>
  `${m.merchant}: ${formatCurrency(m.currentAmount)} ${formatPercent(m.changePercent)} (${m.transactions}tx)`
).join('\n')}`;

  // SMS Template 3: Category Focus
  const smsCategories = `🗂️ Dec Category Spending:
${mockData.categories.map(c =>
  `${c.category}: ${formatCurrency(c.currentAmount)} ${formatPercent(c.changePercent)}`
).join('\n')}

Total: ${formatCurrency(mockData.summary.totals.currentAmount)} (${formatPercent(mockData.summary.totals.changePercent)})`;

  // SMS Template 4: Weekly Digest Style
  const smsWeekly = `📊 Weekly Spending Digest

🔥 Biggest Increases:
${mockData.merchants.filter(m => m.changePercent > 15).slice(0, 3).map(m =>
  `${m.merchant}: ${formatPercent(m.changePercent)}`
).join('\n')}

✅ Spending Reductions:
${mockData.merchants.filter(m => m.changePercent < 0).slice(0, 2).map(m =>
  `${m.merchant}: ${formatPercent(m.changePercent)}`
).join('\n')}

💡 Focus Areas:
${mockData.categories.slice(0, 2).map(c =>
  `${c.category}: ${formatCurrency(c.currentAmount)}/mo`
).join('\n')}`;

  return NextResponse.json({
    templates: {
      summary: smsSummary,
      merchants: smsMerchants,
      categories: smsCategories,
      weekly: smsWeekly
    },
    data: mockData
  });
}
