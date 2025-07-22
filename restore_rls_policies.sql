-- Restore safe default RLS policies for Krezzo Supabase tables

-- 1. items
drop policy if exists "Authenticated users can access their own items" on public.items;
create policy "Authenticated users can access their own items"
  on public.items
  for all
  using (auth.uid() = user_id);

-- 2. accounts
drop policy if exists "Authenticated users can access their own accounts" on public.accounts;
create policy "Authenticated users can access their own accounts"
  on public.accounts
  for all
  using (
    item_id in (select id from public.items where user_id = auth.uid())
  );

-- 3. transactions
drop policy if exists "Authenticated users can access their own transactions" on public.transactions;
create policy "Authenticated users can access their own transactions"
  on public.transactions
  for all
  using (
    plaid_item_id in (select plaid_item_id from public.items where user_id = auth.uid())
  );

-- 4. link_events
drop policy if exists "Authenticated users can access their own link events" on public.link_events;
create policy "Authenticated users can access their own link events"
  on public.link_events
  for all
  using (auth.uid() = user_id);

-- 5. plaid_api_events
drop policy if exists "Authenticated users can access their own plaid_api_events" on public.plaid_api_events;
create policy "Authenticated users can access their own plaid_api_events"
  on public.plaid_api_events
  for all
  using (auth.uid() = user_id);

-- 6. merchant_analytics
drop policy if exists "Authenticated users can access their own merchant analytics" on public.merchant_analytics;
create policy "Authenticated users can access their own merchant analytics"
  on public.merchant_analytics
  for all
  using (auth.uid() = user_id);

-- 7. tagged_merchants
drop policy if exists "Authenticated users can access their own tagged merchants" on public.tagged_merchants;
create policy "Authenticated users can access their own tagged merchants"
  on public.tagged_merchants
  for all
  using (auth.uid() = user_id);

-- 8. scheduled_sms
drop policy if exists "Authenticated users can access their own scheduled SMS" on public.scheduled_sms;
create policy "Authenticated users can access their own scheduled SMS"
  on public.scheduled_sms
  for all
  using (auth.uid() = user_id);

-- 9. user_sms_preferences
drop policy if exists "Authenticated users can access their own SMS preferences" on public.user_sms_preferences;
create policy "Authenticated users can access their own SMS preferences"
  on public.user_sms_preferences
  for all
  using (auth.uid() = user_id);

-- 10. user_sms_settings
drop policy if exists "Authenticated users can access their own SMS settings" on public.user_sms_settings;
create policy "Authenticated users can access their own SMS settings"
  on public.user_sms_settings
  for all
  using (auth.uid() = user_id);

-- 11. cron_log
drop policy if exists "Service role only" on public.cron_log;
create policy "Service role only"
  on public.cron_log
  for all
  using (auth.role() = 'service_role'); 