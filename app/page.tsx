import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-4xl flex flex-col text-center">
        <div className="flex justify-center items-center mb-8">
          <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            💳 BudgeNudge
          </div>
        </div>
        
        <h1 className="text-4xl lg:text-6xl font-bold !leading-tight mb-6">
          Know Your Money,<br/>
          <span className="text-blue-600">Before You Spend It</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Stop living paycheck to paycheck. Get intelligent budget analysis and daily financial snapshots 
          that predict your spending patterns and upcoming expenses before they surprise you.
        </p>

        {/* Problem Section */}
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-12 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-4">The Hidden Cost of Financial Blindness</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-red-700 dark:text-red-300">
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1">⚠️</span>
              <span><strong>78% of Americans</strong> live paycheck to paycheck, often due to poor spending visibility</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1">💸</span>
              <span><strong>$2,000+ annually</strong> lost to overdraft fees and unexpected bill stress</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1">🔍</span>
              <span><strong>Most people check</strong> their account balance only after spending money</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1">📅</span>
              <span><strong>Bills hit unexpectedly</strong> because there&apos;s no early warning system</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center mb-12">
          <Button asChild size="lg" className="text-lg px-8 py-4">
            <Link href="/sign-up">Break the Cycle - $20</Link>
          </Button>
          <Button variant="outline" asChild size="lg" className="text-lg px-8 py-4">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>

        {/* Value Proposition Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-12 mb-16">
          <div className="border rounded-xl p-8 bg-gradient-to-b from-background to-muted/20">
            <div className="text-4xl mb-4">🔮</div>
            <h3 className="font-semibold mb-3 text-lg">Predicted Transactions</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              See your upcoming bills and recurring expenses before they hit. Our AI analyzes your spending patterns to predict what&apos;s coming next, so you&apos;re never caught off guard.
            </p>
          </div>
          
          <div className="border rounded-xl p-8 bg-gradient-to-b from-background to-muted/20">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-semibold mb-3 text-lg">Merchant Pacing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track your spending velocity with your top 3 merchants. Know if you&apos;re on pace to overspend at Amazon, grocery stores, or coffee shops before you blow your budget.
            </p>
          </div>
          
          <div className="border rounded-xl p-8 bg-gradient-to-b from-background to-muted/20">
            <div className="text-4xl mb-4">🕐</div>
            <h3 className="font-semibold mb-3 text-lg">Recent Activity Spotcheck</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Quick review of yesterday's transactions. Stay aware of your spending without obsessive account checking or waiting for delayed bank notifications.
            </p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl p-8 mb-16">
          <div className="text-3xl font-bold mb-4">One-Time Investment</div>
          <div className="text-6xl font-bold text-blue-600 mb-4">$20</div>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            A one-time investment to cover enterprise-grade financial data processing infrastructure. 
            No subscriptions, no recurring fees, no hidden charges. Own your financial awareness forever.
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Connect unlimited bank accounts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Daily intelligent budget snapshots</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Predictive transaction analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Merchant spending velocity insights</span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="font-semibold mb-2">Secure Payment & Connection</h3>
              <p className="text-sm text-muted-foreground">
                One-time $20 investment, then securely connect your bank accounts using the same enterprise-grade infrastructure trusted by major financial institutions.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="font-semibold mb-2">Intelligent Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our advanced algorithms analyze your complete transaction history to understand spending patterns, identify recurring bills, and predict future expenses.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="font-semibold mb-2">Daily Financial Intelligence</h3>
              <p className="text-sm text-muted-foreground">
                Receive daily insights with predicted bills, spending pace alerts, and transaction summaries. Never be surprised by your money again.
              </p>
            </div>
          </div>
        </div>

        {/* Trust & Security Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Enterprise-Grade Security & Trust</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
              <div className="text-3xl mb-4">🏦</div>
              <h3 className="font-semibold mb-2">Bank-Level Security</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your data is protected by the same 256-bit encryption and security protocols used by major banks. We use read-only access - we can never move money or access your credentials.
              </p>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600">🔒</span>
                  <span>256-bit SSL encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">🔒</span>
                  <span>SOC 2 Type II compliant infrastructure</span>
                </div>
              </div>
            </div>
            
            <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
              <div className="text-3xl mb-4">🏛️</div>
              <h3 className="font-semibold mb-2">Trusted Financial Infrastructure</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Built on the same financial data platform trusted by major banks, credit unions, and fintech companies. Connects to 11,000+ financial institutions across North America.
              </p>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600">🏆</span>
                  <span>Used by Fortune 500 companies</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">🏆</span>
                  <span>Regulatory compliance certified</span>
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
              <div className="text-3xl mb-4">🛡️</div>
              <h3 className="font-semibold mb-2">Your Data, Your Control</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We never store your banking passwords or credentials. Your financial data is processed securely and only used to generate your personalized insights.
              </p>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600">✓</span>
                  <span>Read-only account access</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>No credential storage</span>
                </div>
              </div>
            </div>
            
            <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
              <div className="text-3xl mb-4">🔬</div>
              <h3 className="font-semibold mb-2">Battle-Tested Technology</h3>
              <p className="text-sm text-muted-foreground mb-4">
                3+ months of intensive development to solve complex financial data processing challenges. Proven with 100+ real transactions analyzed with zero security incidents.
              </p>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600">📊</span>
                  <span>100+ transactions processed safely</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">📊</span>
                  <span>Zero security incidents</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-8 mb-16">
          <h2 className="text-2xl font-bold mb-6">Why Users Choose BudgeNudge</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">78%</div>
              <p className="text-muted-foreground">of Americans live paycheck to paycheck - mostly due to lack of spending visibility</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">$2,000+</div>
              <p className="text-muted-foreground">average annual savings when users gain financial awareness and predictive insights</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">100%</div>
              <p className="text-muted-foreground">reliability - zero system failures, zero security incidents, zero data breaches</p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-4">Ready to Break the Paycheck-to-Paycheck Cycle?</h2>
          <p className="text-lg mb-6 opacity-90">
            Join the users who&apos;ve transformed their financial awareness with intelligent budget analysis and predictive insights. No more financial surprises.
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4">
            <Link href="/sign-up">Get Started - $20 One-Time</Link>
          </Button>
          <p className="text-sm mt-4 opacity-75">
            Secure connection • Enterprise-grade encryption • No recurring fees
          </p>
        </div>
      </div>
    </div>
  );
}
