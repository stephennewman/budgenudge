-- =====================================================
-- Krezzo Plaid Database Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Items table: Stores Plaid Item connections
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT UNIQUE NOT NULL,
  plaid_access_token TEXT NOT NULL,
  plaid_institution_id TEXT,
  status TEXT DEFAULT 'good',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table: Stores bank account information
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  plaid_account_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  mask TEXT,
  verification_status TEXT,
  current_balance DECIMAL(12,2),
  available_balance DECIMAL(12,2),
  iso_currency_code TEXT DEFAULT 'USD',
  balance_last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table: Stores transaction data
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  plaid_item_id TEXT REFERENCES items(plaid_item_id),
  account_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category TEXT[],
  subcategory TEXT,
  transaction_type TEXT,
  pending BOOLEAN DEFAULT FALSE,
  account_owner TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link events table: Logs Plaid Link sessions
CREATE TABLE IF NOT EXISTS link_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'success' or 'exit'
  link_session_id TEXT,
  request_id TEXT,
  error_type TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid API events table: Logs all API requests
CREATE TABLE IF NOT EXISTS plaid_api_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  item_id INTEGER REFERENCES items(id),
  request_id TEXT,
  error_type TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_item_id ON transactions(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_api_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Users can access their own items
CREATE POLICY "Users can access their own items" ON items
  FOR ALL USING (auth.uid() = user_id);

-- Users can access accounts for their items
CREATE POLICY "Users can access accounts for their items" ON accounts
  FOR ALL USING (
    item_id IN (SELECT id FROM items WHERE user_id = auth.uid())
  );

-- Users can access transactions for their items
CREATE POLICY "Users can access transactions for their items" ON transactions
  FOR ALL USING (
    plaid_item_id IN (SELECT plaid_item_id FROM items WHERE user_id = auth.uid())
  );

-- Users can access their own link events
CREATE POLICY "Users can access their own link events" ON link_events
  FOR ALL USING (auth.uid() = user_id);

-- Users can access their own API events
CREATE POLICY "Users can access their own API events" ON plaid_api_events
  FOR ALL USING (auth.uid() = user_id); 