#!/usr/bin/env node

const https = require('https');
const http = require('http');

const PROD_URL = 'https://budgenudge-lm9sfj52v-krezzo.vercel.app';
const LOCAL_URL = 'http://localhost:3000';

async function makeRequest(url, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = url + path;
    const isHttps = fullUrl.startsWith('https');
    const lib = isHttps ? https : http;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = lib.request(fullUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoint(name, url, path, expectedStatus = 200) {
  try {
    console.log(`🧪 Testing ${name}...`);
    const result = await makeRequest(url, path, 'POST');
    
    if (result.status === expectedStatus) {
      console.log(`✅ ${name}: PASS (${result.status})`);
      return true;
    } else {
      console.log(`❌ ${name}: FAIL (${result.status})`);
      console.log(`   Response:`, result.data);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return false;
  }
}

async function testPageAccess(name, url, path) {
  try {
    console.log(`🌐 Testing ${name}...`);
    const result = await makeRequest(url, path, 'GET');
    
    if (result.status === 200 || result.status === 302) {
      console.log(`✅ ${name}: ACCESSIBLE (${result.status})`);
      return true;
    } else {
      console.log(`❌ ${name}: INACCESSIBLE (${result.status})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 BudgeNudge Deployment Test Script');
  console.log('=====================================\n');

  const useLocal = process.argv.includes('--local');
  const url = useLocal ? LOCAL_URL : PROD_URL;
  
  console.log(`Testing ${useLocal ? 'LOCAL' : 'PRODUCTION'} deployment: ${url}\n`);

  let passed = 0;
  let total = 0;

  // Test API endpoints
  console.log('📡 API Endpoint Tests:');
  total++;
  if (await testEndpoint('Test SMS API', url, '/api/test-sms')) passed++;
  
  total++;
  if (await testEndpoint('Manual SMS API', url, '/api/manual-sms')) passed++;
  
  total++;
  if (await testEndpoint('Test Suite API', url, '/api/run-tests')) passed++;

  console.log('\n🌐 Page Access Tests:');
  total++;
  if (await testPageAccess('Homepage', url, '/')) passed++;
  
  total++;
  if (await testPageAccess('Sign-in Page', url, '/sign-in')) passed++;
  
  total++;
  if (await testPageAccess('Sign-up Page', url, '/sign-up')) passed++;
  
  total++;
  if (await testPageAccess('Check Email Page', url, '/check-email')) passed++;

  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Deployment is healthy.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check deployment.');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
BudgeNudge Deployment Test Script

Usage:
  node scripts/test-deployment.js          # Test production
  node scripts/test-deployment.js --local  # Test local development
  node scripts/test-deployment.js --help   # Show this help

Tests:
  - API endpoint accessibility
  - Page loading and routing
  - Basic functionality checks
  `);
  process.exit(0);
}

runTests().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
}); 