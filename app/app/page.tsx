import { Button } from "@/components/ui/button";
import Link from "next/link";
import HomepageSlickTextForm from "@/components/homepage-slicktext-form";

export default function AppHome() {
  return (
    <div className="flex flex-col">
      
      {/* SECTION 1: HERO - NO LOGO, DIRECT PAIN */}
      <section className="bg-white py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold !leading-tight mb-6">
            Stop wondering where your money went.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Get a daily text at 7 AM with exactly what you spent yesterday and what bills are coming up. No apps. No spreadsheets. No bullshit.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 py-4 h-auto">
              <Link href="/sign-up">Try for free (for now)</Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="text-lg px-8 py-4 h-auto">
              <Link href="/sign-in">I&apos;m Already Smart</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 2: FINANCIAL PAIN POINTS */}
      <section className="bg-red-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-red-800 mb-4">Sound Familiar?</h2>
            <p className="text-lg text-red-700">If you&apos;ve ever felt any of this, you&apos;re not alone...</p>
          </div>
          
          <div className="bg-white border-2 border-red-300 rounded-xl p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">💸</span>
                <span className="text-red-700">Check your bank account and wonder &quot;WTF happened to my money?&quot;</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">😰</span>
                <span className="text-red-700">Get hit with surprise bills when you&apos;re already broke</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">🤯</span>
                <span className="text-red-700">Open 5 different banking apps just to see what&apos;s happening</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">📱</span>
                <span className="text-red-700">Download budgeting apps that you forget to use after 3 days</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">📊</span>
                <span className="text-red-700">Stare at overwhelming spreadsheets that make you want to cry</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">🔥</span>
                <span className="text-red-700">Live in constant low-level financial anxiety</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">💳</span>
                <span className="text-red-700">Death by a thousand subscriptions you forgot about</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">🤦</span>
                <span className="text-red-700">Feel like an idiot for not being &quot;good with money&quot;</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">⏰</span>
                <span className="text-red-700">Spend hours trying to figure out where you stand financially</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">😩</span>
                <span className="text-red-700">Make financial decisions based on guesswork and hope</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">🎢</span>
                <span className="text-red-700">Ride the emotional rollercoaster of financial surprises</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-500 mt-1 text-xl">🤷</span>
                <span className="text-red-700">Live paycheck to paycheck not by choice, but by ignorance</span>
              </div>
            </div>
            
            <div className="mt-8 text-center bg-red-100 border border-red-300 rounded-lg p-6">
              <p className="text-red-800 font-bold text-xl mb-2">This is exhausting. And it&apos;s not your fault.</p>
              <p className="text-red-700">The tools available are garbage. The system is broken. You need something that actually works.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: COMPETITOR DESTRUCTION (MOVED HERE) */}
      <section className="bg-red-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-red-800 mb-4">Why Everything Else Sucks (And You Know It)</h2>
            <p className="text-lg text-red-700 italic">Let&apos;s be honest about why you&apos;re still financially stressed despite trying everything...</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border-l-4 border-red-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-red-700 mb-2 text-lg">📊 Tiller - &quot;Excel Hell&quot;</h3>
              <p className="text-red-600 mb-3">Who wants to deal with spreadsheets? It&apos;s 2025, not 1995.</p>
              <ul className="text-red-500 text-sm space-y-1">
                <li>• Requires Excel expertise most people don&apos;t have</li>
                <li>• Hours of setup for basic functionality</li>
                <li>• One wrong formula breaks everything</li>
                <li>• Your data gets corrupted, you&apos;re screwed</li>
              </ul>
            </div>
            
            <div className="bg-white border-l-4 border-red-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-red-700 mb-2 text-lg">🏦 Mint - &quot;Dead & Buried&quot;</h3>
              <p className="text-red-600 mb-3">Intuit killed it. RIP. Hope you didn&apos;t get too attached.</p>
              <ul className="text-red-500 text-sm space-y-1">
                <li>• Millions of users left homeless overnight</li>
                <li>• Years of financial data just... gone</li>
                <li>• &quot;Use Credit Karma instead&quot; - seriously?</li>
                <li>• Proof that free isn&apos;t really free</li>
              </ul>
            </div>
            
            <div className="bg-white border-l-4 border-red-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-red-700 mb-2 text-lg">🚀 Rocket Money - &quot;Space Cadet Pricing&quot;</h3>
              <p className="text-red-600 mb-3">Don&apos;t fund their executive space explorations with your $12/month.</p>
              <ul className="text-red-500 text-sm space-y-1">
                <li>• $144/year to cancel subscriptions manually</li>
                <li>• Features you can do yourself in 5 minutes</li>
                <li>• Aggressive upselling at every turn</li>
                <li>• More expensive than most subscriptions you&apos;re trying to cancel</li>
              </ul>
            </div>
            
            <div className="bg-white border-l-4 border-red-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-red-700 mb-2 text-lg">📝 YNAB - &quot;Budget Bootcamp&quot;</h3>
              <p className="text-red-600 mb-3">Eff budgets! Life&apos;s too short for that kind of micromanagement.</p>
              <ul className="text-red-500 text-sm space-y-1">
                <li>• 40-hour learning curve just to get started</li>
                <li>• Requires religious daily maintenance</li>
                <li>• Miss one day, everything falls apart</li>
                <li>• Makes you feel guilty about buying coffee</li>
              </ul>
            </div>
            
            <div className="bg-white border-l-4 border-red-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-red-700 mb-2 text-lg">👑 Monarch Money - &quot;Reddit Ad Kings&quot;</h3>
              <p className="text-red-600 mb-3">They&apos;ll use your money to buy more Reddit ads. How meta.</p>
              <ul className="text-red-500 text-sm space-y-1">
                <li>• Everywhere you look, another Monarch ad</li>
                <li>• $99/year for features that barely work</li>
                <li>• Connection issues with every bank update</li>
                <li>• More time marketing than building</li>
              </ul>
            </div>
            
            <div className="bg-white border-l-4 border-red-400 p-6 rounded-r-lg">
              <h3 className="font-bold text-red-700 mb-2 text-lg">📱 Banking Apps - &quot;App Juggling Circus&quot;</h3>
              <p className="text-red-600 mb-3">Good luck remembering to check 47 different apps every day.</p>
              <ul className="text-red-500 text-sm space-y-1">
                <li>• Every bank has their own terrible app</li>
                <li>• Credit cards in different apps</li>
                <li>• Savings accounts somewhere else</li>
                <li>• By the time you check them all, you&apos;ve forgotten what you learned</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 text-center bg-red-100 border-2 border-red-300 rounded-xl p-8">
            <p className="text-red-800 font-bold text-2xl mb-4">The Pattern Is Clear</p>
            <p className="text-red-700 text-lg mb-4">Everything requires too much work, costs too much money, or just doesn&apos;t work. You&apos;ve tried them all. They all suck.</p>
            <p className="text-red-800 text-lg font-bold">You don&apos;t need another app. You need something that actually fits your life.</p>
          </div>
        </div>
      </section>

      {/* SECTION 4: IDEAL FUTURE (NO PRODUCT MENTION) */}
      <section className="bg-green-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-green-800 mb-4">Imagine If You Actually Knew</h2>
            <p className="text-lg text-green-700">What if financial awareness was just... automatic?</p>
          </div>
          
          <div className="bg-white border-2 border-green-300 rounded-xl p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">🧠</span>
                <span className="text-green-700">Wake up every morning knowing exactly where you stand financially</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">😌</span>
                <span className="text-green-700">Never get surprised by bills or unexpected charges again</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">🎯</span>
                <span className="text-green-700">Make confident spending decisions because you have the facts</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">😎</span>
                <span className="text-green-700">Be the person who&apos;s &quot;on top of their finances&quot;</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">💪</span>
                <span className="text-green-700">Actually impress your parents with your financial responsibility</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">🚀</span>
                <span className="text-green-700">Stop money from mysteriously disappearing into thin air</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">🛡️</span>
                <span className="text-green-700">Feel secure knowing you&apos;re not missing anything important</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">⚡</span>
                <span className="text-green-700">Get financial insights without any effort or apps to remember</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">🎉</span>
                <span className="text-green-700">Catch spending patterns before they become problems</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 mt-1 text-xl">🧘</span>
                <span className="text-green-700">Experience actual peace of mind about money</span>
              </div>
            </div>
            
            <div className="mt-8 text-center bg-green-100 border border-green-300 rounded-lg p-6">
              <p className="text-green-800 font-bold text-xl mb-2">This isn&apos;t fantasy. This is totally possible.</p>
              <p className="text-green-700">You don&apos;t need to become a financial expert. You just need the right information at the right time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: PRODUCT INTRODUCTION */}
      <section className="bg-blue-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-800 mb-6">Meet Krezzo</h2>
          <p className="text-xl text-blue-700 mb-8">Finally, financial awareness that actually fits into your life.</p>
          
          <div className="bg-white border-2 border-blue-300 rounded-xl p-6 sm:p-8">
            <p className="text-lg mb-6">
              One daily text message at 7 AM. That&apos;s it. No apps to check, no spreadsheets to maintain, no complex budgets to follow.
            </p>
            <p className="text-lg font-semibold text-blue-800">
              Just the financial awareness you&apos;ve been missing, delivered when you need it most.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: HOW IT WORKS */}
      <section className="bg-gray-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works (It&apos;s Stupid Simple)</h2>
            <p className="text-lg text-gray-600">Three steps. That&apos;s literally it.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-3">Sign up</h3>
              <p className="text-gray-600">Takes 2 minutes. We&apos;re not going to spam you with a million questions.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-3">Connect your bank</h3>
              <p className="text-gray-600">Secure Plaid integration. Same thing your bank uses. We can&apos;t touch your money.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-3">Get daily texts</h3>
              <p className="text-gray-600">Every morning at 7 AM. What you spent. What&apos;s coming up. Done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: WHAT YOU ACTUALLY GET */}
      <section className="bg-green-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-green-800 mb-4">What You Actually Get</h2>
            <p className="text-lg text-green-700">No fluff, no filler. Just what matters.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-1 text-2xl">✅</span>
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">Yesterday&apos;s spending breakdown</h3>
                <p className="text-green-700">See exactly where your money went without opening an app</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-1 text-2xl">✅</span>
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">Upcoming bill reminders</h3>
                <p className="text-green-700">Never get hit with surprise charges again</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-1 text-2xl">✅</span>
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">Spending pattern alerts</h3>
                <p className="text-green-700">When you&apos;re blowing through cash faster than usual</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-1 text-2xl">✅</span>
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">Zero effort required</h3>
                <p className="text-green-700">Set it and forget it. We do the work, you get smarter</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: SOCIAL PROOF */}
      <section className="bg-gray-50 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Real Results</h2>
            <p className="text-lg text-gray-600">Numbers don&apos;t lie.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center bg-white rounded-xl p-8 border-2 border-gray-200">
              <div className="text-4xl font-bold text-blue-600 mb-2">$247</div>
              <p className="text-gray-600">Average monthly savings when you know where your money goes</p>
            </div>
            
            <div className="text-center bg-white rounded-xl p-8 border-2 border-gray-200">
              <div className="text-4xl font-bold text-green-600 mb-2">3 min</div>
              <p className="text-gray-600">Time it takes to read your daily text and stay informed</p>
            </div>
            
            <div className="text-center bg-white rounded-xl p-8 border-2 border-gray-200">
              <div className="text-4xl font-bold text-purple-600 mb-2">0</div>
              <p className="text-gray-600">Apps you need to remember to check or maintain</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: FINAL CTA */}
      <section className="bg-blue-600 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Stop Flying Blind With Your Money</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Simple daily financial awareness that actually works. Start free, see if it changes your life.
          </p>
          
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-xl px-12 py-6 h-auto font-bold">
            <Link href="/sign-up">Try for free (for now)</Link>
          </Button>
          
          <p className="text-blue-200 text-sm mt-6">
            Bank-level security • No access to your money • Cancel anytime
          </p>
          
          <div className="mt-12">
            <HomepageSlickTextForm />
          </div>
        </div>
      </section>
    </div>
  );
} 