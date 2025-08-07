# 🧪 Krezzo Manual Testing Guide

**Test your deployment:** https://budgenudge-lm9sfj52v-krezzo.vercel.app

## ✅ **AUTOMATED TESTS AVAILABLE**

### Test Suite Dashboard
- **URL**: `/protected/test-suite` (after login)
- **Features**: 
  - Automated backend tests
  - SMS system validation
  - Database connectivity checks
  - User data isolation verification

---

## 📋 **MANUAL TESTING CHECKLIST**

### **Test 1: Sign-up Redirect Fix** ✅
**Problem Fixed**: New users redirected to blank sign-in page instead of email confirmation

**Test Steps**:
1. Open **incognito window** → https://budgenudge-lm9sfj52v-krezzo.vercel.app
2. Click "Sign Up" 
3. Enter new email address (e.g., `test+123@example.com`)
4. Enter password → Submit

**✅ Expected Result**: Redirected to `/check-email` page with confirmation message
**❌ Failure**: Redirects to sign-in page or shows error

---

### **Test 2: Email Confirmation Auto-Login** ✅  
**Problem Fixed**: Users had to manually login after email confirmation

**Test Steps**:
1. After Test 1, check your email inbox
2. Click the "Confirm your email" link
3. Wait for page to load

**✅ Expected Result**: Automatically logged in and redirected to protected dashboard
**❌ Failure**: Stuck on auth page or redirected to sign-in

---

### **Test 3: New User Onboarding Flow** ✅
**Problem Fixed**: New users saw full dashboard before connecting bank account

**Test Steps**:
1. After successful email confirmation (Test 2)
2. Should see the protected dashboard

**✅ Expected Result**: Welcome screen with "Connect Your Bank Account" button prominently displayed
**❌ Failure**: Shows full dashboard with transactions/calendar without bank connection

---

### **Test 4: User Data Isolation (Security Fix)** ✅
**Problem Fixed**: Recurring bills showed transactions from ALL users (major security issue)

**Test Steps**:
1. Login to your account
2. Navigate to `/protected/recurring-bills` 
3. Check the "Upcoming Bills" section

**✅ Expected Result**: Only YOUR transactions displayed (or empty if no bank connected)
**❌ Failure**: Shows transactions from other users or random data

---

### **Test 5: Dynamic SMS System** ✅
**Problem Fixed**: SMS hardcoded to T-Mobile and phone 617-347-2721

**Test Steps**:
1. Navigate to `/protected/test-suite`
2. Click "🚀 Run Test Suite" 
3. Look for "SMS Test Send" result
4. OR use existing SMS test buttons in the app

**✅ Expected Result**: SMS sent to YOUR phone number with YOUR carrier
**❌ Failure**: SMS goes to 617-347-2721 or fails entirely

**Alternative Test**:
- Check `/api/test-sms` endpoint (should work for authenticated users)
- Manual SMS button in dashboard

---

### **Test 6: Webhook System Restoration** ✅
**Problem Fixed**: No transaction updates since June 30th (4+ day gap)

**Test Steps**:
1. Make a **real transaction** with your connected bank account
2. Wait 30 seconds to 2 minutes
3. Check your dashboard for new transaction
4. Check your phone for SMS notification

**✅ Expected Result**: 
- New transaction appears in dashboard
- SMS notification received within 5 seconds
- Transaction includes correct amount and merchant

**❌ Failure**: No new transactions appear or no SMS sent

**Alternative Test**:
- Check transaction history in dashboard for recent activity
- Look for gap in dates (should be continuous now)

---

## 🔧 **QUICK VERIFICATION TESTS**

### **Pages to Check** (All should load properly):
- ✅ **Homepage**: `/` 
- ✅ **Sign-in**: `/sign-in`
- ✅ **Sign-up**: `/sign-up` 
- ✅ **Check Email**: `/check-email`
- ✅ **Auth Callback**: `/auth/callback` (redirects after email confirmation)
- ✅ **Dashboard**: `/protected` (after login)
- ✅ **Test Suite**: `/protected/test-suite` (after login)

### **API Endpoints** (For authenticated users):
- ✅ **Test SMS**: `/api/test-sms` (POST)
- ✅ **Manual SMS**: `/api/manual-sms` (POST)  
- ✅ **Test Suite**: `/api/run-tests` (POST)
- ✅ **Webhook**: `/api/plaid/webhook` (external Plaid access)

---

## 🎯 **SUCCESS CRITERIA**

**All 6 fixes working = Production Ready!**

1. **Sign-up** → Check-email page ✅
2. **Email confirmation** → Auto-login ✅  
3. **New users** → Bank connection required ✅
4. **Recurring Bills** → User-specific data only ✅
5. **SMS** → Dynamic carrier/phone ✅
6. **Webhook** → Real-time transactions ✅

---

## 🚨 **TROUBLESHOOTING**

### **If Tests Fail**:

**Sign-up Issues**:
- Clear browser cache and cookies
- Try different email address
- Check email spam folder

**Email Confirmation Issues**:  
- Check if link expired (links timeout after time)
- Try requesting new confirmation email

**SMS Issues**:
- Verify phone number is set in your user profile
- Check if carrier is supported (T-Mobile, AT&T, Verizon, Sprint, etc.)
- Look in spam/junk folder

**Webhook Issues**:
- Make sure bank account is properly connected via Plaid
- Try disconnecting and reconnecting bank account
- Wait longer (some transactions take 2-3 minutes)

### **Support**:
- Use the Test Suite dashboard for automated diagnostics
- Check browser console for JavaScript errors
- Test in incognito mode to rule out browser issues

---

## 📊 **AUTOMATED TEST RESULTS**

When using the Test Suite (`/protected/test-suite`), you should see:

```
✅ Database Connection
✅ SMS Carrier Detection  
✅ User Phone Lookup System
✅ API Route Accessibility
✅ Auth Callback Route
✅ Database Schema - Accounts Table
✅ User Data Isolation
✅ SMS Test Send
```

**Expected Score: 8/8 tests passing**

If any tests fail, check the detailed error messages and run manual verification for that specific feature.

---

🎉 **If all tests pass, your Krezzo deployment is fully operational and ready for production use!** 