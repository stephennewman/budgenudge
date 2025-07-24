import { Button } from "@/components/ui/button";
import Link from "next/link";
import HomepageSlickTextForm from "@/components/homepage-slicktext-form";

export default function Home() {
  return (
    <div className="flex flex-col">
      
      {/* SECTION 1: HERO - DIRECT PAIN */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold !leading-tight mb-8">
            Stop wondering where your money went.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Get a daily text at 7 AM with exactly what you spent yesterday and what bills are coming up. No apps. No spreadsheets. No bullshit.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button asChild size="lg" className="text-xl px-12 py-6 h-auto font-bold">
              <Link href="/sign-up">Start Getting Daily Texts - $20</Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="text-xl px-12 py-6 h-auto font-bold border-2">
              <Link href="/sign-in">I&apos;m Already Smart</Link>
            </Button>
          </div>

          <p className="text-lg font-semibold text-muted-foreground">
            Finally, financial awareness that actually fits into your life.
          </p>
        </div>
      </section>

      {/* SECTION 2: FINANCIAL PAIN POINTS */}
      <section className="bg-red-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-red-800 mb-6">Sound Familiar?</h2>
            <p className="text-xl text-red-700">If you&apos;ve ever felt any of this, you&apos;re not alone...</p>
          </div>
          
          <div className="bg-white border-2 border-red-300 rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">💸</span>
                <span className="text-red-700 text-lg">Check your bank account and wonder &quot;WTF happened to my money?&quot;</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">😰</span>
                <span className="text-red-700 text-lg">Get hit with surprise bills when you&apos;re already broke</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">🤯</span>
                <span className="text-red-700 text-lg">Open 5 different banking apps just to see what&apos;s happening</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">📱</span>
                <span className="text-red-700 text-lg">Download budgeting apps that you forget to use after 3 days</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">📊</span>
                <span className="text-red-700 text-lg">Stare at overwhelming spreadsheets that make you want to cry</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">🔥</span>
                <span className="text-red-700 text-lg">Live in constant low-level financial anxiety</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">💳</span>
                <span className="text-red-700 text-lg">Death by a thousand subscriptions you forgot about</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">🤦</span>
                <span className="text-red-700 text-lg">Feel like an idiot for not being &quot;good with money&quot;</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">⏰</span>
                <span className="text-red-700 text-lg">Spend hours trying to figure out where you stand financially</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">😩</span>
                <span className="text-red-700 text-lg">Make financial decisions based on guesswork and hope</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">🎢</span>
                <span className="text-red-700 text-lg">Ride the emotional rollercoaster of financial surprises</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">🤷</span>
                <span className="text-red-700 text-lg">Live paycheck to paycheck not by choice, but by ignorance</span>
              </div>
            </div>
            
            <div className="mt-10 text-center bg-red-100 border border-red-300 rounded-xl p-8">
              <p className="text-red-800 font-bold text-2xl mb-4">This is exhausting. And it&apos;s not your fault.</p>
              <p className="text-red-700 text-xl">The tools available are garbage. The system is broken. You need something that actually works.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: COMPETITOR DESTRUCTION */}
      <section className="bg-gray-900 text-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Why Everything Else Sucks (And You Know It)</h2>
            <p className="text-xl text-gray-300 italic">Let&apos;s be honest about why you&apos;re still financially stressed despite trying everything...</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📊 Tiller - &quot;Excel Hell&quot;</h3>
              <p className="text-gray-300 mb-4">Who wants to deal with spreadsheets? It&apos;s 2025, not 1995.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Requires Excel expertise most people don&apos;t have</li>
                <li>• Hours of setup for basic functionality</li>
                <li>• One wrong formula breaks everything</li>
                <li>• Your data gets corrupted, you&apos;re screwed</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">🏦 Mint - &quot;Dead &amp; Buried&quot;</h3>
              <p className="text-gray-300 mb-4">Intuit killed it. RIP. Hope you didn&apos;t get too attached.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Millions of users left homeless overnight</li>
                <li>• Years of financial data just... gone</li>
                <li>• &quot;Use Credit Karma instead&quot; - seriously?</li>
                <li>• Proof that free isn&apos;t really free</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">🚀 Rocket Money - &quot;Space Cadet Pricing&quot;</h3>
              <p className="text-gray-300 mb-4">Don&apos;t fund their executive space explorations with your $12/month.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• $144/year to cancel subscriptions manually</li>
                <li>• Features you can do yourself in 5 minutes</li>
                <li>• Aggressive upselling at every turn</li>
                <li>• More expensive than most subscriptions you&apos;re trying to cancel</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📝 YNAB - &quot;Budget Bootcamp&quot;</h3>
              <p className="text-gray-300 mb-4">Eff budgets! Life&apos;s too short for that kind of micromanagement.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• 40-hour learning curve just to get started</li>
                <li>• Requires religious daily maintenance</li>
                <li>• Miss one day, everything falls apart</li>
                <li>• Makes you feel guilty about buying coffee</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">👑 Monarch Money - &quot;Reddit Ad Kings&quot;</h3>
              <p className="text-gray-300 mb-4">They&apos;ll use your money to buy more Reddit ads. How meta.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Everywhere you look, another Monarch ad</li>
                <li>• $99/year for features that barely work</li>
                <li>• Connection issues with every bank update</li>
                <li>• More time marketing than building</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📱 Banking Apps - &quot;App Juggling Circus&quot;</h3>
              <p className="text-gray-300 mb-4">Good luck remembering to check 47 different apps every day.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Every bank has their own terrible app</li>
                <li>• Credit cards in different apps</li>
                <li>• Savings accounts somewhere else</li>
                <li>• By the time you check them all, you&apos;ve forgotten what you learned</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 text-center bg-red-900 border-2 border-red-500 rounded-2xl p-10">
            <p className="text-white font-bold text-3xl mb-6">The Pattern Is Clear</p>
            <p className="text-red-200 text-xl mb-6">Everything requires too much work, costs too much money, or just doesn&apos;t work. You&apos;ve tried them all. They all suck.</p>
            <p className="text-white text-xl font-bold">You don&apos;t need another app. You need something that actually fits your life.</p>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE SOLUTION */}
      <section className="bg-blue-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-blue-800 mb-8">Meet Krezzo</h2>
          <p className="text-2xl text-blue-700 mb-10">Finally, financial awareness that actually fits into your life.</p>
          
          <div className="bg-white border-2 border-blue-300 rounded-2xl p-8 sm:p-12">
            <p className="text-xl mb-8">
              One daily text message at 7 AM. That&apos;s it. No apps to check, no spreadsheets to maintain, no complex budgets to follow.
            </p>
            <p className="text-xl font-bold text-blue-800">
              Just the financial awareness you&apos;ve been missing, delivered when you need it most.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5: HOW IT WORKS */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">How It Works (It&apos;s Stupid Simple)</h2>
            <p className="text-xl text-gray-600">Three steps. That&apos;s literally it.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">1</div>
              <h3 className="text-2xl font-bold mb-4">Sign up</h3>
              <p className="text-gray-600 text-lg">Takes 2 minutes. We&apos;re not going to spam you with a million questions.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">2</div>
              <h3 className="text-2xl font-bold mb-4">Connect your bank</h3>
              <p className="text-gray-600 text-lg">Secure Plaid integration. Same thing your bank uses. We can&apos;t touch your money.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">3</div>
              <h3 className="text-2xl font-bold mb-4">Get daily texts</h3>
              <p className="text-gray-600 text-lg">Every morning at 7 AM. What you spent. What&apos;s coming up. Done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: WHAT YOU ACTUALLY GET */}
      <section className="bg-green-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-green-800 mb-6">What You Actually Get</h2>
            <p className="text-xl text-green-700">No fluff, no filler. Just what matters.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div className="flex items-start gap-6">
              <span className="text-green-600 mt-2 text-3xl">✅</span>
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-3">Yesterday&apos;s spending breakdown</h3>
                <p className="text-green-700 text-lg">See exactly where your money went without opening an app</p>
              </div>
            </div>
            
            <div className="flex items-start gap-6">
              <span className="text-green-600 mt-2 text-3xl">✅</span>
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-3">Upcoming bill reminders</h3>
                <p className="text-green-700 text-lg">Never get hit with surprise charges again</p>
              </div>
            </div>
            
            <div className="flex items-start gap-6">
              <span className="text-green-600 mt-2 text-3xl">✅</span>
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-3">Spending pattern alerts</h3>
                <p className="text-green-700 text-lg">When you&apos;re blowing through cash faster than usual</p>
              </div>
            </div>
            
            <div className="flex items-start gap-6">
              <span className="text-green-600 mt-2 text-3xl">✅</span>
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-3">Zero effort required</h3>
                <p className="text-green-700 text-lg">Set it and forget it. We do the work, you get smarter</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: SOCIAL PROOF */}
      <section className="bg-gray-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Real Results</h2>
            <p className="text-xl text-gray-600">Numbers don&apos;t lie.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div className="text-center bg-white rounded-2xl p-10 border-2 border-gray-200">
              <div className="text-5xl font-bold text-blue-600 mb-4">$247</div>
              <p className="text-gray-600 text-lg">Average monthly savings when you know where your money goes</p>
            </div>
            
            <div className="text-center bg-white rounded-2xl p-10 border-2 border-gray-200">
              <div className="text-5xl font-bold text-green-600 mb-4">3 min</div>
              <p className="text-gray-600 text-lg">Time it takes to read your daily text and stay informed</p>
            </div>
            
            <div className="text-center bg-white rounded-2xl p-10 border-2 border-gray-200">
              <div className="text-5xl font-bold text-purple-600 mb-4">0</div>
              <p className="text-gray-600 text-lg">Apps you need to remember to check or maintain</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="bg-blue-600 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Stop Flying Blind With Your Money</h2>
          <p className="text-2xl text-blue-100 mb-12 max-w-4xl mx-auto">
            Twenty bucks. One time. Daily financial awareness that actually works. 
            No subscriptions, no upsells, no nonsense.
          </p>
          
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-2xl px-16 py-8 h-auto font-bold mb-8">
            <Link href="/sign-up">Get Financial Awareness - $20</Link>
          </Button>
          
          <p className="text-blue-200 text-lg">
            Bank-level security • No access to your money • Cancel anytime
          </p>
          
          <div className="mt-16">
            <HomepageSlickTextForm />
          </div>
        </div>
      </section>
    </div>
  );
}
