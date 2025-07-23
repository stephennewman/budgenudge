import { Button } from "@/components/ui/button";
import Link from "next/link";
import HomepageSlickTextForm from "@/components/homepage-slicktext-form";
import Logo from "@/components/logo";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
      <div className="mx-auto max-w-6xl flex flex-col text-center">
        
        {/* Achievement Badge */}
        <div className="flex justify-center items-center mb-4">
          <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold border border-green-200">
            ✅ LIVE & OPERATIONAL • 100+ Transactions Monitored • 99% AI Coverage
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center items-center mb-6 sm:mb-8">
          <Logo size="xl" className="h-16 sm:h-20" />
        </div>
        
        {/* New Hero - Showcase Achievement */}
        <h1 className="font-eb-garamond text-4xl sm:text-5xl lg:text-7xl font-bold !leading-tight mb-6">
          AI-Powered Financial Intelligence<br/>
          <span className="text-blue-600">Via Daily SMS</span>
        </h1>
        
        <p className="font-eb-garamond text-xl sm:text-2xl text-muted-foreground mb-4 max-w-4xl mx-auto leading-relaxed">
          After 3+ months of intensive development, Krezzo is now a fully operational intelligent financial wellness platform with real-time transaction monitoring and smart insights.
        </p>

        <p className="font-eb-garamond text-lg text-muted-foreground mb-8 max-w-3xl mx-auto">
          Experience enterprise-grade financial monitoring with 99% automatic AI merchant tagging, professional SMS delivery, and multi-bank integration through Plaid&apos;s production environment.
        </p>

        {/* Production Metrics Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6 sm:p-8 mb-8 max-w-5xl mx-auto">
          <h2 className="font-eb-garamond text-xl sm:text-2xl font-bold text-gray-800 mb-6">Production Platform Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">99%</div>
              <p className="text-sm text-gray-600">AI Tagging Coverage</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">&lt;5s</div>
              <p className="text-sm text-gray-600">Webhook Processing</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-2">100+</div>
              <p className="text-sm text-gray-600">Transactions Monitored</p>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-2">99.9%</div>
              <p className="text-sm text-gray-600">System Uptime</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button asChild size="lg" className="text-base sm:text-lg px-8 py-4 h-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Link href="/sign-up">Experience Krezzo - $20</Link>
          </Button>
          <Button variant="outline" asChild size="lg" className="text-base sm:text-lg px-8 py-4 h-auto border-2">
            <Link href="/sign-in">Access Dashboard</Link>
          </Button>
        </div>

        {/* SlickText Form - Homepage Only */}
        <HomepageSlickTextForm />

        {/* AI Intelligence Section */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6 sm:p-8 mb-12 max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">🤖 Advanced AI Intelligence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            <div className="flex flex-col gap-2">
              <span className="text-2xl">🎯</span>
              <h3 className="font-semibold">99% Automatic Tagging</h3>
              <p className="text-sm text-gray-600">Smart merchant normalization with OpenAI GPT-4 integration and intelligent caching</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-2xl">⚡</span>
              <h3 className="font-semibold">Real-Time Processing</h3>
              <p className="text-sm text-gray-600">15-minute automation cycles with webhook-based transaction monitoring</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-2xl">🧠</span>
              <h3 className="font-semibold">Smart Pattern Detection</h3>
              <p className="text-sm text-gray-600">Predictive bill detection and intelligent spending analysis across all accounts</p>
            </div>
          </div>
        </div>

        {/* 4-Template SMS Intelligence System */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 sm:p-8 mb-12 max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">📱 4-Template SMS Intelligence System</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="text-2xl mb-3">📅</div>
              <h3 className="font-semibold mb-2">Bills & Payments</h3>
              <p className="text-sm text-gray-600">Upcoming recurring bills with smart prediction and amount forecasting</p>
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="text-2xl mb-3">📊</div>
              <h3 className="font-semibold mb-2">Yesterday&apos;s Activity</h3>
              <p className="text-sm text-gray-600">Recent transaction summaries with AI merchant normalization</p>
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="text-2xl mb-3">🏪</div>
              <h3 className="font-semibold mb-2">Merchant Pacing</h3>
              <p className="text-sm text-gray-600">Spending analysis for user-selected merchants with pacing indicators</p>
            </div>
            <div className="bg-white rounded-xl p-4 border shadow-sm">
              <div className="text-2xl mb-3">📈</div>
              <h3 className="font-semibold mb-2">Category Pacing</h3>
              <p className="text-sm text-gray-600">Spending analysis by category with visual budget indicators</p>
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              <strong>Professional SMS Delivery:</strong> SlickText API • User-controlled preferences • Optimal timing
            </p>
          </div>
        </div>

        {/* Enterprise Technology Stack */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">🏗️ Enterprise-Grade Technology Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl sm:text-2xl">🏦</span>
              </div>
              <h3 className="font-semibold mb-2">Plaid Production</h3>
              <p className="text-sm text-muted-foreground">Multi-bank integration with real-time webhook processing</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl sm:text-2xl">🤖</span>
              </div>
              <h3 className="font-semibold mb-2">OpenAI GPT-4</h3>
              <p className="text-sm text-muted-foreground">99% automatic merchant tagging with smart caching</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl sm:text-2xl">📱</span>
              </div>
              <h3 className="font-semibold mb-2">SlickText API</h3>
              <p className="text-sm text-muted-foreground">Professional SMS delivery with 4 intelligent templates</p>
            </div>
            
            <div className="text-center p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-xl sm:text-2xl">⚡</span>
              </div>
              <h3 className="font-semibold mb-2">Next.js 15</h3>
              <p className="text-sm text-muted-foreground">Modern React framework with Supabase PostgreSQL</p>
            </div>
          </div>
          
          {/* Technical Achievement Banner */}
          <div className="mt-8 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              <strong>3+ Months of Development</strong> • <strong>15+ Database Tables</strong> • <strong>40+ API Endpoints</strong>
            </p>
            <p className="text-xs text-gray-500">
              Fully automated system requiring zero manual intervention
            </p>
          </div>
        </div>

        {/* Advanced Features Grid */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">🚀 Advanced Platform Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white border rounded-xl p-6 text-left hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🎯</span>
                <h3 className="font-semibold">99% AI Tagging Coverage</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatic merchant normalization with OpenAI GPT-4 integration. Smart caching reduces API costs by 80%.
              </p>
            </div>
            
            <div className="bg-white border rounded-xl p-6 text-left hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">📱</span>
                <h3 className="font-semibold">Mobile-Responsive Design</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Complete mobile optimization with hamburger navigation, touch-friendly interface, and 85/100 mobile UX score.
              </p>
            </div>
            
            <div className="bg-white border rounded-xl p-6 text-left hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚡</span>
                <h3 className="font-semibold">Real-Time Webhooks</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                &lt;5 second processing from transaction to SMS notification. 15-minute AI tagging automation cycles.
              </p>
            </div>
            
            <div className="bg-white border rounded-xl p-6 text-left hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">📊</span>
                <h3 className="font-semibold">Advanced Analytics</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                AI merchant analysis, category pacing, visual budget indicators, and predictive bill detection.
              </p>
            </div>
            
            <div className="bg-white border rounded-xl p-6 text-left hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔐</span>
                <h3 className="font-semibold">Enterprise Security</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Bank-level security with Plaid production environment. Read-only access with encrypted webhook communication.
              </p>
            </div>
            
            <div className="bg-white border rounded-xl p-6 text-left hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <h3 className="font-semibold">Zero Manual Intervention</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Fully automated system with smart caching, error handling, and comprehensive monitoring. 99.9% uptime.
              </p>
            </div>
          </div>
        </div>

        {/* Platform Achievements */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 sm:p-8 mb-12 sm:mb-16 border border-gray-200">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">🏆 Platform Achievement Milestones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-3">3+ Months</div>
              <h3 className="font-semibold mb-2">Intensive Development</h3>
              <p className="text-sm text-gray-600">From concept to production-ready financial intelligence platform</p>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-3">99%</div>
              <h3 className="font-semibold mb-2">AI Coverage Achieved</h3>
              <p className="text-sm text-gray-600">Automatic merchant tagging with smart caching and zero manual intervention</p>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-3">100+</div>
              <h3 className="font-semibold mb-2">Transactions Monitored</h3>
              <p className="text-sm text-gray-600">Real production data across multiple bank accounts with enterprise reliability</p>
            </div>
          </div>
          
          {/* Technical Milestones */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-orange-600">&lt;5s</div>
                <p className="text-xs text-gray-600">Webhook Processing</p>
              </div>
              <div>
                <div className="text-lg font-bold text-indigo-600">15+</div>
                <p className="text-xs text-gray-600">Database Tables</p>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">40+</div>
                <p className="text-xs text-gray-600">API Endpoints</p>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">99.9%</div>
                <p className="text-xs text-gray-600">System Uptime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8 sm:p-10">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready for Enterprise-Grade Financial Intelligence?</h2>
            <p className="text-lg sm:text-xl mb-6 opacity-90 max-w-3xl mx-auto">
              Experience the power of a fully operational AI-driven platform with 99% automation coverage, real-time processing, and professional SMS delivery.
            </p>
            
            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-sm opacity-90">
              <div className="flex items-center justify-center gap-2">
                <span>✅</span>
                <span>99% AI Coverage</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span>⚡</span>
                <span>&lt;5s Processing</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span>🏦</span>
                <span>Multi-Bank Integration</span>
              </div>
            </div>
            
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4 h-auto font-semibold">
              <Link href="/sign-up">Access Krezzo Platform - $20</Link>
            </Button>
            <p className="text-sm mt-4 opacity-75">
              Production-ready platform • Bank-level security • Zero manual intervention required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
