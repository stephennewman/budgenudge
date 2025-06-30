-- Test script to verify merchant analytics are working
-- Run this in Supabase SQL Editor

-- 1. Check if merchant_analytics table exists and is empty
SELECT 'merchant_analytics table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'merchant_analytics' 
ORDER BY ordinal_position;

-- 2. Check current analytics data
SELECT 'Current merchant analytics count:' as info;
SELECT COUNT(*) as current_records FROM merchant_analytics;

-- 3. Get a sample user ID from items table
SELECT 'Sample user ID for testing:' as info;
SELECT DISTINCT user_id FROM items LIMIT 1;

-- 4. Manually refresh analytics for your user
-- Replace 'YOUR_USER_ID' with actual user ID from step 3
-- SELECT refresh_merchant_analytics('YOUR_USER_ID'::UUID);

-- 5. Check merchant analytics after refresh
SELECT 'Merchant analytics after refresh:' as info;
SELECT 
  merchant_name,
  total_transactions,
  total_spending,
  spending_transactions,
  avg_weekly_spending,
  avg_monthly_spending,
  is_recurring,
  last_calculated_at
FROM merchant_analytics 
ORDER BY total_spending DESC 
LIMIT 10; 