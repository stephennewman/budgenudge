# 💰 PAYBUDGE FEATURE SPECIFICATION

**Feature Name**: PayBudge - Pay-Cycle Aligned Billing System  
**Innovation Level**: 🚀 **BREAKTHROUGH** - No competitor offers this capability  
**Business Impact**: Enables natural billing cycles that match user cash flow  
**Technical Complexity**: Medium-High (14-20 hours estimated development)

---

## 🎯 FEATURE OVERVIEW

### **Core Concept**
PayBudge automatically detects when users get paid and aligns subscription billing to their actual pay schedule. Instead of arbitrary monthly billing, users pay smaller amounts that match their income rhythm.

### **Pricing Structure**
**Annual Revenue Target**: $520 across all billing cycles
- **Weekly Pay**: $10 every Friday (52 payments = $520/year)
- **Bi-weekly Pay**: $20 every other Friday (26 payments = $520/year)  
- **Monthly Pay**: $43.33/month (12 payments = $520/year)

### **Competitive Advantage**
- ✅ **First-to-Market**: No fintech app offers pay-aligned billing
- ✅ **Lower Psychological Barriers**: $10 weekly feels cheaper than $43 monthly
- ✅ **Natural Cash Flow**: Bills when user has money, not arbitrary dates
- ✅ **Budget Sync**: Budget resets every payday automatically

---

## 🏗️ TECHNICAL ARCHITECTURE

### **High-Level System Flow**
```
1. Transaction Analysis → Pay Schedule Detection
2. Stripe Dynamic Plan Creation → Billing Alignment  
3. Payday Detection → Budget Reset + SMS Notification
4. Continuous Monitoring → Pattern Updates
```

### **Core Components**

#### **1. Pay Schedule Detection Engine**
- **Input**: Historical transaction data from existing `transactions` table
- **Process**: Analyze deposit patterns for frequency and amounts
- **Output**: Pay schedule object with confidence scoring

#### **2. Stripe Flexible Billing Integration**  
- **Technology**: Stripe API with `billing_mode=flexible` (latest 2025-06-30.basil)
- **Capability**: Dynamic subscription plan creation based on detected pay patterns
- **Features**: Custom intervals (weekly/bi-weekly/monthly)

#### **3. Budget Management System**
- **Multiple Budget Types**: Create various budget templates per user
- **User Selection**: Allow user to choose their preferred budget approach  
- **Dynamic Reset**: Automatic budget refresh on payday detection

#### **4. Real-time Monitoring**
- **Payday Detection**: Webhook triggers when payday transaction occurs
- **Billing Execution**: Automatic Stripe charge on detected payday
- **Notification System**: SMS alerts via existing enhanced SMS system

---

## 📊 DATABASE SCHEMA CHANGES

### **New Tables**

#### **`user_pay_schedules` Table**
```sql
CREATE TABLE user_pay_schedules (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pay Pattern Detection
  pay_frequency TEXT NOT NULL, -- 'weekly', 'bi-weekly', 'monthly'
  estimated_pay_amount DECIMAL(10,2),
  last_pay_date DATE,
  next_predicted_pay_date DATE,
  confidence_score INTEGER, -- 0-100
  
  -- Billing Configuration  
  stripe_subscription_id TEXT,
  billing_amount INTEGER, -- Amount in cents (1000, 2000, 4333)
  billing_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'paused'
  
  -- Pattern Analysis
  pay_pattern_data JSONB, -- Store analysis metadata
  detection_method TEXT, -- 'automatic', 'manual_override'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);
```

#### **`user_budgets` Table**
```sql
CREATE TABLE user_budgets (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Budget Configuration
  budget_name TEXT NOT NULL, -- 'conservative', 'balanced', 'aggressive'
  budget_type TEXT NOT NULL, -- 'weekly', 'bi-weekly', 'monthly'  
  total_budget_amount DECIMAL(10,2),
  
  -- Budget Categories (JSONB for flexibility)
  category_allocations JSONB, -- {"groceries": 200, "entertainment": 100, etc}
  
  -- Status
  is_active BOOLEAN DEFAULT false, -- Only one budget active per user
  is_default BOOLEAN DEFAULT false,
  
  -- Budget Period Tracking
  current_period_start DATE,
  current_period_end DATE,
  spending_so_far DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Enhanced Existing Tables**

#### **Add to `auth.users` metadata**
```sql
-- Store high-level PayBudge status
UPDATE auth.users SET 
  raw_user_meta_data = raw_user_meta_data || 
  '{"paybudge_enabled": false, "pay_detection_status": "pending"}'::jsonb;
```

---

## 🔧 API ENDPOINTS TO BUILD

### **Pay Schedule Management**

#### **`POST /api/paybudge/analyze-pay-schedule`**
```typescript
// Analyze user's transaction history to detect pay patterns
{
  user_id: string;
  lookback_months?: number; // Default 3 months
}

// Response
{
  detected_schedule: {
    frequency: 'weekly' | 'bi-weekly' | 'monthly';
    estimated_amount: number;
    next_pay_date: string;
    confidence: number; // 0-100
    pattern_details: object;
  }
}
```

#### **`POST /api/paybudge/confirm-pay-schedule`**
```typescript
// User confirms or overrides detected pay schedule
{
  pay_frequency: 'weekly' | 'bi-weekly' | 'monthly';
  manual_override?: boolean;
  next_pay_date?: string;
}

// Creates Stripe subscription with dynamic billing
```

### **Budget Management**

#### **`POST /api/paybudge/create-budget-templates`**
```typescript
// Generate multiple budget options based on pay schedule
{
  pay_schedule_id: string;
  budget_types: ['conservative', 'balanced', 'aggressive'];
}

// Response: Array of budget templates user can choose from
```

#### **`POST /api/paybudge/activate-budget`**
```typescript
// User selects their preferred budget from templates
{
  budget_id: string;
}

// Deactivates other budgets, activates selected one
```

### **Billing & Monitoring**

#### **`POST /api/paybudge/webhook/payday-detected`**
```typescript
// Internal webhook when payday transaction detected
{
  user_id: string;
  transaction_id: string;
  detected_amount: number;
  pay_date: string;
}

// Triggers: Stripe billing + Budget reset + SMS notification
```

---

## 🧮 PAY DETECTION ALGORITHM

### **Core Logic Implementation**

```typescript
interface PayDetectionResult {
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'irregular';
  confidence: number; // 0-100
  estimated_amount: number;
  next_predicted_date: Date;
  pattern_analysis: {
    deposit_count: number;
    average_amount: number;
    consistency_score: number;
    intervals: number[]; // Days between deposits
  };
}

async function detectPaySchedule(userId: string): Promise<PayDetectionResult> {
  // 1. Get last 6 months of transactions
  const deposits = await getDepositsForUser(userId, 6);
  
  // 2. Filter for likely paychecks (largest, most regular deposits)
  const paycheckCandidates = deposits.filter(d => 
    d.amount > 500 && // Minimum threshold
    !isWeekend(d.date) && // Exclude weekend deposits
    !d.merchant_name?.includes('transfer') // Exclude transfers
  );
  
  // 3. Analyze intervals between deposits
  const intervals = calculateIntervalsBetweenDeposits(paycheckCandidates);
  
  // 4. Classify frequency based on interval patterns
  const frequency = classifyPayFrequency(intervals);
  
  // 5. Calculate confidence based on pattern consistency
  const confidence = calculatePatternConfidence(intervals, paycheckCandidates);
  
  // 6. Predict next pay date
  const nextPayDate = predictNextPayDate(paycheckCandidates, frequency);
  
  return {
    frequency,
    confidence,
    estimated_amount: calculateAveragePayAmount(paycheckCandidates),
    next_predicted_date: nextPayDate,
    pattern_analysis: buildPatternAnalysis(paycheckCandidates, intervals)
  };
}

function classifyPayFrequency(intervals: number[]): PayFrequency {
  const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
  
  if (avgInterval >= 6 && avgInterval <= 8) return 'weekly';
  if (avgInterval >= 13 && avgInterval <= 15) return 'bi-weekly';  
  if (avgInterval >= 28 && avgInterval <= 32) return 'monthly';
  return 'irregular';
}
```

---

## 💳 STRIPE INTEGRATION

### **Dynamic Subscription Creation**

```typescript
import Stripe from 'stripe';

async function createPayAlignedSubscription(
  customerId: string, 
  paySchedule: PaySchedule
): Promise<Stripe.Subscription> {
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  // Calculate billing amount based on frequency
  const billingAmounts = {
    'weekly': 1000,    // $10.00 in cents
    'bi-weekly': 2000, // $20.00 in cents  
    'monthly': 4333    // $43.33 in cents
  };
  
  // Create dynamic price for this user's schedule
  const price = await stripe.prices.create({
    unit_amount: billingAmounts[paySchedule.frequency],
    currency: 'usd',
    recurring: {
      interval: paySchedule.frequency === 'monthly' ? 'month' : 'week',
      interval_count: paySchedule.frequency === 'bi-weekly' ? 2 : 1
    },
    product_data: {
      name: `PayBudge ${paySchedule.frequency} Plan`,
      description: `Pay-aligned billing every ${paySchedule.frequency}`
    }
  });
  
  // Create subscription with flexible billing mode
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    
    // Enable new flexible billing features
    billing_mode: { type: 'flexible' },
    
    // Align billing to user's payday
    billing_cycle_anchor: Math.floor(paySchedule.next_pay_date.getTime() / 1000),
    
    // Save payment method for future billing
    payment_settings: {
      save_default_payment_method: 'on_subscription'
    },
    
    metadata: {
      paybudge_enabled: 'true',
      pay_frequency: paySchedule.frequency,
      user_pay_pattern: JSON.stringify(paySchedule.pattern_analysis)
    }
  });
  
  return subscription;
}
```

---

## 📱 USER EXPERIENCE FLOW

### **Phase 1: Onboarding & Detection**
1. **User signs up** → Existing Krezzo flow
2. **Connect bank account** → Existing Plaid integration  
3. **PayBudge Analysis** → "Analyzing your pay schedule..."
4. **Pattern Detection** → "We detected you get paid weekly on Fridays"
5. **Confirmation** → User confirms or manually adjusts
6. **Budget Templates** → Show 3 budget options (conservative/balanced/aggressive)
7. **Budget Selection** → User picks preferred budget approach

### **Phase 2: Billing Activation**  
1. **Payment Method** → Stripe Elements for card collection
2. **Subscription Creation** → Dynamic plan based on pay schedule
3. **Confirmation** → "You'll be charged $10 every Friday"

### **Phase 3: Ongoing Operation**
1. **Payday Detection** → System detects payday transaction
2. **Automatic Billing** → Stripe charges subscription amount  
3. **Budget Reset** → Fresh budget loaded for new pay period
4. **SMS Notification** → "💰 Fresh $X budget loaded for this pay period"

---

## 🔄 BUDGET SYSTEM DESIGN

### **Multiple Budget Templates**
Create several budget approaches per user but only display the active one:

#### **Conservative Budget** (70% spending allocation)
- 30% savings/emergency fund
- 40% fixed expenses (rent, utilities)  
- 30% discretionary spending

#### **Balanced Budget** (80% spending allocation)
- 20% savings
- 50% fixed expenses
- 30% discretionary spending

#### **Aggressive Budget** (90% spending allocation)  
- 10% savings
- 60% fixed expenses
- 30% discretionary spending

### **Budget Display Logic**
- Generate all 3 templates during onboarding
- User selects preferred approach
- Only show active budget in UI
- Allow switching between templates in settings

---

## 🚀 DEVELOPMENT PHASES

### **Phase 1: Pay Detection Engine (4-6 hours)**
- [ ] Build `detectPaySchedule()` algorithm  
- [ ] Create `user_pay_schedules` table
- [ ] Implement pattern analysis and confidence scoring
- [ ] Add API endpoint for pay schedule analysis

### **Phase 2: Stripe Integration (6-8 hours)**
- [ ] Set up Stripe flexible billing mode
- [ ] Implement dynamic subscription creation
- [ ] Build payment method collection flow
- [ ] Handle subscription lifecycle management

### **Phase 3: Budget Management (4-6 hours)**
- [ ] Create `user_budgets` table  
- [ ] Build budget template generation
- [ ] Implement budget selection and activation
- [ ] Add budget reset automation on payday

### **Phase 4: Integration & Testing (2-3 hours)**  
- [ ] Integrate with existing webhook system
- [ ] Add SMS notifications for budget resets
- [ ] Comprehensive testing of all pay schedule types
- [ ] Production deployment and monitoring

---

## 📈 SUCCESS METRICS

### **Technical KPIs**
- **Pay Detection Accuracy**: >90% confidence scores
- **Billing Success Rate**: >98% successful charges on payday
- **Budget Reset Latency**: <30 seconds from payday detection

### **Business KPIs**  
- **Conversion Rate**: Compare vs fixed monthly billing
- **Payment Failure Rate**: Should decrease with cash flow alignment
- **User Satisfaction**: Survey scores on billing convenience
- **Revenue Growth**: Track subscription upgrades and retention

---

## 🛡️ RISK MITIGATION

### **Edge Cases Handled**
- **Irregular Income**: Default to monthly billing + manual override
- **Multiple Jobs**: Focus on largest/most consistent deposits  
- **Pay Schedule Changes**: Re-analyze monthly, prompt user updates
- **Holiday Pay**: 2-3 day tolerance for early payments
- **Detection Failures**: Graceful fallback to standard monthly billing

### **Technical Safeguards**
- Confidence thresholds before auto-activation
- Manual override capabilities  
- Comprehensive logging and monitoring
- Stripe webhook validation and retry logic

---

## 🎯 COMPETITIVE IMPACT

This feature represents a **category-defining innovation** that could establish Krezzo as the leader in intelligent financial management. The combination of:

1. **Pay-aligned billing** (unique to market)
2. **Automatic budget resets** (user delight)  
3. **Lower payment barriers** (conversion optimization)
4. **Cash flow synchronization** (real user value)

Creates a **defensible competitive moat** that would be extremely difficult for competitors to replicate without similar transaction monitoring infrastructure.

---

**Ready for development! This spec provides comprehensive guidance for implementing PayBudge as Krezzo's breakthrough differentiating feature.** 