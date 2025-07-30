import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BillSplittingGuide() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <div className="relative h-[70vh] min-h-[500px] overflow-hidden">
        {/* Hero Image */}
        <Image
          src="https://images.unsplash.com/photo-1554224154-26032cdc-3047?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80"
          alt="Roommates splitting bills and expenses"
          fill
          className="object-cover"
          priority
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Hero Content */}
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="mx-auto max-w-4xl px-4 text-center text-white">
            <div className="mb-6">
              <span className="inline-block rounded-full bg-green-600 px-4 py-2 text-sm font-semibold">
                Krezzo Feature Guide
              </span>
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
              The Ultimate Guide to Splitting Bills with Roommates
            </h1>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed text-gray-200">
              How Krezzo&apos;s intelligent bill splitting feature can save you time, money, and countless awkward conversations.
            </p>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="mx-auto max-w-4xl px-4 py-16">
        {/* Author and Date */}
        <div className="mb-12 flex items-center justify-between border-b border-gray-200 pb-8">
          <div className="flex items-center space-x-4">
            <Image
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
              alt="Author"
              width={60}
              height={60}
              className="rounded-full object-cover"
            />
            <div>
              <p className="font-semibold text-gray-900">By Mike Chen</p>
              <p className="text-sm text-gray-600">Product Manager at Krezzo</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Published on</p>
            <p className="font-semibold text-gray-900">December 18, 2024</p>
          </div>
        </div>

        {/* Article Body */}
        <article className="prose prose-lg max-w-none">
          <p className="text-xl leading-relaxed text-gray-700">
            If you&apos;ve ever lived with roommates, you know the drill: someone pays the rent, 
            another covers utilities, and you spend hours trying to figure out who owes what to whom. 
            It&apos;s a universal pain point that can strain even the best friendships.
          </p>

          <p className="text-xl leading-relaxed text-gray-700">
            That&apos;s exactly why we built Krezzo&apos;s intelligent bill splitting feature. 
            It automatically detects shared expenses and helps you split them fairly, 
            so you can focus on what matters—living your life, not doing accounting.
          </p>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            The Problem: Why Bill Splitting is So Hard
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            Traditional bill splitting involves spreadsheets, Venmo requests, and endless 
            group chats. Here&apos;s what usually happens:
          </p>

          <div className="my-8 space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">The Spreadsheet Nightmare</h4>
                <p className="text-gray-700">Someone creates a Google Sheet that gets updated once a month (if you&apos;re lucky).</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">The Venmo Avalanche</h4>
                <p className="text-gray-700">Multiple payment requests flood your phone, each with cryptic descriptions.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">The Awkward Follow-up</h4>
                <p className="text-gray-700">&quot;Hey, did you get my Venmo request from last week?&quot; becomes a daily conversation.</p>
              </div>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            The Krezzo Solution: Intelligent Bill Splitting
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            Our bill splitting feature works seamlessly in the background, automatically 
            detecting when you&apos;ve made a shared purchase and helping you split it fairly.
          </p>

          <div className="my-8 rounded-2xl bg-green-50 p-8">
            <h3 className="mb-4 text-xl font-bold text-green-900">
              🚀 How It Works
            </h3>
            <div className="space-y-3">
              <p className="text-green-800">
                <strong>1. Automatic Detection:</strong> Krezzo identifies transactions that look like shared expenses 
                (groceries, utilities, rent, etc.)
              </p>
              <p className="text-green-800">
                <strong>2. Smart Suggestions:</strong> We suggest who should split the bill based on your spending patterns
              </p>
              <p className="text-green-800">
                <strong>3. Easy Splitting:</strong> One tap to split the bill and send payment requests to your roommates
              </p>
              <p className="text-green-800">
                <strong>4. Automatic Tracking:</strong> All split expenses are tracked and reconciled automatically
              </p>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            Real-World Example: The Grocery Store Dilemma
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            Let&apos;s say you&apos;re at the grocery store buying food for the week. 
            You spend $120 on groceries that you and your two roommates will share.
          </p>

          <div className="my-8 rounded-2xl bg-blue-50 p-8">
            <h3 className="mb-4 text-xl font-bold text-blue-900">
              📱 What Happens with Krezzo
            </h3>
            <div className="space-y-3">
              <p className="text-blue-800">
                <strong>10:30 AM:</strong> You swipe your card at Whole Foods for $120
              </p>
              <p className="text-blue-800">
                <strong>10:31 AM:</strong> Krezzo detects this as a potential shared expense
              </p>
              <p className="text-blue-800">
                <strong>10:32 AM:</strong> You get a text: &quot;Looks like you bought groceries. Split with Alex and Sam?&quot;
              </p>
              <p className="text-blue-800">
                <strong>10:33 AM:</strong> You tap &quot;Yes&quot; and Krezzo automatically sends $40 payment requests to both roommates
              </p>
              <p className="text-blue-800">
                <strong>10:35 AM:</strong> Both roommates get texts with payment links. Done!
              </p>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            Setting Up Bill Splitting in Krezzo
          </h2>

          <div className="my-8 space-y-6">
            <div className="rounded-2xl border border-gray-200 p-6">
              <h4 className="mb-3 text-lg font-bold text-gray-900">Step 1: Add Your Roommates</h4>
              <p className="text-gray-700">
                In your Krezzo dashboard, go to &quot;Bill Splitting&quot; and add your roommates&apos; 
                phone numbers. They&apos;ll get an invitation to join your household.
              </p>
            </div>
            
            <div className="rounded-2xl border border-gray-200 p-6">
              <h4 className="mb-3 text-lg font-bold text-gray-900">Step 2: Set Split Rules</h4>
              <p className="text-gray-700">
                Choose how you want to split expenses: 50/50, equal shares, or custom percentages. 
                You can set different rules for different types of expenses.
              </p>
            </div>
            
            <div className="rounded-2xl border border-gray-200 p-6">
              <h4 className="mb-3 text-lg font-bold text-gray-900">Step 3: Connect Your Accounts</h4>
              <p className="text-gray-700">
                Each roommate connects their bank account securely via Plaid. 
                Krezzo can then detect and suggest splits automatically.
              </p>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            Pro Tips for Successful Bill Splitting
          </h2>

          <div className="my-8 space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold">
                💡
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Set Clear Expectations</h4>
                <p className="text-gray-700">Decide upfront what expenses will be shared and what won&apos;t. Be specific about groceries, utilities, and household items.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold">
                ⚡
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Use Krezzo&apos;s Auto-Detection</h4>
                <p className="text-gray-700">Let Krezzo suggest splits for you. It gets smarter over time and learns your household&apos;s spending patterns.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold">
                📊
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Review Monthly Reports</h4>
                <p className="text-gray-700">Check your monthly split summary to ensure everything balances out and address any discrepancies early.</p>
              </div>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            Common Scenarios and How Krezzo Handles Them
          </h2>

          <div className="my-8 space-y-6">
            <div className="rounded-2xl bg-gray-50 p-6">
              <h4 className="mb-3 text-lg font-bold text-gray-900">Scenario: Uneven Grocery Shopping</h4>
              <p className="text-gray-700">
                <strong>Problem:</strong> You buy groceries for $80, but your roommate only buys $40 worth.
              </p>
              <p className="text-gray-700">
                <strong>Krezzo Solution:</strong> Set up custom split percentages or use the &quot;whoever shops pays&quot; rule 
                and settle up monthly.
              </p>
            </div>
            
            <div className="rounded-2xl bg-gray-50 p-6">
              <h4 className="mb-3 text-lg font-bold text-gray-900">Scenario: One Person Pays Rent</h4>
              <p className="text-gray-700">
                <strong>Problem:</strong> Only one person&apos;s name is on the lease, but everyone needs to contribute.
              </p>
              <p className="text-gray-700">
                <strong>Krezzo Solution:</strong> Set up a recurring split for rent payments. Krezzo will automatically 
                remind roommates to pay their share each month.
              </p>
            </div>
            
            <div className="rounded-2xl bg-gray-50 p-6">
              <h4 className="mb-3 text-lg font-bold text-gray-900">Scenario: Utilities Fluctuate</h4>
              <p className="text-gray-700">
                <strong>Problem:</strong> Electric bill varies from $60 to $120 depending on the season.
              </p>
              <p className="text-gray-700">
                <strong>Krezzo Solution:</strong> Split the actual amount each month. Krezzo tracks the variations 
                and ensures everyone pays their fair share.
              </p>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            The Results: What Our Users Say
          </h2>

          <div className="my-8 rounded-2xl bg-gradient-to-r from-green-50 to-blue-50 p-8">
            <blockquote className="text-center">
              <p className="mb-4 text-xl italic text-gray-700">
                &quot;Krezzo&apos;s bill splitting feature saved our friendship. No more awkward money conversations!&quot;
              </p>
              <footer className="text-sm text-gray-600">
                — Emma and Jake, roommates for 3 years
              </footer>
            </blockquote>
          </div>

          <p className="text-xl leading-relaxed text-gray-700">
            Since launching our bill splitting feature, we&apos;ve helped thousands of roommates 
            save time and reduce financial stress. The average user saves 3 hours per month 
            on bill management and has 90% fewer money-related arguments.
          </p>
        </article>

        {/* Call to Action */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-green-600 to-blue-600 p-8 text-center text-white">
          <h3 className="mb-4 text-2xl font-bold">
            Ready to End the Bill Splitting Nightmare?
          </h3>
          <p className="mb-6 text-lg text-green-100">
            Join thousands of roommates who are already using Krezzo to split bills effortlessly.
          </p>
          <Button asChild size="lg" className="bg-white text-green-600 hover:bg-gray-100">
            <Link href="/sign-up">Start Splitting Bills Today</Link>
          </Button>
        </div>

        {/* Author Bio */}
        <div className="mt-16 rounded-2xl bg-gray-50 p-8">
          <div className="flex items-start space-x-6">
            <Image
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
              alt="Mike Chen"
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
            <div>
              <h4 className="text-xl font-bold text-gray-900">About Mike Chen</h4>
              <p className="mt-2 text-gray-700">
                Mike is the Product Manager behind Krezzo&apos;s bill splitting feature. 
                After living with roommates for 8 years and dealing with countless 
                spreadsheet nightmares, he made it his mission to solve the bill 
                splitting problem once and for all.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 