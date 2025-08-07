#!/usr/bin/env node

/**
 * User Isolation Security Test Script
 * 
 * This script tests that users cannot access each other's data
 * Run with: node scripts/test-user-isolation.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Please set: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create clients
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function logTest(name, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   Details: ${details}`);
  }
}

async function createTestUsers() {
  console.log('\n🔧 Creating test users...');
  
  // Create test user 1
  const { data: user1, error: error1 } = await anonClient.auth.signUp({
    email: `test-user-1-${Date.now()}@example.com`,
    password: 'testpassword123'
  });
  
  // Create test user 2
  const { data: user2, error: error2 } = await anonClient.auth.signUp({
    email: `test-user-2-${Date.now()}@example.com`,
    password: 'testpassword123'
  });
  
  if (error1 || error2) {
    console.error('Failed to create test users:', error1 || error2);
    return null;
  }
  
  return {
    user1: user1.user,
    user2: user2.user
  };
}

async function createTestData(user1, user2) {
  console.log('\n📊 Creating test data...');
  
  // Create test items for both users
  const { data: item1, error: item1Error } = await serviceClient
    .from('items')
    .insert({
      user_id: user1.id,
      plaid_item_id: `test-item-1-${Date.now()}`,
      plaid_access_token: 'test-token-1',
      plaid_institution_id: 'test-institution-1'
    })
    .select()
    .single();
    
  const { data: item2, error: item2Error } = await serviceClient
    .from('items')
    .insert({
      user_id: user2.id,
      plaid_item_id: `test-item-2-${Date.now()}`,
      plaid_access_token: 'test-token-2',
      plaid_institution_id: 'test-institution-2'
    })
    .select()
    .single();
  
  if (item1Error || item2Error) {
    console.error('Failed to create test items:', item1Error || item2Error);
    return null;
  }
  
  // Create test accounts
  const { data: account1, error: account1Error } = await serviceClient
    .from('accounts')
    .insert({
      item_id: item1.id,
      plaid_account_id: `test-account-1-${Date.now()}`,
      name: 'Test Account 1',
      type: 'depository',
      current_balance: 1000.00
    })
    .select()
    .single();
    
  const { data: account2, error: account2Error } = await serviceClient
    .from('accounts')
    .insert({
      item_id: item2.id,
      plaid_account_id: `test-account-2-${Date.now()}`,
      name: 'Test Account 2',
      type: 'depository',
      current_balance: 2000.00
    })
    .select()
    .single();
  
  if (account1Error || account2Error) {
    console.error('Failed to create test accounts:', account1Error || account2Error);
    return null;
  }
  
  // Create test transactions
  const { data: transaction1, error: tx1Error } = await serviceClient
    .from('transactions')
    .insert({
      plaid_transaction_id: `test-tx-1-${Date.now()}`,
      plaid_item_id: item1.plaid_item_id,
      account_id: account1.plaid_account_id,
      amount: 50.00,
      date: new Date().toISOString().split('T')[0],
      name: 'Test Transaction 1',
      merchant_name: 'Test Merchant 1'
    })
    .select()
    .single();
    
  const { data: transaction2, error: tx2Error } = await serviceClient
    .from('transactions')
    .insert({
      plaid_transaction_id: `test-tx-2-${Date.now()}`,
      plaid_item_id: item2.plaid_item_id,
      account_id: account2.plaid_account_id,
      amount: 100.00,
      date: new Date().toISOString().split('T')[0],
      name: 'Test Transaction 2',
      merchant_name: 'Test Merchant 2'
    })
    .select()
    .single();
  
  if (tx1Error || tx2Error) {
    console.error('Failed to create test transactions:', tx1Error || tx2Error);
    return null;
  }
  
  return {
    item1, item2, account1, account2, transaction1, transaction2
  };
}

async function testUserIsolation(user1, user2, testData) {
  console.log('\n🔒 Testing user isolation...');
  
  // Test 1: User 1 cannot access User 2's items
  const { data: user1Session } = await anonClient.auth.signInWithPassword({
    email: user1.email,
    password: 'testpassword123'
  });
  
  const user1Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${user1Session.session.access_token}`
      }
    }
  });
  
  const { data: user1Items, error: user1ItemsError } = await user1Client
    .from('items')
    .select('*');
  
  logTest(
    'User 1 can access their own items',
    !user1ItemsError && user1Items && user1Items.length > 0,
    user1ItemsError?.message
  );
  
  // Test 2: User 1 cannot access User 2's items directly
  const { data: user2Items, error: user2ItemsError } = await user1Client
    .from('items')
    .select('*')
    .eq('user_id', user2.id);
  
  logTest(
    'User 1 cannot access User 2\'s items',
    !user2Items || user2Items.length === 0,
    `Found ${user2Items?.length || 0} items (should be 0)`
  );
  
  // Test 3: User 1 cannot access User 2's accounts
  const { data: user2Accounts, error: user2AccountsError } = await user1Client
    .from('accounts')
    .select('*')
    .eq('item_id', testData.item2.id);
  
  logTest(
    'User 1 cannot access User 2\'s accounts',
    !user2Accounts || user2Accounts.length === 0,
    `Found ${user2Accounts?.length || 0} accounts (should be 0)`
  );
  
  // Test 4: User 1 cannot access User 2's transactions
  const { data: user2Transactions, error: user2TransactionsError } = await user1Client
    .from('transactions')
    .select('*')
    .eq('plaid_item_id', testData.item2.plaid_item_id);
  
  logTest(
    'User 1 cannot access User 2\'s transactions',
    !user2Transactions || user2Transactions.length === 0,
    `Found ${user2Transactions?.length || 0} transactions (should be 0)`
  );
  
  // Test 5: User 1 can access their own transactions via secure function
  const { data: user1SecureTransactions, error: user1SecureError } = await user1Client
    .rpc('get_user_transactions', { user_uuid: user1.id });
  
  logTest(
    'User 1 can access their own transactions via secure function',
    !user1SecureError && user1SecureTransactions && user1SecureTransactions.length > 0,
    user1SecureError?.message
  );
  
  // Test 6: User 1 cannot access User 2's transactions via secure function
  const { data: user2SecureTransactions, error: user2SecureError } = await user1Client
    .rpc('get_user_transactions', { user_uuid: user2.id });
  
  logTest(
    'User 1 cannot access User 2\'s transactions via secure function',
    !user2SecureTransactions || user2SecureTransactions.length === 0,
    `Found ${user2SecureTransactions?.length || 0} transactions (should be 0)`
  );
  
  // Test 7: User 1 cannot access User 2's account balances
  const { data: user2Balances, error: user2BalancesError } = await user1Client
    .rpc('get_user_accounts', { user_uuid: user2.id });
  
  logTest(
    'User 1 cannot access User 2\'s account balances',
    !user2Balances || user2Balances.length === 0,
    `Found ${user2Balances?.length || 0} accounts (should be 0)`
  );
  
  // Test 8: Secure views work correctly
  const { data: user1SecureView, error: user1ViewError } = await user1Client
    .from('user_transactions_secure')
    .select('*');
  
  logTest(
    'User 1 can access secure transactions view',
    !user1ViewError && user1SecureView && user1SecureView.length > 0,
    user1ViewError?.message
  );
  
  // Test 9: Direct ID access is blocked
  const { data: directTransaction, error: directError } = await user1Client
    .from('transactions')
    .select('*')
    .eq('id', testData.transaction2.id)
    .single();
  
  logTest(
    'User 1 cannot access User 2\'s transaction by direct ID',
    !directTransaction,
    `Found transaction: ${directTransaction ? 'Yes' : 'No'}`
  );
}

async function cleanupTestData(testData) {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete in reverse order to respect foreign key constraints
    await serviceClient.from('transactions').delete().in('id', [testData.transaction1.id, testData.transaction2.id]);
    await serviceClient.from('accounts').delete().in('id', [testData.account1.id, testData.account2.id]);
    await serviceClient.from('items').delete().in('id', [testData.item1.id, testData.item2.id]);
    
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error);
  }
}

async function main() {
  console.log('🔒 Starting User Isolation Security Tests\n');
  
  try {
    // Create test users
    const users = await createTestUsers();
    if (!users) {
      console.error('❌ Failed to create test users');
      return;
    }
    
    // Create test data
    const testData = await createTestData(users.user1, users.user2);
    if (!testData) {
      console.error('❌ Failed to create test data');
      return;
    }
    
    // Run isolation tests
    await testUserIsolation(users.user1, users.user2, testData);
    
    // Cleanup
    await cleanupTestData(testData);
    
    // Print results
    console.log('\n📊 Test Results:');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    
    if (testResults.failed === 0) {
      console.log('\n🎉 All security tests passed! User isolation is working correctly.');
    } else {
      console.log('\n⚠️ Some security tests failed. Please review the issues above.');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Run the tests
main().catch(console.error);
