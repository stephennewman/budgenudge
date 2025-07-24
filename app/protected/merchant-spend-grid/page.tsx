'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Transaction {
  id: string | number;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  ai_merchant_name?: string;
  ai_category_tag?: string;
  logo_url?: string;
  plaid_item_id?: string;
}

interface MerchantGridData {
  merchant: string;
  avgAmount: number;
  transactionCount: number;
  totalSpent: number;
  logoUrl?: string;
  category?: string;
  color: string;
  quadrant: string;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: MerchantGridData;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MerchantGridData }>;
}

// Function to get consistent color for merchant based on first letter (from existing codebase)
const getMerchantColor = (merchantName: string) => {
  const colors = [
    '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#6366f1', '#f97316', '#14b8a6', '#06b6d4', '#f43f5e', '#8b5cf6',
    '#10b981', '#f59e0b', '#84cc16', '#0ea5e9', '#d946ef', '#64748b',
    '#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777',
    '#4338ca', '#ea580c'
  ];
  
  const firstLetter = merchantName.charAt(0).toUpperCase();
  const letterIndex = firstLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
  const colorIndex = letterIndex % colors.length;
  return colors[colorIndex];
};

// Custom dot component for scatter plot
const CustomDot = (props: CustomDotProps) => {
  const { cx, cy, payload } = props;
  const size = 40;
  
  if (!cx || !cy || !payload) return null;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={size / 2}
        fill={payload.color}
        stroke="#ffffff"
        strokeWidth={2}
        opacity={0.8}
      />
      {payload.logoUrl ? (
        <image
          x={cx - size / 2}
          y={cy - size / 2}
          width={size}
          height={size}
          xlinkHref={payload.logoUrl}
          clipPath={`circle(${size / 2}px at center)`}
        />
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="14"
          fontWeight="bold"
        >
          {payload.merchant.charAt(0).toUpperCase()}
        </text>
      )}
    </g>
  );
};

// Custom tooltip component
const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <h3 className="font-bold text-lg mb-2">{data.merchant}</h3>
        <div className="space-y-1 text-sm">
          <p><span className="font-medium">Total Spent:</span> ${data.totalSpent.toLocaleString()}</p>
          <p><span className="font-medium">Transactions:</span> {data.transactionCount}</p>
          <p><span className="font-medium">Avg Amount:</span> ${data.avgAmount.toLocaleString()}</p>
          <p><span className="font-medium">Category:</span> {data.category || 'Uncategorized'}</p>
          <p><span className="font-medium">Quadrant:</span> {data.quadrant}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function MerchantSpendGridPage() {
  const [merchantData, setMerchantData] = useState<MerchantGridData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const fetchMerchantGridData = async (monthFilter?: string) => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createSupabaseClient();
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Get user's item IDs
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('plaid_item_id')
        .eq('user_id', user.id);

      if (itemsError || !items?.length) {
        throw new Error('No connected accounts found');
      }

      const itemIds = items.map(item => item.plaid_item_id);

      // Calculate date range (last full month or selected month)
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (monthFilter) {
        const [year, month] = monthFilter.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
      } else {
        // Last full month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        setSelectedMonth(`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`);
      }

      // Fetch transactions for the period
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('id, amount, date, name, merchant_name, ai_merchant_name, ai_category_tag, logo_url')
        .in('plaid_item_id', itemIds)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .gt('amount', 0); // Only expenses

      if (txError) {
        throw new Error(`Failed to fetch transactions: ${txError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        setMerchantData([]);
        return;
      }

      // Group transactions by AI merchant name
      const merchantMap = new Map<string, {
        totalSpent: number;
        transactionCount: number;
        amounts: number[];
        logoUrl?: string;
        category?: string;
      }>();

      transactions.forEach((transaction: Transaction) => {
        const merchant = transaction.ai_merchant_name || transaction.merchant_name || transaction.name || 'Unknown';
        
        if (!merchantMap.has(merchant)) {
          merchantMap.set(merchant, {
            totalSpent: 0,
            transactionCount: 0,
            amounts: [],
            logoUrl: transaction.logo_url || undefined,
            category: transaction.ai_category_tag || undefined,
          });
        }

        const merchantInfo = merchantMap.get(merchant)!;
        merchantInfo.totalSpent += transaction.amount;
        merchantInfo.transactionCount += 1;
        merchantInfo.amounts.push(transaction.amount);
        
        // Update logo if we find one
        if (transaction.logo_url && !merchantInfo.logoUrl) {
          merchantInfo.logoUrl = transaction.logo_url;
        }
        
        // Update category if we find one
        if (transaction.ai_category_tag && !merchantInfo.category) {
          merchantInfo.category = transaction.ai_category_tag;
        }
      });

      // Convert to grid data with quadrant assignment
      const gridData: MerchantGridData[] = Array.from(merchantMap.entries()).map(([merchant, data]) => {
        const avgAmount = data.totalSpent / data.transactionCount;
        
        // Determine quadrant based on spend and frequency
        let quadrant = '';
        if (avgAmount >= 100 && data.transactionCount >= 10) {
          quadrant = 'High Spend, High Activity';
        } else if (avgAmount >= 100 && data.transactionCount < 10) {
          quadrant = 'High Spend, Low Activity (Foundational)';
        } else if (avgAmount < 100 && data.transactionCount >= 10) {
          quadrant = 'Low Spend, High Activity';
        } else {
          quadrant = 'Low Spend, Low Activity (One-time)';
        }

        return {
          merchant,
          avgAmount,
          transactionCount: data.transactionCount,
          totalSpent: data.totalSpent,
          logoUrl: data.logoUrl,
          category: data.category,
          color: getMerchantColor(merchant),
          quadrant,
        };
      });

      // Sort by total spent and take top 25 for better visualization
      gridData.sort((a, b) => b.totalSpent - a.totalSpent);
      setMerchantData(gridData.slice(0, 25));

    } catch (err) {
      console.error('Error fetching merchant grid data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantGridData();
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    fetchMerchantGridData(month);
  };

  // Generate month options (last 6 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <BouncingMoneyLoader />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Merchant Spend Grid</h1>
          <p className="text-gray-600 mt-2">
            Interactive visualization of spending patterns: frequency vs amount
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <label htmlFor="month-select" className="text-sm font-medium text-gray-700">
            Month:
          </label>
          <select
            id="month-select"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {getMonthOptions().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="text-lg font-medium">Error</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : merchantData.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium">No transaction data</p>
              <p className="text-sm mt-2">No merchant spending data available for the selected month.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quadrant Description */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Quadrant Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded">
                  <h4 className="font-medium text-blue-900">Top Left: High Activity, Low Spend</h4>
                  <p className="text-blue-700">Frequent, small purchases (coffee, gas, groceries)</p>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <h4 className="font-medium text-red-900">Top Right: High Activity, High Spend</h4>
                  <p className="text-red-700">Frequent, expensive purchases (major retailers)</p>
                </div>
                <div className="bg-green-50 p-3 rounded">
                  <h4 className="font-medium text-green-900">Bottom Left: Low Activity, Low Spend</h4>
                  <p className="text-green-700">Occasional, small purchases (subscriptions, bills)</p>
                </div>
                <div className="bg-orange-50 p-3 rounded">
                  <h4 className="font-medium text-orange-900">Bottom Right: Low Activity, High Spend</h4>
                  <p className="text-orange-700">Foundational expenses (rent, mortgage, insurance)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scatter Plot */}
          <Card>
            <CardHeader>
              <CardTitle>Merchant Spend Grid</CardTitle>
              <p className="text-sm text-gray-600">
                X-axis: Average transaction amount • Y-axis: Number of transactions • 
                Hover for details • Circle size represents relative spending
              </p>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: '600px' }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      type="number" 
                      domain={['dataMin - 10', 'dataMax + 50']}
                      dataKey="avgAmount"
                      name="Average Amount"
                      tickFormatter={(value) => `$${value}`}
                      label={{ value: 'Average Transaction Amount', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      type="number"
                      domain={['dataMin - 1', 'dataMax + 2']}
                      dataKey="transactionCount"
                      name="Transaction Count"
                      label={{ value: 'Number of Transactions', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter 
                      data={merchantData} 
                      shape={<CustomDot />}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Merchant List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Merchant Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {merchantData.map((merchant, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-3 mb-2">
                      {merchant.logoUrl ? (
                        <img 
                          src={merchant.logoUrl} 
                          alt={merchant.merchant}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: merchant.color }}
                        >
                          {merchant.merchant.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <h4 className="font-medium text-gray-900">{merchant.merchant}</h4>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Total:</span> ${merchant.totalSpent.toLocaleString()}</p>
                      <p><span className="font-medium">Count:</span> {merchant.transactionCount}</p>
                      <p><span className="font-medium">Avg:</span> ${merchant.avgAmount.toLocaleString()}</p>
                      <p><span className="font-medium">Category:</span> {merchant.category || 'Uncategorized'}</p>
                      <p className="text-xs text-blue-600">{merchant.quadrant}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 