import { NextResponse } from 'next/server';

// Mock data for demonstration - this shows what real spending comparison data would look like
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
  }

  // Mock spending comparison data based on typical patterns
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
      {
        merchant: "Publix",
        currentAmount: 423.45,
        baselineAverage: 387.21,
        change: 36.24,
        changePercent: 9.4,
        transactions: 18
      },
      {
        merchant: "Circle K",
        currentAmount: 298.76,
        baselineAverage: 234.89,
        change: 63.87,
        changePercent: 27.2,
        transactions: 24
      },
      {
        merchant: "Starbucks",
        currentAmount: 187.43,
        baselineAverage: 156.78,
        change: 30.65,
        changePercent: 19.5,
        transactions: 16
      },
      {
        merchant: "Amazon",
        currentAmount: 234.67,
        baselineAverage: 198.45,
        change: 36.22,
        changePercent: 18.3,
        transactions: 8
      },
      {
        merchant: "Walmart",
        currentAmount: 145.89,
        baselineAverage: 178.92,
        change: -33.03,
        changePercent: -18.5,
        transactions: 6
      },
      {
        merchant: "Target",
        currentAmount: 198.34,
        baselineAverage: 145.67,
        change: 52.67,
        changePercent: 36.2,
        transactions: 12
      },
      {
        merchant: "Chick-fil-A",
        currentAmount: 123.45,
        baselineAverage: 98.76,
        change: 24.69,
        changePercent: 25.0,
        transactions: 14
      },
      {
        merchant: "ExxonMobil",
        currentAmount: 167.89,
        baselineAverage: 145.23,
        change: 22.66,
        changePercent: 15.6,
        transactions: 9
      }
    ],
    categories: [
      {
        category: "Groceries",
        currentAmount: 756.32,
        baselineAverage: 687.45,
        change: 68.87,
        changePercent: 10.0,
        transactions: 42
      },
      {
        category: "Gas",
        currentAmount: 487.23,
        baselineAverage: 412.78,
        change: 74.45,
        changePercent: 18.0,
        transactions: 33
      },
      {
        category: "Restaurant",
        currentAmount: 543.67,
        baselineAverage: 456.89,
        change: 86.78,
        changePercent: 19.0,
        transactions: 38
      },
      {
        category: "Shopping",
        currentAmount: 398.45,
        baselineAverage: 334.56,
        change: 63.89,
        changePercent: 19.1,
        transactions: 22
      },
      {
        category: "Coffee",
        currentAmount: 245.78,
        baselineAverage: 198.34,
        change: 47.44,
        changePercent: 23.9,
        transactions: 28
      },
      {
        category: "Entertainment",
        currentAmount: 156.89,
        baselineAverage: 123.45,
        change: 33.44,
        changePercent: 27.1,
        transactions: 12
      }
    ],
    topSpenders: {
      merchants: [
        {
          merchant: "Publix",
          currentAmount: 423.45,
          baselineAverage: 387.21,
          change: 36.24,
          changePercent: 9.4,
          transactions: 18
        },
        {
          merchant: "Circle K",
          currentAmount: 298.76,
          baselineAverage: 234.89,
          change: 63.87,
          changePercent: 27.2,
          transactions: 24
        },
        {
          merchant: "Starbucks",
          currentAmount: 187.43,
          baselineAverage: 156.78,
          change: 30.65,
          changePercent: 19.5,
          transactions: 16
        },
        {
          merchant: "Amazon",
          currentAmount: 234.67,
          baselineAverage: 198.45,
          change: 36.22,
          changePercent: 18.3,
          transactions: 8
        },
        {
          merchant: "Target",
          currentAmount: 198.34,
          baselineAverage: 145.67,
          change: 52.67,
          changePercent: 36.2,
          transactions: 12
        }
      ],
      categories: [
        {
          category: "Groceries",
          currentAmount: 756.32,
          baselineAverage: 687.45,
          change: 68.87,
          changePercent: 10.0,
          transactions: 42
        },
        {
          category: "Gas",
          currentAmount: 487.23,
          baselineAverage: 412.78,
          change: 74.45,
          changePercent: 18.0,
          transactions: 33
        },
        {
          category: "Restaurant",
          currentAmount: 543.67,
          baselineAverage: 456.89,
          change: 86.78,
          changePercent: 19.0,
          transactions: 38
        }
      ]
    }
  };

  return NextResponse.json(mockData);
}
