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
          Get instant budget analysis and daily financial snapshots. Connect your bank account once, 
          and receive intelligent insights about your spending patterns and upcoming bills.
        </p>

        <div className="flex gap-4 justify-center mb-12">
          <Button asChild size="lg" className="text-lg px-8 py-4">
            <Link href="/sign-up">Start Your Analysis - $20</Link>
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
              See your upcoming bills and recurring expenses before they hit. Our AI analyzes your spending patterns to predict what's coming next.
            </p>
          </div>
          
          <div className="border rounded-xl p-8 bg-gradient-to-b from-background to-muted/20">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-semibold mb-3 text-lg">Merchant Pacing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Track your spending velocity with your top 3 merchants. Know if you're on pace to overspend at Amazon, grocery stores, or coffee shops.
            </p>
          </div>
          
          <div className="border rounded-xl p-8 bg-gradient-to-b from-background to-muted/20">
            <div className="text-4xl mb-4">🕐</div>
            <h3 className="font-semibold mb-3 text-lg">Recent Activity</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Quick spot-check of your last 10 transactions. Stay aware of your spending without obsessive account checking.
            </p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl p-8 mb-16">
          <div className="text-3xl font-bold mb-4">One-Time Payment</div>
          <div className="text-6xl font-bold text-blue-600 mb-4">$20</div>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Pay once to cover the processing costs of connecting to financial institutions. 
            No subscriptions, no recurring fees, no hidden charges.
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Unlimited bank connections</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Daily budget snapshots</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Predictive transaction analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Merchant spending insights</span>
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
              <h3 className="font-semibold mb-2">Pay & Connect</h3>
              <p className="text-sm text-muted-foreground">
                One-time $20 payment, then securely connect your bank accounts using Plaid's enterprise-grade technology.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="font-semibold mb-2">Analysis Complete</h3>
              <p className="text-sm text-muted-foreground">
                Our system analyzes your transaction history to understand your spending patterns and predict future expenses.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="font-semibold mb-2">Daily Insights</h3>
              <p className="text-sm text-muted-foreground">
                Receive daily snapshots with predicted bills, spending pace alerts, and transaction summaries.
              </p>
            </div>
          </div>
        </div>

        {/* Trust Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="font-semibold mb-2">Bank-Level Security</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Plaid's secure API with read-only access to your accounts. We never store your banking credentials.
            </p>
          </div>
          
          <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="font-semibold mb-2">Battle-Tested Technology</h3>
            <p className="text-sm text-muted-foreground">
              3+ months of development to solve complex financial data processing. 100+ transactions analyzed with zero failures.
            </p>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-4">Ready to Take Control?</h2>
          <p className="text-lg mb-6 opacity-90">
            Join the users who've transformed their financial awareness with intelligent budget analysis.
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4">
            <Link href="/sign-up">Get Started - $20 One-Time</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
