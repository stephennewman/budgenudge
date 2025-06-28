# 💡 IDEA AGENT - BudgeNudge Feature Ideas & Roadmap

**Created:** June 26, 2025 7:24 AM EDT
**Status:** Concept & Planning Phase

---

## 📱 USER ONBOARDING ENHANCEMENT

### Phone Number Collection During Plaid Link Flow ⭐ HIGH PRIORITY

**Problem:** Currently SMS notifications hardcoded to single phone number (6173472721)
**Solution:** Collect phone number during bank connection flow

**Implementation Strategy:**
- **Pre-Plaid Modal Approach** (Recommended)
  - User signs up with email/password only (no friction)
  - When clicking "Connect Bank Account" → Phone collection modal appears
  - Modal: "Enter phone number to receive instant transaction alerts"
  - SMS verification (6-digit code)
  - After verification → Plaid Link opens automatically
  - Store phone in user_profiles table or user metadata

**User Experience Flow:**
1. Sign Up → Email + password (existing)
2. Dashboard → "Connect Bank Account" button
3. **NEW:** Phone modal → "Enter phone for SMS alerts"
4. Phone verification → SMS code validation
5. Plaid Link → Bank connection (existing)
6. SMS enabled → User's phone number stored

**Technical Requirements:**
- Phone collection modal component
- SMS verification system (Resend API)
- Database schema: user_profiles table with phone_number field
- Update webhook to query user's phone instead of hardcoded
- Carrier detection for SMS gateway routing
- Settings page for phone number management

**Benefits:**
- ✅ Natural flow: "Connect bank → Get SMS alerts"
- ✅ Only collect phone from engaged users who connect banks
- ✅ Clear value proposition at perfect moment
- ✅ No sign-up friction
- ✅ Phone verification ensures deliverability
- ✅ Reduces spam/fake accounts

**Priority:** Critical for new user onboarding

---

## 🚀 NEW FEATURE IDEAS

- idea... calendar list view
- text message update includes the upcoming transactions for tomorrow / week
- text message includes spending for top "subscribe / tracked" merchants
- spending by category
- schedule updates
- subscribe / track merchants / categories
- benchmark
- money tip text

---

## 💰 PRICING MODEL CONCEPTS

- one-time fee 
- cost associated with # of accounts... and updates subscribed

---

## ❓ OUTSTANDING QUESTIONS / ITEMS

- need to test other vendors and understand their schedules
- add additional accounts .. disconnect accounts 