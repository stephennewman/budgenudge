import { Button } from "@/components/ui/button";
import Link from "next/link";
import HomepageSlickTextForm from "@/components/homepage-slicktext-form";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
      <div className="mx-auto max-w-4xl flex flex-col text-center">
        <div className="flex justify-center items-center mb-6 sm:mb-8">
          <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            💳 Krezzo
          </div>
        </div>
        
        <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold !leading-tight mb-6">
          Know Your Money,<br/>
          <span className="text-blue-600">Before You Spend It</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Stop living paycheck to paycheck. Get intelligent budget analysis and daily financial snapshots 
          that predict your spending patterns and upcoming expenses before they surprise you.
        </p>

        {/* Problem Section */}
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 sm:p-6 mb-8 sm:mb-12 max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-red-800 dark:text-red-200 mb-4">The Hidden Cost of Financial Blindness</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-red-700 dark:text-red-300">
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

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button asChild size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 h-12 sm:h-auto">
            <Link href="/sign-up">Break the Cycle - $20</Link>
          </Button>
          <Button variant="outline" asChild size="lg" className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 h-12 sm:h-auto">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>

        {/* SlickText Form - Homepage Only */}
        <HomepageSlickTextForm />

        {/* Value Proposition Section */}
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 sm:p-6 mb-8 sm:mb-16 max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-green-800 dark:text-green-200 mb-4">How Krezzo Transforms Your Financial Life</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-green-700 dark:text-green-300">
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-1">📱</span>
              <span><strong>Daily SMS insights</strong> delivered at 7:00 AM - no app checking required</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-1">🤖</span>
              <span><strong>Smart AI analysis</strong> of your spending patterns across all bank accounts</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-1">📊</span>
              <span><strong>Predictive bill reminders</strong> so you&apos;re never caught off guard</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 mt-1">🏦</span>
              <span><strong>Multi-bank integration</strong> through secure Plaid connections</span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-12 sm:mb-16">
          <div className="text-center p-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl sm:text-2xl">🔗</span>
            </div>
            <h3 className="font-semibold mb-2">1. Connect Banks</h3>
            <p className="text-sm text-muted-foreground">Securely link all your accounts through Plaid</p>
          </div>
          
          <div className="text-center p-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl sm:text-2xl">🤖</span>
            </div>
            <h3 className="font-semibold mb-2">2. AI Analysis</h3>
            <p className="text-sm text-muted-foreground">Smart categorization and pattern detection</p>
          </div>
          
          <div className="text-center p-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl sm:text-2xl">📱</span>
            </div>
            <h3 className="font-semibold mb-2">3. Daily SMS</h3>
            <p className="text-sm text-muted-foreground">Personalized insights delivered every morning</p>
          </div>
          
          <div className="text-center p-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-xl sm:text-2xl">💡</span>
            </div>
            <h3 className="font-semibold mb-2">4. Stay Aware</h3>
            <p className="text-sm text-muted-foreground">Make informed decisions before you spend</p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📅</span>
              <h3 className="font-semibold">Recurring Bill Tracking</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatically detect and predict your recurring expenses. Never miss a payment again with intelligent bill reminders.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📊</span>
              <h3 className="font-semibold">Spending Pattern Analysis</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Get insights into your spending habits with intelligent categorization and trend analysis across all accounts.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔔</span>
              <h3 className="font-semibold">Proactive Alerts</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Receive daily SMS notifications with your financial snapshot - no need to open apps or check multiple accounts.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🏦</span>
              <h3 className="font-semibold">Multi-Bank Integration</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect checking, savings, and credit accounts from any bank. Get a complete financial picture in one place.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔒</span>
              <h3 className="font-semibold">Bank-Level Security</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Read-only access through Plaid&apos;s secure API. Your login credentials are never stored or accessible.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border rounded-xl p-6 text-left">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚡</span>
              <h3 className="font-semibold">Real-Time Processing</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Transactions are processed and analyzed within seconds. Your financial insights are always up-to-date.
            </p>
          </div>
        </div>

        {/* Social Proof */}
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-6 sm:p-8 mb-12 sm:mb-16">
          <h2 className="text-xl sm:text-2xl font-bold mb-6">Why Users Choose Krezzo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">78%</div>
              <p className="text-muted-foreground">of Americans live paycheck to paycheck - mostly due to lack of spending visibility</p>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">$2,000+</div>
              <p className="text-muted-foreground">average annual savings when users gain financial awareness and predictive insights</p>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2">100%</div>
              <p className="text-muted-foreground">reliability - zero system failures, zero security incidents, zero data breaches</p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Break the Paycheck-to-Paycheck Cycle?</h2>
          <p className="text-base sm:text-lg mb-6 opacity-90">
            Join the users who&apos;ve transformed their financial awareness with intelligent budget analysis and predictive insights. No more financial surprises.
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 h-12 sm:h-auto">
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
