import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SampleBlogPost() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header */}
      <div className="relative h-[70vh] min-h-[500px] overflow-hidden">
        {/* Hero Image */}
        <Image
          src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80"
          alt="Financial planning and money management"
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
              <span className="inline-block rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold">
                Money Management
              </span>
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
              The Psychology of Spending: Why We Make Bad Money Decisions
            </h1>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed text-gray-200">
              Understanding the hidden forces that drive our spending habits and how to overcome them for better financial health.
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
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
              alt="Author"
              width={60}
              height={60}
              className="rounded-full object-cover"
            />
            <div>
              <p className="font-semibold text-gray-900">By Sarah Johnson</p>
              <p className="text-sm text-gray-600">Financial Psychology Expert</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Published on</p>
            <p className="font-semibold text-gray-900">December 15, 2024</p>
          </div>
        </div>

        {/* Article Body */}
        <article className="prose prose-lg max-w-none">
          <p className="text-xl leading-relaxed text-gray-700">
            We&apos;ve all been there. You walk into a store with a clear budget in mind, 
            only to walk out with items you never intended to buy. Or you make an 
            impulse purchase online that seemed like a great deal at the time, but 
            now sits unused in your closet.
          </p>

          <p className="text-xl leading-relaxed text-gray-700">
            These aren&apos;t just random mistakes—they&apos;re the result of complex 
            psychological factors that influence our spending decisions every day. 
            Understanding these forces is the first step toward making better 
            financial choices.
          </p>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            The Anchoring Effect: Why That &quot;Sale&quot; Price Seems So Good
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            Retailers are masters at using the anchoring effect. They show you an 
            inflated original price next to the sale price, making the discount 
            appear much more significant than it actually is. Your brain anchors 
            to that higher number, making the sale price seem like an incredible deal.
          </p>

          <div className="my-8 rounded-2xl bg-gray-50 p-8">
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              💡 Pro Tip: The Krezzo Solution
            </h3>
            <p className="text-gray-700">
              Our daily spending alerts help you see the real impact of your 
              purchases by showing you exactly where your money went yesterday. 
              This awareness breaks the anchoring effect by giving you concrete 
              data about your actual spending patterns.
            </p>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            The Pain of Paying: Why We Prefer Credit Cards
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            Research shows that paying with cash feels more painful than using 
            credit cards. When you hand over physical money, your brain registers 
            the loss immediately. Credit cards create a psychological buffer, 
            making purchases feel less real and easier to justify.
          </p>

          <p className="text-xl leading-relaxed text-gray-700">
            This is why many people find themselves spending more when they use 
            cards instead of cash. The pain of paying is delayed, but the 
            consequences are very real.
          </p>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            Social Comparison: Keeping Up With the Joneses
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            Social media has amplified our natural tendency to compare ourselves 
            to others. We see friends on vacation, colleagues with new cars, and 
            influencers with designer clothes. This creates a powerful urge to 
            match their lifestyle, even if it means spending beyond our means.
          </p>

          <div className="my-8 rounded-2xl bg-blue-50 p-8">
            <h3 className="mb-4 text-xl font-bold text-blue-900">
              🎯 Key Insight
            </h3>
            <p className="text-blue-800">
              Remember: Social media shows curated highlights, not financial reality. 
              Most people don&apos;t post about their debt, financial stress, or 
              the sacrifices they make to maintain their lifestyle.
            </p>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            How to Overcome These Psychological Traps
          </h2>

          <div className="my-8 space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Use the 24-Hour Rule</h4>
                <p className="text-gray-700">Wait 24 hours before making any purchase over $100. This breaks the impulse cycle.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Track Your Spending</h4>
                <p className="text-gray-700">Use tools like Krezzo to see exactly where your money goes each day.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Set Clear Goals</h4>
                <p className="text-gray-700">Define what financial success means to you, not what it means to others.</p>
              </div>
            </div>
          </div>

          <h2 className="mt-12 mb-6 text-3xl font-bold text-gray-900">
            The Power of Awareness
          </h2>

          <p className="text-xl leading-relaxed text-gray-700">
            The most powerful tool in overcoming bad spending habits is awareness. 
            When you understand the psychological forces at play, you can make 
            more conscious decisions about your money.
          </p>

          <p className="text-xl leading-relaxed text-gray-700">
            That&apos;s exactly why we built Krezzo. By providing daily insights 
            into your spending patterns, we help you develop the awareness needed 
            to make better financial decisions. It&apos;s not about restriction—it&apos;s 
            about making informed choices that align with your true financial goals.
          </p>
        </article>

        {/* Call to Action */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center text-white">
          <h3 className="mb-4 text-2xl font-bold">
            Ready to Take Control of Your Spending?
          </h3>
          <p className="mb-6 text-lg text-blue-100">
            Start getting daily insights into your spending patterns with Krezzo.
          </p>
          <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
            <Link href="/sign-up">Get Started Free</Link>
          </Button>
        </div>

        {/* Author Bio */}
        <div className="mt-16 rounded-2xl bg-gray-50 p-8">
          <div className="flex items-start space-x-6">
            <Image
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
              alt="Sarah Johnson"
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
            <div>
              <h4 className="text-xl font-bold text-gray-900">About Sarah Johnson</h4>
              <p className="mt-2 text-gray-700">
                Sarah is a financial psychology expert with over 10 years of experience 
                helping people understand and improve their relationship with money. 
                She holds a Master&apos;s degree in Behavioral Economics and has worked 
                with thousands of clients to develop healthier spending habits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 