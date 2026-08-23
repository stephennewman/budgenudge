import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";
import SampleSMSSection from "@/components/sample-sms-section";

export const metadata: Metadata = {
  title: "Stay on Top of Your Money Without All the Legwork | Krezzo",
  description: "Krezzo texts you useful updates about your money so you can make better decisions. No apps, no spreadsheets, no nonsense. Get daily financial awareness that actually works.",
  keywords: "personal finance, money texts, financial insights, spending alerts, budget tracking, financial awareness",
};

const textTypes = [
  {
    icon: "🌅",
    title: "Morning Snapshot",
    description: "Start the day knowing what bills are coming for the rest of the month and what was just paid.",
  },
  {
    icon: "💳",
    title: "Bills & Payments",
    description: "Upcoming recurring bills with totals for the next 7, 14, and 30 days. No more surprise charges.",
  },
  {
    icon: "🏪",
    title: "Merchant Pacing",
    description: "Track spending at your frequent merchants and get flagged when you're pacing over your usual.",
  },
  {
    icon: "🗂️",
    title: "Category Pacing",
    description: "Same idea for categories — see if groceries or restaurants are running hot before the month gets away from you.",
  },
  {
    icon: "🛤️",
    title: "Cash Flow Runway",
    description: "A forecast to your next paycheck: bills due before then, projected spend, and whether you're on track.",
  },
  {
    icon: "📅",
    title: "Weekly Summary",
    description: "Every Sunday morning: total spent, top categories and merchants, and a daily breakdown of the week.",
  },
  {
    icon: "🗓️",
    title: "Monthly Recap",
    description: "On the 1st of each month: full month totals, top categories, weekly breakdown, and how you compared to last month.",
  },
  {
    icon: "💬",
    title: "Two-Way Texting",
    description: "The texts aren't one-way. Reply STOP to pause instantly, HELP for commands, or ask a question and get a helpful response.",
  },
];

const platformFeatures = [
  {
    icon: "🔍",
    title: "Automatic Bill Detection",
    description: "AI identifies your recurring bills, subscriptions, and payment patterns from transaction history — no manual entry",
    accent: "blue",
  },
  {
    icon: "🏷️",
    title: "AI Merchant & Category Tagging",
    description: "New transactions are automatically categorized and tagged every 15 minutes, consistently across accounts",
    accent: "purple",
  },
  {
    icon: "📊",
    title: "Spending Pace Tracking",
    description: "Pick the merchants and categories you care about and monitor month-to-date spend against your averages",
    accent: "orange",
  },
  {
    icon: "💰",
    title: "Income & Paycheck Tracking",
    description: "Krezzo learns your income cycles so runway forecasts and daily spend limits are anchored to real paydays",
    accent: "yellow",
  },
  {
    icon: "📈",
    title: "Trends & Behavioral Insights",
    description: "See how your spending moves over time and spot the patterns behind it",
    accent: "red",
  },
  {
    icon: "🔗",
    title: "Secure Bank Connections",
    description: "Read-only account syncing through Plaid — the same connection your bank uses",
    accent: "indigo",
  },
  {
    icon: "🔎",
    title: "Smart Search & Filtering",
    description: "Find any transaction instantly — filter and sort your full history by merchant, category, amount, or date",
    accent: "pink",
  },
  {
    icon: "📱",
    title: "Customizable Text Preferences",
    description: "Preview every text type with your real data and subscribe only to the ones you want",
    accent: "emerald",
  },
];

const accentClasses: Record<string, { border: string; bg: string; hoverBg: string }> = {
  blue: { border: "hover:border-blue-300", bg: "bg-blue-100", hoverBg: "group-hover:bg-blue-200" },
  purple: { border: "hover:border-purple-300", bg: "bg-purple-100", hoverBg: "group-hover:bg-purple-200" },
  orange: { border: "hover:border-orange-300", bg: "bg-orange-100", hoverBg: "group-hover:bg-orange-200" },
  yellow: { border: "hover:border-yellow-300", bg: "bg-yellow-100", hoverBg: "group-hover:bg-yellow-200" },
  red: { border: "hover:border-red-300", bg: "bg-red-100", hoverBg: "group-hover:bg-red-200" },
  indigo: { border: "hover:border-indigo-300", bg: "bg-indigo-100", hoverBg: "group-hover:bg-indigo-200" },
  pink: { border: "hover:border-pink-300", bg: "bg-pink-100", hoverBg: "group-hover:bg-pink-200" },
  emerald: { border: "hover:border-emerald-300", bg: "bg-emerald-100", hoverBg: "group-hover:bg-emerald-200" },
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
            One text a day tells you what you spent, what bills are coming, and what you can safely spend until your next paycheck. No apps. No spreadsheets. No nonsense.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button asChild size="lg" className="text-xl px-12 py-6 h-auto font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 1.5: SAMPLE TEXT - SHOW THE PRODUCT */}
      <SampleSMSSection />

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
              <p className="text-gray-300 mb-4">Who wants to maintain a spreadsheet just to know where their money went?</p>
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

      {/* SECTION 5: INTRODUCE SOLUTION - MEET KREZZO */}
      <section className="bg-gradient-to-br from-purple-400 via-pink-400 to-blue-500 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Meet {BRAND_NAME}</h2>
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

      {/* SECTION 6: HOW DOES KREZZO WORK? */}
      <section className="bg-blue-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-blue-800 mb-6">How Does {BRAND_NAME} Work?</h2>
            <p className="text-xl text-blue-700">Simple, automated, and powerful</p>
          </div>

          {/* Money Assistant Image */}
          <div className="mb-12 text-center">
            <Image
              src="/assets/pictures/krezzo_money_assistant.png"
              alt="Krezzo money assistant showing how the AI analyzes your financial data"
              width={800}
              height={600}
              className="rounded-xl mx-auto"
              priority
            />
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

      {/* SECTION 7: THE TEXTS - WHAT YOU ACTUALLY GET */}
      <section className="bg-green-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-green-800 mb-6">The texts you actually get</h2>
            <p className="text-xl text-green-700">One flagship daily report, plus eight more you can turn on. Preview each with your real data, subscribe only to what you want.</p>
          </div>

          {/* Flagship: Daily Report */}
          <div className="bg-white border-2 border-green-300 rounded-2xl p-8 sm:p-10 mb-12 max-w-4xl mx-auto shadow-lg">
            <div className="flex items-start gap-5">
              <span className="text-4xl mt-1">📊</span>
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h3 className="text-2xl font-bold text-green-900">The Daily Report</h3>
                  <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">Every day at 5 PM ET</span>
                </div>
                <p className="text-green-800 text-lg leading-relaxed mb-4">
                  One text that answers the question you actually have: <strong>&quot;Am I okay? Can I spend today?&quot;</strong>
                </p>
                <ul className="text-green-700 text-lg space-y-2">
                  <li>• Yesterday&apos;s transactions and your current balance</li>
                  <li>• Spending pace on the merchants and categories you track</li>
                  <li>• A daily spend limit computed from your real payday and the bills due before it</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {textTypes.map((t) => (
              <div key={t.title} className="flex items-start gap-4">
                <span className="text-green-600 mt-2 text-2xl">{t.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-2">{t.title}</h3>
                  <p className="text-green-700">{t.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: PLATFORM FEATURES - SHOW DEPTH */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">Powerful platform under the hood</h2>
            <p className="text-xl text-gray-600">The texts are simple because the dashboard behind them does the heavy lifting</p>
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
            {platformFeatures.map((f) => {
              const accent = accentClasses[f.accent];
              return (
                <div key={f.title} className={`group bg-white border-2 border-gray-100 rounded-2xl p-6 ${accent.border} hover:shadow-lg transition-all duration-300 hover:scale-105`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${accent.bg} rounded-full flex items-center justify-center ${accent.hoverBg} transition-colors flex-shrink-0`}>
                      <span className="text-2xl">{f.icon}</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800 mb-2">{f.title}</h4>
                      <p className="text-gray-600">{f.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* SECTION 9: HOW TO GET STARTED */}
      <section className="bg-white py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left Column - Content */}
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl sm:text-5xl font-bold mb-6">How to get started</h2>
                <p className="text-xl text-gray-600 mb-8">Just a few steps and you&apos;re in.</p>
              </div>

              {/* Steps - Stacked Vertically */}
              <div className="space-y-8">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">1</div>
                  <div>
                    <h3 className="text-2xl font-bold mb-3">
                      <Link href="/sign-up" className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 underline">
                        Sign up for free to create your account
                      </Link>
                    </h3>
                    <p className="text-gray-600 text-lg">Takes 2 seconds. We&apos;re not going to ask you a million questions.</p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">2</div>
                  <div>
                    <h3 className="text-2xl font-bold mb-3">Connect your bank</h3>
                    <p className="text-gray-600 text-lg">Via secure Plaid integration. Same thing your bank uses.</p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">3</div>
                  <div>
                    <h3 className="text-2xl font-bold mb-3">Start receiving texts!</h3>
                    <p className="text-gray-600 text-lg">Adjust as you wish... what you spent, what&apos;s coming, and more. Done.</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-4">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-semibold text-lg rounded-xl transition-all duration-200"
                >
                  Get Started Now
                </Link>
              </div>
            </div>

            {/* Right Column - Image */}
            <div className="lg:pl-8">
              <Image
                src="/assets/pictures/krezzo_alerts-min.png"
                alt="Krezzo alerts and notifications showing financial insights on mobile device"
                width={600}
                height={700}
                className="rounded-2xl shadow-lg w-full h-auto"
                priority
              />
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <section className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">Stop flying blind with your money</h2>
          <p className="text-2xl text-white/90 mb-12 max-w-4xl mx-auto">
            Start getting daily financial awareness that actually works. No apps, no spreadsheets, no BS.
          </p>

          <Button asChild size="lg" className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-12 py-4 text-xl rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </div>
      </section>

      {/* SECTION 11: FAQ - ADDRESS OBJECTIONS */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Common Questions
            </h2>
            <p className="text-xl text-gray-700">Everything you need to know about {BRAND_NAME}</p>
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
                  You choose. The core daily report goes out at 5 PM Eastern, with optional morning, weekly, and monthly texts on top. Every text type can be previewed and toggled individually — subscribe to one or all nine. No spam, no random alerts.
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
                  Yes, cancel anytime with one click — or just text STOP to pause the texts instantly. No contracts, no hidden fees, no hassle. We want you to love it, but if you don&apos;t, we&apos;ll make it easy to leave. Your data is deleted when you cancel.
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
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  Can I ask questions about my spending?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  The texts are two-way. Quick commands work instantly — STOP to pause, START to resume, HELP for options. You can also reply with questions and get a helpful response that points you to the right place in your dashboard. Your detailed numbers live there.
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
                  Because you see yesterday&apos;s transactions every day, unknown charges surface immediately instead of weeks later on a statement. Early detection can save you hundreds in fraudulent charges.
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
                  <span className="text-2xl">⚙️</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 leading-tight">
                  Do I have to take all nine text types?
                </h3>
              </div>
                <p className="text-gray-600 leading-relaxed">
                  No — every text type is opt-in. From your dashboard you can preview each one with your own real data, then subscribe to only the ones you find useful. Change your mix anytime.
                </p>
              </div>
          </div>


        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Start taking control of your money
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Get daily financial insights that actually work.
            No apps, no spreadsheets, no BS.
          </p>
          <Button asChild size="lg" className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
            <Link href="/sign-up">Sign Up Today</Link>
            </Button>
          <p className="text-white/80 text-sm mt-4">
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
              <span className="text-xl font-bold text-white">{BRAND_NAME}</span>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400">Financial awareness made simple</span>
            </div>
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
