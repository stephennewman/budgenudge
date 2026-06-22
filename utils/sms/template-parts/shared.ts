import { createClient } from '@supabase/supabase-js';

// Shared server-side Supabase client and template data shapes.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Transaction {
  id: string;
  date: string;
  merchant_name?: string;
  name: string;
  amount: number;
  category?: string[];
}

export interface MerchantPacing {
  merchant: string;
  currentMonthSpend: number;
  avgMonthlySpend: number;
  pacingPercentage: number;
  daysIntoMonth: number;
  expectedSpendToDate: number;
}
