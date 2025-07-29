import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import HomepageSlickTextForm from "@/components/homepage-slicktext-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Money Texts | Daily Financial Alerts | Krezzo",
  description: "Get daily money texts showing exactly what you spent yesterday and what bills are coming up. No apps, no spreadsheets - just simple SMS alerts that keep you financially aware.",
  keywords: "money texts, daily financial alerts, SMS spending alerts, financial awareness, money tracking",
};

export default function Home() {
  return (
    <div className="flex flex-col">
      
      {/* SECTION 1: HERO - DIRECT PAIN */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold !leading-tight mb-8">
            Stop wasting your hard earned money.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Get daily money texts with exactly what you spent yesterday, what bills are coming up, and more. No apps. No spreadsheets. No bullshit.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button asChild size="lg" className="text-xl px-12 py-6 h-auto font-bold">
              <Link href="/sign-up">Sign up</Link>
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
            <h2 className="text-4xl sm:text-5xl font-bold text-red-800 mb-6">Sound familiar?</h2>
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
                <span className="text-red-700 text-lg">Avoid opening your banking app because you&apos;re afraid of what you&apos;ll see</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">📱</span>
                <span className="text-red-700 text-lg">You&apos;ve downloaded budget apps but they don&apos;t help much</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">📊</span>
                <span className="text-red-700 text-lg">Ignore budgeting spreadsheets because they are too complicated</span>
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
                <span className="text-red-700 text-lg">Live paycheck to paycheck and you&apos;re tired of it</span>
              </div>
            </div>
            
            <div className="mt-10 text-center bg-red-100 border border-red-300 rounded-xl p-8">
              <p className="text-red-800 font-bold text-2xl mb-4">This is exhausting. And it&apos;s not your fault.</p>
              <p className="text-red-700 text-xl">The tools available are garbage. The system is broken. You need something that actually works.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: WHY MOST MONEY TRACKING TOOLS DON'T WORK */}
      <section className="bg-gray-900 text-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Why most money tracking tools don&apos;t work</h2>
            <p className="text-xl text-gray-300 italic">Let&apos;s be honest about why you&apos;re still financially stressed despite trying everything...</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📊 Spreadsheets are a headache</h3>
              <p className="text-gray-300 mb-4">Who wants to deal with spreadsheets? It&apos;s 2025, not 1995.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Requires Excel expertise most people don&apos;t have</li>
                <li>• Hours of setup for basic functionality</li>
                <li>• One wrong formula breaks everything</li>
                <li>• Your data gets corrupted, you&apos;re screwed</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">🏦 Finance Apps do too much</h3>
              <p className="text-gray-300 mb-4">They promise the world, deliver complexity, then disappear.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Millions of users left homeless when apps shut down</li>
                <li>• Years of financial data just... gone</li>
                <li>• Aggressive upselling at every turn</li>
                <li>• More expensive than most subscriptions you&apos;re trying to track</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📝 Custom trackers go stale</h3>
              <p className="text-gray-300 mb-4">Eff budgets! Life&apos;s too short for that kind of micromanagement.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• 40-hour learning curve just to get started</li>
                <li>• Requires religious daily maintenance</li>
                <li>• Miss one day, everything falls apart</li>
                <li>• Makes you feel guilty about buying coffee</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">👑 Premium finance tools are overkill</h3>
              <p className="text-gray-300 mb-4">They&apos;ll use your money to buy more ads. How meta.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Everywhere you look, another ad for the same features</li>
                <li>• $99/year for features that barely work</li>
                <li>• Connection issues with every bank update</li>
                <li>• More time marketing than building</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📱 Banking tools user experiences stink</h3>
              <p className="text-gray-300 mb-4">Good luck remembering to check 47 different apps every day.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Every bank has their own terrible app</li>
                <li>• Credit cards in different apps</li>
                <li>• Savings accounts somewhere else</li>
                <li>• By the time you check them all, you&apos;ve forgotten what you learned</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">🤷 Doing nothing causes the same problems</h3>
              <p className="text-gray-300 mb-4">Often the best choice since it&apos;s easier than the alternatives.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• No setup required</li>
                <li>• No monthly fees</li>
                <li>• No learning curve</li>
                <li>• But also no financial awareness</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 text-center bg-red-900 border-2 border-red-500 rounded-2xl p-10">
            <p className="text-white font-bold text-3xl mb-6">The pattern Is clear</p>
            <p className="text-red-200 text-xl mb-6">Everything requires too much work, costs too much money, or just doesn&apos;t work. You&apos;ve tried them all. They all suck.</p>
            <p className="text-white text-xl font-bold">You don&apos;t need another app. You need something that actually fits your life.</p>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE PROMISE LANDS */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-blue-800 mb-6">Imagine a world where you...</h2>
            <p className="text-xl text-blue-700">The financial awareness you&apos;ve always wanted, without the hassle.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-16">
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">🎯</span>
              <span className="text-blue-800 text-lg font-semibold">Know what&apos;s coming and when, and for how much</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">📊</span>
              <span className="text-blue-800 text-lg font-semibold">Understand where your money goes, without apps and spreadsheets</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">🧠</span>
              <span className="text-blue-800 text-lg font-semibold">Learn your own financial behaviors, and feel confident changing them</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">📱</span>
              <span className="text-blue-800 text-lg font-semibold">Constantly in the know about your money</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">🛡️</span>
              <span className="text-blue-800 text-lg font-semibold">Never caught by surprise and get overdraft fees anymore</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">⚡</span>
              <span className="text-blue-800 text-lg font-semibold">Know all this with minimal setup, tracking, tagging, and effort</span>
            </div>
          </div>
          
          <div className="bg-white border-2 border-blue-300 rounded-2xl p-10 text-center">
            <h3 className="text-3xl font-bold text-blue-800 mb-6">Meet Krezzo</h3>
            <p className="text-xl text-blue-700 leading-relaxed mb-8">
              Personalized daily texts about your money, so you can intelligently stay on TOP of your money without the anxiety and effort.
            </p>
            
            {/* Multi-device image showing the solution */}
            <div className="relative max-w-3xl mx-auto">
              <Image
                src="/assets/pictures/krezzo_multi_device_image_min.png"
                alt="Krezzo works across all your devices - phone, tablet, and computer"
                width={800}
                height={500}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: THE SOLUTION */}
      <section className="bg-blue-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-blue-800 mb-8">Finally, financial awareness that works</h2>
          <p className="text-2xl text-blue-700 mb-10">Daily money text messages. That&apos;s it.</p>
          
          <div className="bg-white border-2 border-blue-300 rounded-2xl p-8 sm:p-12">
            <p className="text-xl mb-8">
              No apps to check, no spreadsheets to maintain, no complex budgets to follow.
            </p>
            <p className="text-xl font-bold text-blue-800 mb-8">
              Just the financial awareness you&apos;ve been missing, delivered when you need it most.
            </p>
            
            {/* Personal Finance App Interface */}
            <div className="relative max-w-2xl mx-auto">
              <Image
                src="/assets/pictures/krezzo_alerts-min.png"
                alt="Krezzo alerts showing daily money notifications"
                width={600}
                height={400}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: HOW IT WORKS */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">How it works</h2>
            <p className="text-xl text-gray-600">Just a few steps and you&apos;re in.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-16">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">1</div>
              <h3 className="text-2xl font-bold mb-4">Sign up for free to create your account</h3>
              <p className="text-gray-600 text-lg">Takes 2 seconds. We&apos;re not going to ask you a million questions.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">2</div>
              <h3 className="text-2xl font-bold mb-4">Connect your bank for an instant analysis</h3>
              <p className="text-gray-600 text-lg">Via secure Plaid integration. Same thing your bank uses.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">3</div>
              <h3 className="text-2xl font-bold mb-4">Get useful daily texts about your money</h3>
              <p className="text-gray-600 text-lg">Everyday... what you spent, what&apos;s coming, and more. Done.</p>
            </div>
          </div>
          
          {/* Money Tracker Tool Image */}
          <div className="relative max-w-4xl mx-auto">
            <Image
              src="/assets/pictures/krezzo_money_tracker.png"
              alt="Krezzo money tracking tool showing spending insights and patterns"
              width={800}
              height={500}
              className="rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* SECTION 7: WHAT YOU ACTUALLY GET */}
      <section className="bg-green-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-green-800 mb-6">What you actually get</h2>
            <p className="text-xl text-green-700">No fluff, no filler. Just what matters.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-16">
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
                <h3 className="text-2xl font-bold text-green-800 mb-3">Automated bill awareness</h3>
                <p className="text-green-700 text-lg">Never get hit with surprise charges again</p>
              </div>
            </div>
            
            <div className="flex items-start gap-6">
              <span className="text-green-600 mt-2 text-3xl">✅</span>
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-3">Merchant and spending pattern alerts</h3>
                <p className="text-green-700 text-lg">When you&apos;re blowing through cash faster than usual</p>
              </div>
            </div>
            
            <div className="flex items-start gap-6">
              <span className="text-green-600 mt-2 text-3xl">✅</span>
              <div>
                <h3 className="text-2xl font-bold text-green-800 mb-3">Weekly and monthly summaries</h3>
                <p className="text-green-700 text-lg">Set it and forget it. We do the work, you get smarter</p>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* SECTION 8: PRICING */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Choose your money awareness level</h2>
            <p className="text-xl text-gray-600">Start free, upgrade when you&apos;re ready</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* FREE TIER */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Create an account</h3>
              <div className="text-4xl font-bold text-green-600 mb-6">FREE</div>
              <ul className="text-gray-600 space-y-3 mb-8">
                <li className="flex items-center justify-center gap-2">
                  <span className="text-green-500">✓</span>
                  We&apos;ll send you a sample text
                </li>
              </ul>
              <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </div>

            {/* PINCHING PENNIES */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-8 text-center relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-800 mb-4">Pinching Pennies Package</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">$5</div>
              <div className="text-gray-500 mb-6">a month</div>
              <ul className="text-gray-600 space-y-3 mb-8">
                <li className="flex items-center justify-center gap-2">
                  <span className="text-blue-500">✓</span>
                  Daily snapshot of your finances
                </li>
              </ul>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/sign-up">Start Now</Link>
              </Button>
            </div>

            {/* BOUGIE ON A BUDGET */}
            <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold text-purple-800 mb-4">Bougie on a Budget Package</h3>
              <div className="text-4xl font-bold text-purple-600 mb-2">$8</div>
              <div className="text-gray-500 mb-6">a month</div>
              <ul className="text-gray-600 space-y-3 mb-8">
                <li className="flex items-center justify-center gap-2">
                  <span className="text-purple-500">✓</span>
                  Multiple categories of text updates
                </li>
                <li className="flex items-center justify-center gap-2">
                  <span className="text-purple-500">✓</span>
                  On your schedule
                </li>
              </ul>
              <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </div>

            {/* ALL-IN */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-2xl p-8 text-center">
              <h3 className="text-2xl font-bold text-orange-800 mb-4">All-In Package</h3>
              <div className="text-4xl font-bold text-orange-600 mb-2">$15</div>
              <div className="text-gray-500 mb-6">a month</div>
              <ul className="text-gray-600 space-y-3 mb-8">
                <li className="flex items-center justify-center gap-2">
                  <span className="text-orange-500">✓</span>
                  All the bells and whistles
                </li>
                <li className="flex items-center justify-center gap-2">
                  <span className="text-orange-500">✓</span>
                  And more
                </li>
              </ul>
              <Button asChild className="w-full bg-orange-600 hover:bg-orange-700">
                <Link href="/sign-up">Go All-In</Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 text-lg">
              Cancel anytime • No hidden fees • Bank-level security
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 9: SOCIAL PROOF */}
      <section className="bg-gray-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Real results</h2>
            <p className="text-xl text-gray-600">Numbers don&apos;t lie.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div className="text-center bg-white rounded-2xl p-10 border-2 border-gray-200">
              <div className="text-5xl font-bold text-blue-600 mb-4">12%</div>
              <p className="text-gray-600 text-lg">Average reduction in spending when you know where your money goes</p>
            </div>
            
            <div className="text-center bg-white rounded-2xl p-10 border-2 border-gray-200">
              <div className="text-5xl font-bold text-green-600 mb-4">2 min</div>
              <p className="text-gray-600 text-lg">Time it takes to read your daily text and stay informed, if you read slow</p>
            </div>
            
            <div className="text-center bg-white rounded-2xl p-10 border-2 border-gray-200">
              <div className="text-5xl font-bold text-purple-600 mb-4">0</div>
              <p className="text-gray-600 text-lg">Apps you need to remember to check or maintain</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 12: FINAL CTA */}
      <section className="bg-blue-600 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Stop flying blind with your money</h2>
          <p className="text-2xl text-blue-100 mb-12 max-w-4xl mx-auto">
            Start gettingaily financial awareness that actually works. 
            No apps, no spreadsheets, no nonsense.
          </p>
          
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-2xl px-16 py-8 h-auto font-bold mb-8">
            <Link href="/sign-up">Sign up now</Link>
          </Button>
          
          <p className="text-blue-200 text-lg">
            Bank-level security • No access to your money • Cancel anytime
          </p>
          
          <div className="mt-16">
            <HomepageSlickTextForm />
          </div>
        </div>
      </section>

      {/* SECTION 11: FAQ */}
      <section className="bg-gray-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">FAQs</h2>
            <p className="text-xl text-gray-600">Everything you need to know about Krezzo</p>
          </div>
          
          <div className="space-y-4">
            {/* FAQ Item 1 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">Is this really secure? I&apos;m giving you access to my bank account.</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  Absolutely. We use Plaid, the same secure connection your bank uses. We sync your transactions but can&apos;t touch your money, make transfers, or access your account details. It&apos;s read-only access, just like when you check your balance online.
                </p>
              </div>
            </details>

            {/* FAQ Item 2 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">I don&apos;t want to be spammed with texts all day. How often do you send them?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  We send texts daily with everything you need to know. No spam, no random alerts, no annoying notifications. You can also customize your schedule or pause anytime.
                </p>
              </div>
            </details>

            {/* FAQ Item 3 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">What if I don&apos;t like it? Can I cancel?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  Yes, cancel anytime with one click. No contracts, no hidden fees, no hassle. We want you to love it, but if you don&apos;t, we&apos;ll make it easy to leave. Your data is deleted when you cancel.
                </p>
              </div>
            </details>

            {/* FAQ Item 4 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">My bank isn&apos;t listed. Can I still use this?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  We support over 11,000 banks and credit unions through Plaid. If your bank isn&apos;t supported, we&apos;ll help you find an alternative or work with you to add it. Most major banks, credit unions, and even some international banks are covered.
                </p>
              </div>
            </details>

            {/* FAQ Item 5 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">I already have a budgeting app. Why do I need this?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  Budgeting apps require you to open them, categorize transactions, and maintain spreadsheets. We do the work for you and deliver insights via text. No app to remember, no manual work, no complex interfaces. Just awareness without the effort.
                </p>
              </div>
            </details>

            {/* FAQ Item 6 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">What if I have multiple bank accounts and credit cards?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  Perfect! We will soon be able to connect all your accounts in one place. Your daily text will show spending across all accounts, giving you a complete picture of your finances. No more checking 5 different apps to see where you stand.
                </p>
              </div>
            </details>

            {/* FAQ Item 7 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">I&apos;m not good with money. Will this actually help me?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  That&apos;s exactly why we built this. You don&apos;t need to be &quot;good with money&quot; - you just need awareness. Our texts show you patterns you didn&apos;t see before, like &quot;You spent $200 on coffee this month&quot; or &quot;Your subscription costs are up 30%.&quot; Knowledge is power.
                </p>
              </div>
            </details>

            {/* FAQ Item 8 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">What if I get charged for something I didn&apos;t buy?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  We&apos;ll flag unusual spending patterns and unknown merchants. If you see a charge you don&apos;t recognize, you&apos;ll know immediately instead of finding out weeks later. Early detection can save you hundreds in fraudulent charges.
                </p>
              </div>
            </details>

            {/* FAQ Item 9 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">I&apos;m worried about privacy. What data do you collect?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  We only collect transaction data to send you insights. We don&apos;t sell your data, share it with third parties, or use it for advertising. Your financial information stays private and secure. We&apos;re in the awareness business, not the data business.
                </p>
              </div>
            </details>

            {/* FAQ Item 10 */}
            <details className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <summary className="p-8 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-800 cursor-pointer">What if I want to change my plan or upgrade later?</h3>
                  <svg className="w-6 h-6 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </summary>
              <div className="px-8 pb-8">
                <p className="text-gray-600 leading-relaxed">
                  Easy! You can upgrade, downgrade, or change your plan anytime from your account. No penalties, no waiting periods, no complicated processes. Start with the free sample, then choose the plan that fits your needs.
                </p>
              </div>
            </details>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 text-lg mb-6">
              Still have questions? Sign up for more help.
            </p>
            <Button asChild variant="outline" size="lg" className="border-2">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
