'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BouncingMoneyLoader } from '@/components/ui/bouncing-money-loader';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
  monthlySpend: number;
  transactionCount: number;
  logoUrl?: string;
  category?: string;
  color: string;
  quadrant: string;
}

// Generate color from merchant name (A-Z logic)
const generateMerchantColor = (merchantName: string): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
    '#C44569', '#F8B500', '#3742FA', '#2F3542', '#FF3838',
    '#70A1FF', '#5352ED', '#747D8C', '#A4B0BE', '#57606F',
    '#FF6348', '#FF9500', '#FFDD59', '#C7ECEE', '#778BEB'
  ];
  const firstChar = merchantName.charAt(0).toUpperCase();
  const index = firstChar.charCodeAt(0) - 65; // A=0, B=1, etc.
  return colors[index % colors.length] || '#6B7280';
};

// Determine quadrant based on spend and transaction count
const getQuadrant = (spend: number, transactions: number): string => {
  const spendThreshold = 1250; // $1,250 intersection
  const transactionThreshold = 25; // 25 transactions intersection
  
  if (spend >= spendThreshold && transactions >= transactionThreshold) {
    return 'High Spend, High Activity';
  } else if (spend >= spendThreshold && transactions < transactionThreshold) {
    return 'Foundational (High Spend, Low Activity)';
  } else if (spend < spendThreshold && transactions >= transactionThreshold) {
    return 'Frequent (Low Spend, High Activity)';
  } else {
    return 'One-time (Low Spend, Low Activity)';
  }
};

// Custom tooltip component
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: MerchantGridData }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt={data.merchant} className="w-6 h-6 rounded" />
          ) : (
            <div 
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: data.color }}
            >
              {data.merchant.charAt(0)}
            </div>
          )}
          <p className="font-semibold text-gray-900">{data.merchant}</p>
        </div>
        <p className="text-sm text-gray-600">Monthly Spend: <span className="font-semibold">${data.monthlySpend.toFixed(2)}</span></p>
        <p className="text-sm text-gray-600">Transactions: <span className="font-semibold">{data.transactionCount}</span></p>
        <p className="text-xs text-gray-500 mt-1">{data.quadrant}</p>
        {data.category && <p className="text-xs text-gray-400">Category: {data.category}</p>}
      </div>
    );
  }
  return null;
};

export default function MerchantSpendGrid() {
  const [data, setData] = useState<MerchantGridData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const fetchTransactionData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createSupabaseClient();

      // Get current date for default month
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM format

      // First, get available months
      const { data: monthsData } = await supabase
        .from('transactions')
        .select('date')
        .order('date', { ascending: false });

      if (monthsData) {
        const months = [...new Set(monthsData.map(t => t.date.slice(0, 7)))].sort().reverse();
        setAvailableMonths(months);
        
        if (!selectedMonth && months.length > 0) {
          setSelectedMonth(months[0]); // Use most recent month
        }
      }

      const targetMonth = selectedMonth || currentMonth;
      const startDate = `${targetMonth}-01`;
      const endDate = `${targetMonth}-31`;

      // Fetch transactions for the selected month
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      if (!transactions || transactions.length === 0) {
        setData([]);
        return;
      }

      // Group by merchant and calculate monthly spend
      const merchantData: { [key: string]: MerchantGridData } = {};

      transactions.forEach((transaction: Transaction) => {
        const merchantName = transaction.ai_merchant_name || transaction.merchant_name || transaction.name || 'Unknown';
        const amount = Math.abs(Number(transaction.amount));

        if (!merchantData[merchantName]) {
          merchantData[merchantName] = {
            merchant: merchantName,
            monthlySpend: 0,
            transactionCount: 0,
            logoUrl: transaction.logo_url,
            category: transaction.ai_category_tag,
            color: generateMerchantColor(merchantName),
            quadrant: ''
          };
        }

        merchantData[merchantName].monthlySpend += amount;
        merchantData[merchantName].transactionCount += 1;
      });

      // Convert to array and add quadrant info
      const processedData = Object.values(merchantData).map(merchant => ({
        ...merchant,
        quadrant: getQuadrant(merchant.monthlySpend, merchant.transactionCount)
      }));

      // Filter out merchants with very small amounts (less than $5) to reduce noise
      const filteredData = processedData.filter(merchant => merchant.monthlySpend >= 5);

      setData(filteredData);
    } catch (error) {
      console.error('Error processing data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchTransactionData();
  }, [fetchTransactionData]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="w-full">
          <CardContent className="flex items-center justify-center h-96">
            <BouncingMoneyLoader />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Merchant Spend Grid</h1>
          <p className="text-gray-600 mt-1">2x2 quadrant analysis of monthly merchant spending patterns</p>
        </div>
        
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="month-select" className="text-sm font-medium text-gray-700">
              Month:
            </label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">
            Monthly Merchant Spend vs Transaction Frequency
          </CardTitle>
          <div className="text-sm text-gray-600 text-center space-y-1">
            <p><strong>Intersection:</strong> $1,250 spend × 25 transactions</p>
            <p><strong>Quadrants:</strong> Foundational (bottom-right) • Frequent (top-left) • High-Value (top-right) • One-time (bottom-left)</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                
                {/* Fixed domain ranges as specified */}
                <XAxis 
                  type="number" 
                  dataKey="monthlySpend" 
                  domain={[0, 2500]}
                  tickCount={6}
                  tickFormatter={(value) => `$${value}`}
                  label={{ value: 'Monthly Spend ($)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="transactionCount" 
                  domain={[0, 50]}
                  tickCount={6}
                  label={{ value: 'Number of Transactions', angle: -90, position: 'insideLeft' }}
                />
                
                {/* Reference lines for the cross intersection */}
                <ReferenceLine x={1250} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                <ReferenceLine y={25} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                
                <Tooltip content={<CustomTooltip />} />
                
                <Scatter
                  data={data}
                  fill="#8884d8"
                >
                  {data.map((entry, index) => (
                    <circle 
                      key={`cell-${index}`} 
                      r={8}
                      fill={entry.color}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          {/* Quadrant Labels */}
          <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="font-semibold text-blue-800">Frequent</div>
              <div className="text-blue-600">Low Spend, High Activity</div>
              <div className="text-xs text-blue-500 mt-1">&lt; $1,250, &gt; 25 transactions</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="font-semibold text-purple-800">High-Value</div>
              <div className="text-purple-600">High Spend, High Activity</div>
              <div className="text-xs text-purple-500 mt-1">&gt; $1,250, &gt; 25 transactions</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-800">One-time</div>
              <div className="text-gray-600">Low Spend, Low Activity</div>
              <div className="text-xs text-gray-500 mt-1">&lt; $1,250, &lt; 25 transactions</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="font-semibold text-green-800">Foundational</div>
              <div className="text-green-600">High Spend, Low Activity</div>
              <div className="text-xs text-green-500 mt-1">&gt; $1,250, &lt; 25 transactions</div>
            </div>
          </div>

          {data.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No transaction data available for the selected month.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{data.length}</div>
              <div className="text-sm text-gray-600">Unique Merchants</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                ${data.reduce((sum, merchant) => sum + merchant.monthlySpend, 0).toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Total Monthly Spend</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {data.reduce((sum, merchant) => sum + merchant.transactionCount, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Transactions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                ${Math.round(data.reduce((sum, merchant) => sum + merchant.monthlySpend, 0) / data.length)}
              </div>
              <div className="text-sm text-gray-600">Avg per Merchant</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 