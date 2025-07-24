import { Button } from "@/components/ui/button";
import Link from "next/link";
import HomepageSlickTextForm from "@/components/homepage-slicktext-form";
import Logo from "@/components/logo";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16">
      <div className="mx-auto max-w-4xl flex flex-col text-center">
        
        {/* Direct Value Proposition */}
        <div className="flex justify-center items-center mb-4">
          <Logo size="lg" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold !leading-tight mb-6">
          Stop wondering where your money went.
        </h1>
        
        <p className="text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
          Get a daily text at 7 AM with exactly what you spent yesterday and what bills are coming up. No apps. No spreadsheets. No bullshit.
        </p>

        <p className="text-lg mb-8 font-semibold">
          Finally, financial awareness that actually fits into your life.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button asChild size="lg" className="text-lg px-8 py-4 h-auto">
            <Link href="/sign-up">Start Getting Daily Texts - $20</Link>
          </Button>
          <Button variant="outline" asChild size="lg" className="text-lg px-8 py-4 h-auto">
                         <Link href="/sign-in">I&apos;m Already Smart</Link>
          </Button>
        </div>

        {/* How It Works - Dead Simple */}
        <div className="bg-gray-50 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6">How It Works (It&apos;s Stupid Simple)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
            <div>
              <div className="text-3xl mb-3">1.</div>
              <h3 className="font-semibold mb-2">Sign up</h3>
                             <p className="text-sm text-muted-foreground">Takes 2 minutes. We&apos;re not going to spam you with a million questions.</p>
            </div>
            
            <div>
              <div className="text-3xl mb-3">2.</div>
              <h3 className="font-semibold mb-2">Connect your bank</h3>
                             <p className="text-sm text-muted-foreground">Secure Plaid integration. Same thing your bank uses. We can&apos;t touch your money.</p>
            </div>
            
            <div>
              <div className="text-3xl mb-3">3.</div>
              <h3 className="font-semibold mb-2">Get daily texts</h3>
                             <p className="text-sm text-muted-foreground">Every morning at 7 AM. What you spent. What&apos;s coming up. Done.</p>
            </div>
          </div>
        </div>

        {/* Competitive Objection Handling */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-red-800 mb-6">Why Everything Else Sucks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left text-sm">
            <div>
              <h3 className="font-semibold text-red-700 mb-2">📊 Tiller</h3>
                             <p className="text-red-600">Who wants to deal with spreadsheets? It&apos;s 2025, not 1995.</p>
            </div>
            <div>
              <h3 className="font-semibold text-red-700 mb-2">🏦 Mint</h3>
                             <p className="text-red-600">Intuit killed it. RIP. Hope you didn&apos;t get too attached.</p>
            </div>
            <div>
              <h3 className="font-semibold text-red-700 mb-2">🚀 Rocket Money</h3>
                             <p className="text-red-600">Don&apos;t fund their executive space explorations with your $12/month.</p>
            </div>
            <div>
                             <h3 className="font-semibold text-red-700 mb-2">📝 YNAB</h3>
               <p className="text-red-600">Eff budgets! Life&apos;s too short for that kind of micromanagement.</p>
            </div>
            <div>
              <h3 className="font-semibold text-red-700 mb-2">👑 Monarch Money</h3>
                             <p className="text-red-600">They&apos;ll use your money to buy more Reddit ads. How meta.</p>
            </div>
            <div>
              <h3 className="font-semibold text-red-700 mb-2">📱 Banking Apps</h3>
              <p className="text-red-600">Good luck remembering to check 47 different apps every day.</p>
            </div>
          </div>
        </div>

        {/* What You Actually Get */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-green-800 mb-6">What You Actually Get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            <div className="flex items-start gap-3">
              <span className="text-green-600 mt-1">✅</span>
              <div>
                                 <h3 className="font-semibold">Yesterday&apos;s spending breakdown</h3>
                <p className="text-sm text-green-700">See exactly where your money went without opening an app</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 mt-1">✅</span>
              <div>
                <h3 className="font-semibold">Upcoming bill reminders</h3>
                <p className="text-sm text-green-700">Never get hit with surprise charges again</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 mt-1">✅</span>
              <div>
                <h3 className="font-semibold">Spending pattern alerts</h3>
                                 <p className="text-sm text-green-700">When you&apos;re blowing through cash faster than usual</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 mt-1">✅</span>
              <div>
                <h3 className="font-semibold">Zero effort required</h3>
                <p className="text-sm text-green-700">Set it and forget it. We do the work, you get smarter</p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof That Matters */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Real Results</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">$247</div>
              <p className="text-sm text-muted-foreground">Average monthly savings when you know where your money goes</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">3 min</div>
              <p className="text-sm text-muted-foreground">Time it takes to read your daily text and stay informed</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">0</div>
              <p className="text-sm text-muted-foreground">Apps you need to remember to check or maintain</p>
            </div>
          </div>
        </div>

        {/* Final CTA - Direct and Honest */}
        <div className="bg-blue-600 text-white rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">Stop Flying Blind With Your Money</h2>
          <p className="text-lg mb-6 opacity-90">
            Twenty bucks. One time. Daily financial awareness that actually works. 
            No subscriptions, no upsells, no nonsense.
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4 h-auto">
            <Link href="/sign-up">Get Financial Awareness - $20</Link>
          </Button>
          <p className="text-sm mt-4 opacity-75">
            Bank-level security • No access to your money • Cancel anytime
          </p>
        </div>

        {/* SlickText Form */}
        <div className="mt-12">
          <HomepageSlickTextForm />
        </div>
      </div>
    </div>
  );
}
