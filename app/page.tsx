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
        
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Get a daily text at 7 AM with exactly what you spent yesterday and what bills are coming up. No apps. No spreadsheets. No bullshit.
        </p>

        {/* Financial Pain Points - OVERKILL */}
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-red-800 mb-4">Sound Familiar?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left text-sm">
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">💸</span>
              <span className="text-red-700">Check your bank account and wonder &quot;WTF happened to my money?&quot;</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">😰</span>
              <span className="text-red-700">Get hit with surprise bills when you&apos;re already broke</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">🤯</span>
              <span className="text-red-700">Open 5 different banking apps just to see what&apos;s happening</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">📱</span>
              <span className="text-red-700">Download budgeting apps that you forget to use after 3 days</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">📊</span>
              <span className="text-red-700">Stare at overwhelming spreadsheets that make you want to cry</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">🔥</span>
              <span className="text-red-700">Live in constant low-level financial anxiety</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">💳</span>
              <span className="text-red-700">Death by a thousand subscriptions you forgot about</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">🤦</span>
              <span className="text-red-700">Feel like an idiot for not being &quot;good with money&quot;</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">⏰</span>
              <span className="text-red-700">Spend hours trying to figure out where you stand financially</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">😩</span>
              <span className="text-red-700">Make financial decisions based on guesswork and hope</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">🎢</span>
              <span className="text-red-700">Ride the emotional rollercoaster of financial surprises</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-1 text-lg">🤷</span>
              <span className="text-red-700">Live paycheck to paycheck not by choice, but by ignorance</span>
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-red-800 font-semibold text-lg">This is exhausting. And it&apos;s not your fault.</p>
            <p className="text-red-600 text-sm mt-1">The tools available are garbage. The system is broken. You need something that actually works.</p>
          </div>
        </div>

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

        {/* Competitive Objection Handling - EXPANDED BRUTALITY */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-red-800 mb-4">Why Everything Else Sucks (And You Know It)</h2>
          <p className="text-red-700 text-sm mb-6 text-center italic">Let&apos;s be honest about why you&apos;re still financially stressed despite trying everything...</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left text-sm">
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">📊 Tiller - &quot;Excel Hell&quot;</h3>
              <p className="text-red-600 mb-2">Who wants to deal with spreadsheets? It&apos;s 2025, not 1995.</p>
              <p className="text-red-500 text-xs">• Requires Excel expertise most people don&apos;t have<br/>• Hours of setup for basic functionality<br/>• One wrong formula breaks everything<br/>• Your data gets corrupted, you&apos;re screwed</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">🏦 Mint - &quot;Dead & Buried&quot;</h3>
              <p className="text-red-600 mb-2">Intuit killed it. RIP. Hope you didn&apos;t get too attached.</p>
              <p className="text-red-500 text-xs">• Millions of users left homeless overnight<br/>• Years of financial data just... gone<br/>• &quot;Use Credit Karma instead&quot; - seriously?<br/>• Proof that free isn&apos;t really free</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">🚀 Rocket Money - &quot;Space Cadet Pricing&quot;</h3>
              <p className="text-red-600 mb-2">Don&apos;t fund their executive space explorations with your $12/month.</p>
              <p className="text-red-500 text-xs">• $144/year to cancel subscriptions manually<br/>• Features you can do yourself in 5 minutes<br/>• Aggressive upselling at every turn<br/>• More expensive than most subscriptions you&apos;re trying to cancel</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">📝 YNAB - &quot;Budget Bootcamp&quot;</h3>
              <p className="text-red-600 mb-2">Eff budgets! Life&apos;s too short for that kind of micromanagement.</p>
              <p className="text-red-500 text-xs">• 40-hour learning curve just to get started<br/>• Requires religious daily maintenance<br/>• Miss one day, everything falls apart<br/>• Makes you feel guilty about buying coffee</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">👑 Monarch Money - &quot;Reddit Ad Kings&quot;</h3>
              <p className="text-red-600 mb-2">They&apos;ll use your money to buy more Reddit ads. How meta.</p>
              <p className="text-red-500 text-xs">• Everywhere you look, another Monarch ad<br/>• $99/year for features that barely work<br/>• Connection issues with every bank update<br/>• More time marketing than building</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">📱 Banking Apps - &quot;App Juggling Circus&quot;</h3>
              <p className="text-red-600 mb-2">Good luck remembering to check 47 different apps every day.</p>
              <p className="text-red-500 text-xs">• Every bank has their own terrible app<br/>• Credit cards in different apps<br/>• Savings accounts somewhere else<br/>• By the time you check them all, you&apos;ve forgotten what you learned</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">💳 Credit Card Apps - &quot;Notification Hell&quot;</h3>
              <p className="text-red-600 mb-2">Spam notifications for every $3 coffee purchase.</p>
              <p className="text-red-500 text-xs">• 47 notifications per day about nothing<br/>• Important stuff gets buried<br/>• Turn off notifications, miss important alerts<br/>• Each bank formats data differently</p>
            </div>
            
            <div className="border-l-4 border-red-400 pl-4">
              <h3 className="font-semibold text-red-700 mb-2">🔔 Financial &quot;Gurus&quot; - &quot;Podcast Warriors&quot;</h3>
              <p className="text-red-600 mb-2">&quot;Just track everything manually!&quot; Easy for you to say, Dave.</p>
              <p className="text-red-500 text-xs">• Advice from people with assistants<br/>• &quot;Just budget&quot; isn&apos;t helpful<br/>• Shame-based financial advice<br/>• Solutions that work if you have infinite time</p>
            </div>
          </div>
          
          <div className="mt-8 text-center bg-red-100 border border-red-300 rounded-lg p-4">
            <p className="text-red-800 font-bold text-lg mb-2">The Pattern Is Clear</p>
            <p className="text-red-700 text-sm">Everything requires too much work, costs too much money, or just doesn&apos;t work. You&apos;ve tried them all. They all suck.</p>
            <p className="text-red-800 text-sm font-semibold mt-2">You don&apos;t need another app. You need something that actually fits your life.</p>
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
