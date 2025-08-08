import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stay on Top of Your Money Without All the Legwork | Krezzo",
  description: "Krezzo texts you useful updates about your money so you can make better decisions. No apps, no spreadsheets, no nonsense. Get daily financial awareness that actually works.",
  keywords: "personal finance, money texts, financial insights, spending alerts, budget tracking, financial awareness",
};

export default function Home() {
  return (
    <div className="flex flex-col">
      
      {/* SECTION 1: HERO - VALUE PROPOSITION */}
      <section className="relative min-h-screen flex items-center justify-center py-20 px-4 sm:px-6 overflow-hidden">
        {/* Background Image */}
        <Image
          src="/assets/pictures/krezzo_hero.jpg"
          alt="Krezzo financial insights background"
          fill
          className="object-cover"
          priority
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/70" />
        
        {/* Content */}
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold !leading-tight mb-8 text-white">
            Stay on top of your money without all the legwork
          </h1>
          
          <p className="text-xl sm:text-2xl text-white/90 mb-10 max-w-4xl mx-auto leading-relaxed">
            Krezzo is a personal finance tool that texts you useful updates about your money, so you can make better decisions. No apps. No spreadsheets. No nonsense.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button asChild size="lg" className="text-xl px-12 py-6 h-auto font-bold bg-white text-gray-900 hover:bg-gray-100">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 2: PAIN POINTS - RELATE TO CUSTOMER */}
      <section className="bg-red-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-red-800 mb-6">Managing your money shouldn&apos;t be frustrating</h2>
            <p className="text-xl text-red-700">If you&apos;ve ever felt any of this, you&apos;re not alone...</p>
          </div>
          
          <div className="bg-white border-2 border-red-300 rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">💸</span>
                <span className="text-red-700 text-lg">Checked your bank account and wonder &quot;WTF happened to my money?&quot;</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">😰</span>
                <span className="text-red-700 text-lg">Got hit with surprise bills you weren&apos;t aware of.</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">🤯</span>
                <span className="text-red-700 text-lg">Avoided opening your banking app because it&apos;s clunky and lacks insights.</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">📱</span>
                <span className="text-red-700 text-lg">You&apos;ve downloaded budget tools but they don&apos;t help much</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">📊</span>
                <span className="text-red-700 text-lg">Ignored spreadsheets because they are too complicated</span>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-red-500 mt-1 text-2xl">😩</span>
                <span className="text-red-700 text-lg">Made financial decisions based on guesswork and hope</span>
              </div>
            </div>
            
          </div>
        </div>
      </section>



      {/* SECTION 3: WHY EXISTING TOOLS FAIL - EDUCATE ON PROBLEMS */}
      <section className="bg-gray-900 text-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
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
                <li>• Lots of setup for basic functionality</li>
                <li>• One wrong formula breaks everything</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">🏦 Finance apps are overkill</h3>
              <p className="text-gray-300 mb-4">They promise the world, deliver complexity, then disappear.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Aggressive upselling at every turn</li>
                <li>• More expensive than most subscriptions you&apos;re trying to track</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 border-l-4 border-red-400 p-8 rounded-r-xl">
              <h3 className="font-bold text-red-400 mb-4 text-xl">📝 Bank tools miss the mark</h3>
              <p className="text-gray-300 mb-4">Siloed data with a lackluster user experience.</p>
              <ul className="text-gray-400 space-y-2">
                <li>• Only track what the bank lets you</li>
                <li>• Difficult to get meaningful insights</li>
                <li>• Dry and bland interfaces</li>
              </ul>
            </div>
          </div>
          
        </div>
      </section>

      {/* SECTION 4: IDEAL FUTURE - PAINT THE VISION */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-blue-800 mb-6">What you really want is to be smart with your money without all the hassle</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-16">
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">💰</span>
              <span className="text-blue-800 text-lg font-semibold">What income is coming, and when</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">📅</span>
              <span className="text-blue-800 text-lg font-semibold">What expenses are coming up, and for how much</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">🏪</span>
              <span className="text-blue-800 text-lg font-semibold">How much you&apos;re spending at frequent merchants</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">📊</span>
              <span className="text-blue-800 text-lg font-semibold">Which categories you&apos;re overspending on</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">📈</span>
              <span className="text-blue-800 text-lg font-semibold">How you&apos;re tracking over time financially</span>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-blue-600 mt-1 text-2xl">⚡</span>
              <span className="text-blue-800 text-lg font-semibold">Know all this with minimal setup, tracking, and effort</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: INTRODUCE SOLUTION - MEET KREZZO */}
      <section className="bg-gradient-to-br from-purple-400 via-pink-400 to-blue-500 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Meet Krezzo</h2>
          <p className="text-2xl text-white/90 mb-10">Your lightweight partner in finance</p>
          
          {/* Platform Image */}
          <div className="mb-12">
            <Image
              src="/assets/pictures/krezzo_multi_device_image_min.png"
              alt="Krezzo platform across multiple devices showing financial insights"
              width={800}
              height={600}
              className="rounded-xl shadow-lg mx-auto"
              priority
            />
          </div>
          

        </div>
      </section>

      {/* SECTION 7: WHAT DOES KREZZO DO? - BEHAVIORAL IMPACT */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-6">What Does Krezzo Do?</h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Simple, personalized, and automated way to better understand what&apos;s going on with your money, 
              so you can make better decisions, stay informed, and unlock the financial freedom you desire.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Better Decisions */}
            <div className="text-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                🧠
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Enables You to Make Better Decisions</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Krezzo gives you clear insights that enable you to choose wisely about spending, 
                saving, and planning for the future—no more financial guesswork.
              </p>
            </div>
            
            {/* Stay Informed */}
            <div className="text-center p-8 bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl">
              <div className="w-20 h-20 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                📱
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Keeps You Informed About Your Money</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Krezzo delivers real-time updates about your money so you&apos;re never caught off guard—
                no apps to check, no spreadsheets to maintain.
              </p>
            </div>
            
            {/* Financial Freedom */}
            <div className="text-center p-8 bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl">
              <div className="w-20 h-20 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                🚀
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Helps You Unlock Financial Freedom</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Krezzo helps you take control of your financial future by building confidence in your money management 
                so you can work toward the life you want.
              </p>
            </div>
          </div>
          
          {/* Bottom Summary */}
          <div className="mt-16 text-center">
            <div className="bg-gray-50 rounded-2xl p-8 max-w-4xl mx-auto">
              <p className="text-xl text-gray-700 leading-relaxed">
                <strong className="text-gray-900">The result?</strong> You become someone who understands their money, 
                makes confident financial choices, and moves closer to their goals — all without the stress, 
                complexity, or time commitment of traditional money management.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: HOW DOES KREZZO WORK? */}
      <section className="bg-blue-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-blue-800 mb-6">How Does Krezzo Work?</h2>
            <p className="text-xl text-blue-700">Simple, automated, and powerful</p>
          </div>
          
          <div className="bg-white border-2 border-blue-300 rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="text-center">
                <div className="text-4xl mb-4">🔗</div>
                <p className="text-lg">1) Securely syncs your transactional data from your bank(s)</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🤖</div>
                <p className="text-lg">2) Intelligently identifies recurring bills, spending patterns, and income cycles</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">📱</div>
                <p className="text-lg">3) Automatically texts you bite-sized insights about your money</p>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-xl p-8">
              <p className="text-xl mb-4">
                No apps to check, no spreadsheets to maintain, no banks to wrangle with.
              </p>
              <p className="text-xl font-bold text-blue-800">
                Just the financial awareness you&apos;ve been missing, delivered in a simple way.
              </p>
            </div>
          </div>
        </div>
      </section>



      {/* SECTION 8: WHAT YOU GET - SPECIFIC BENEFITS */}
      <section className="bg-green-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-green-800 mb-6">What you actually get</h2>
            <p className="text-xl text-green-700">No fluff, no filler. Just what matters.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">📊</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Yesterday&apos;s spending breakdown</h3>
                <p className="text-green-700">See exactly where your money went without opening an app</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">🚨</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Automated bill awareness</h3>
                <p className="text-green-700">Never get hit with surprise charges again</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">🏪</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">High activity merchant spending pacing</h3>
                <p className="text-green-700">When you&apos;re blowing through cash faster than usual</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">🎯</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Track high spend categories</h3>
                <p className="text-green-700">When you&apos;re blowing through cash faster than usual</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">📅</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Weekly summaries</h3>
                <p className="text-green-700">Set it and forget it. We do the work, you get smarter</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">📈</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Monthly recap</h3>
                <p className="text-green-700">Set it and forget it. We do the work, you get smarter</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">🛫</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Daily runway reports</h3>
                <p className="text-green-700">Never get caught off guard again.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">💰</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Smart savings alerts <span className="text-sm font-normal text-green-600 bg-green-200 px-2 py-1 rounded-full">(coming soon)</span></h3>
                <p className="text-green-700">Get notified when you have extra money to save or invest</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <span className="text-green-600 mt-2 text-2xl">🎁</span>
              <div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Deal and cashback opportunities <span className="text-sm font-normal text-green-600 bg-green-200 px-2 py-1 rounded-full">(coming soon)</span></h3>
                <p className="text-green-700">Personalized offers and cashback alerts based on your spending patterns</p>
              </div>
            </div>
          </div>
        </div>
      </section>





      {/* SECTION 9: PLATFORM FEATURES - SHOW DEPTH */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Powerful platform features</h2>
            <p className="text-xl text-gray-600">Everything you need to master your money, delivered via text</p>
          </div>
          
          {/* Platform Image */}
          <div className="mb-16 text-center">
            <Image
              src="/assets/pictures/krezzo_money_texts.png"
              alt="Example of Krezzo money text messages showing spending insights and alerts"
              width={800}
              height={600}
              className="rounded-xl mx-auto"
              priority
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - 5 Features */}
            <div className="space-y-4">
              {/* Feature 1 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Automated Expense Analysis</h4>
                    <p className="text-gray-600">AI-powered detection of recurring bills, subscriptions, and payment patterns</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 2 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-green-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <span className="text-2xl">✂️</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Expense Splitting</h4>
                    <p className="text-gray-600">Split shared expenses and track who owes what with intelligent merchant detection</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 3 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-purple-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <span className="text-2xl">🏷️</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Smart Merchant Tagging</h4>
                    <p className="text-gray-600">Consistent categorization across all your accounts with smart merchant recognition</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 4 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-orange-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Spending Pace Tracking</h4>
                    <p className="text-gray-600">Monitor spending trends and get alerts when you&apos;re ahead of your usual patterns</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 5 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-red-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <span className="text-2xl">📈</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Activity Sorting</h4>
                    <p className="text-gray-600">View your transactions by frequency, amount, or merchant to spot patterns</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column - 5 Features */}
            <div className="space-y-4">
              {/* Feature 6 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Multiple Account Connections</h4>
                    <p className="text-gray-600">Secure bank integration with more connections coming soon</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 7 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-teal-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Secure Authentication</h4>
                    <p className="text-gray-600">Bank-level security with encrypted data and secure access controls</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 8 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-pink-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center group-hover:bg-pink-200 transition-colors">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Smart Search & Filtering</h4>
                    <p className="text-gray-600">Find any transaction instantly with powerful search and filtering</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 9 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-yellow-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Budget Tracking</h4>
                    <p className="text-gray-600">Track your discretionary spending against your monthly budget</p>
                  </div>
                </div>
              </div>
              
              {/* Feature 10 */}
              <div className="group bg-white border-2 border-gray-100 rounded-2xl p-6 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <span className="text-2xl">📅</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">Recurring Bill Detection</h4>
                    <p className="text-gray-600">Automatically identify and track your recurring bills and subscriptions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 9: HOW TO GET STARTED */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">How to get started</h2>
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
              <h3 className="text-2xl font-bold mb-4">Connect your bank</h3>
              <p className="text-gray-600 text-lg">Via secure Plaid integration. Same thing your bank uses.</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">3</div>
              <h3 className="text-2xl font-bold mb-4">Start receiving texts!</h3>
              <p className="text-gray-600 text-lg">Adjust as you wish... what you spent, what&apos;s coming, and more. Done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA WITH SIGNUP FORM */}
      <section className="bg-blue-600 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Stop flying blind with your money</h2>
          <p className="text-2xl text-blue-100 mb-12 max-w-4xl mx-auto">
            Start getting daily financial awareness that actually works. No apps, no spreadsheets, no BS.
          </p>
          
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-12 py-4 text-xl rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </div>
      </section>

      {/* SECTION 10: FAQ - ADDRESS OBJECTIONS */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Common Questions
            </h2>
            <p className="text-xl text-gray-700">Everything you need to know about Krezzo</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* FAQ Card 1 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  Is this really secure? I&apos;m giving you access to my bank account.
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  Absolutely. We use Plaid, the same secure connection your bank uses. We sync your transactions but can&apos;t touch your money, make transfers, or access your account details. It&apos;s read-only access, just like when you check your balance online.
                </p>
              </div>

            {/* FAQ Card 2 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  I don&apos;t want to be spammed with texts all day. How often do you send them?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  We send texts daily with everything you need to know. No spam, no random alerts, no annoying notifications. You can also customize your schedule or pause anytime.
                </p>
              </div>

            {/* FAQ Card 3 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <span className="text-2xl">❌</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  What if I don&apos;t like it? Can I cancel?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  Yes, cancel anytime with one click. No contracts, no hidden fees, no hassle. We want you to love it, but if you don&apos;t, we&apos;ll make it easy to leave. Your data is deleted when you cancel.
                </p>
              </div>

            {/* FAQ Card 4 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <span className="text-2xl">🏦</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  My bank isn&apos;t listed. Can I still use this?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  We support over 11,000 banks and credit unions through Plaid. If your bank isn&apos;t supported, we&apos;ll help you find an alternative or work with you to add it. Most major banks, credit unions, and even some international banks are covered.
                </p>
              </div>

            {/* FAQ Card 5 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  I already have a budgeting app. Why do I need this?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  Budgeting apps require you to open them, categorize transactions, and maintain spreadsheets. We do the work for you and deliver insights via text. No app to remember, no manual work, no complex interfaces. Just awareness without the effort.
                </p>
              </div>

            {/* FAQ Card 6 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  <span className="text-2xl">💳</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  What if I have multiple bank accounts and credit cards?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  Perfect! We will soon be able to connect all your accounts in one place. Your daily text will show spending across all accounts, giving you a complete picture of your finances. No more checking 5 different apps to see where you stand.
                </p>
              </div>

            {/* FAQ Card 7 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
                  <span className="text-2xl">💡</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  I&apos;m not good with money. Will this actually help me?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  That&apos;s exactly why we built this. You don&apos;t need to be &quot;good with money&quot; - you just need awareness. Our texts show you patterns you didn&apos;t see before, like &quot;You spent $200 on coffee this month&quot; or &quot;Your subscription costs are up 30%.&quot; Knowledge is power.
                </p>
              </div>

            {/* FAQ Card 8 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center group-hover:bg-pink-200 transition-colors">
                  <span className="text-2xl">🚨</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  What if I get charged for something I didn&apos;t buy?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  We&apos;ll flag unusual spending patterns and unknown merchants. If you see a charge you don&apos;t recognize, you&apos;ll know immediately instead of finding out weeks later. Early detection can save you hundreds in fraudulent charges.
                </p>
              </div>

            {/* FAQ Card 9 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <span className="text-2xl">🔐</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  I&apos;m worried about privacy. What data do you collect?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  We only collect transaction data to send you insights. We don&apos;t sell your data, share it with third parties, or use it for advertising. Your financial information stays private and secure. We&apos;re in the awareness business, not the data business.
                </p>
              </div>

            {/* FAQ Card 10 */}
            <div className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-gray-100">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  What if I want to change my plan or upgrade later?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  Easy! You can upgrade, downgrade, or change your plan anytime from your account. No penalties, no waiting periods, no complicated processes. Start with the free sample, then choose the plan that fits your needs.
                </p>
              </div>
          </div>


        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Start taking control of your money
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands who are already getting daily financial insights that actually work. 
            No apps, no spreadsheets, no BS.
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
            <Link href="/sign-up">Sign Up Today</Link>
            </Button>
          <p className="text-blue-200 text-sm mt-4">
            Free to start • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">


          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <span className="text-xl font-bold text-white">Krezzo</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">Financial awareness made simple</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2025 Krezzo. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
