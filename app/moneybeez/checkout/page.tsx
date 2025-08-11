"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, Crown, Sparkles, MessageCircle } from "lucide-react";

interface HivePackage {
  id: string;
  name: string;
  price: number;
  description: string;
  bees: string[];
  features: string[];
  popular?: boolean;
  bestValue?: boolean;
}

const hivePackages: Record<string, HivePackage> = {
  core: {
    id: "core",
    name: "The Small Hive",
    price: 1.00,
    description: "Essential financial monitoring with your most important bees",
    bees: ["Yancy (Daily Spending)", "Eddie (Bill Management)"],
    features: [
      "Daily spending insights",
      "Bill payment tracking",
      "Basic performance ratings",
      "SMS notifications"
    ]
  },
  middle: {
    id: "middle",
    name: "The Medium Hive",
    price: 5.00,
    description: "Comprehensive financial guidance with a full team of bees",
    bees: [
      "Yancy (Daily Spending)",
      "Eddie (Bill Management)", 
      "Catrina (Category Analysis)",
      "Iggy (Income Patterns)",
      "Marty (Merchant Insights)",
      "Ashley (Daily Planning)"
    ],
    features: [
      "All Core Hive features",
      "Category spending analysis",
      "Income pattern detection",
      "Merchant optimization",
      "Daily financial planning",
      "Advanced insights & recommendations"
    ],
    popular: true
  },
  full: {
    id: "full",
    name: "The Large Hive",
    price: 15.00,
    description: "Complete financial ecosystem with every bee working for you",
    bees: [
      "Yancy (Daily Spending)",
      "Eddie (Bill Management)",
      "Catrina (Category Analysis)", 
      "Iggy (Income Patterns)",
      "Marty (Merchant Insights)",
      "Ashley (Daily Planning)",
      "Wendy (Weekly Strategy)",
      "Monty (Monthly Mastery)"
    ],
    features: [
      "All Middle Hive features",
      "Weekly financial summaries",
      "Monthly trend analysis",
      "Long-term financial planning",
      "Priority support",
      "Exclusive financial insights"
    ],
    bestValue: true
  }
};

function MoneyBeezCheckoutContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const hiveId = searchParams.get("hive") || "middle";
  const selectedHive = hivePackages[hiveId];

  useEffect(() => {
    if (!selectedHive) {
      // Redirect back to main page if invalid hive
      window.location.href = "/moneybeez";
    }
  }, [selectedHive]);

  if (!selectedHive) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🐝</div>
          <h1 className="text-2xl font-bold mb-4">Invalid Hive Selection</h1>
          <Button onClick={() => window.location.href = "/moneybeez"}>
            Back to Hive Selection
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = selectedHive.price;
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const handleCheckout = async () => {
    setIsLoading(true);
    
    // Simulate checkout process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSuccess(true);
    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto px-6">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold mb-4 text-yellow-400">Welcome to the Hive!</h1>
          <p className="text-xl text-gray-300 mb-8">
            Your {selectedHive.name} is now active and your bees are already working! 
            You&apos;ll receive your first message within the next hour.
          </p>
          
          <div className="bg-gray-800/50 border border-yellow-500/30 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold text-yellow-400 mb-4">What&apos;s Next?</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                <span>Your bees will start analyzing your finances immediately</span>
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                <span>First SMS insights will arrive within 1 hour</span>
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                <span>Check your dashboard for detailed analytics</span>
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                <span>Your subscription will renew automatically</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={() => window.location.href = "/protected"}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 text-lg w-full"
            >
              Go to Dashboard
            </Button>
            <Button 
              onClick={() => window.location.href = "/moneybeez"}
              variant="outline"
              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-black w-full"
            >
              Back to MoneyBeez
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="text-6xl">🐝</div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-yellow-400">Complete Your Hive</h1>
          <p className="text-xl text-gray-300">
            You&apos;re just one step away from joining the MoneyBeez family!
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div>
            <Card className="p-6 bg-gray-800/50 border border-gray-700">
              <h2 className="text-2xl font-bold text-yellow-400 mb-6">Order Summary</h2>
              
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{selectedHive.name}</h3>
                  <span className="text-2xl font-bold text-yellow-400">
                    ${selectedHive.price.toFixed(2)}
                  </span>
                </div>
                
                <p className="text-gray-300 mb-4">{selectedHive.description}</p>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-yellow-400 flex items-center">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Bees Included ({selectedHive.bees.length})
                  </h4>
                  {selectedHive.bees.map((bee, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-300 ml-6">
                      <Check className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
                      <span>{bee}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-yellow-400 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Features
                </h4>
                {selectedHive.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm text-gray-300 ml-6">
                    <Check className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Badges */}
              <div className="flex gap-2 mt-6">
                {selectedHive.popular && (
                  <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                {selectedHive.bestValue && (
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                    <Crown className="w-4 h-4 mr-1" />
                    Best Value
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Checkout Form */}
          <div>
            <Card className="p-6 bg-gray-800/50 border border-gray-700">
              <h2 className="text-2xl font-bold text-yellow-400 mb-6">Pricing Breakdown</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-300">
                  <span>Hive Subscription</span>
                  <span>${selectedHive.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Tax (8%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-600 pt-4">
                  <div className="flex justify-between text-xl font-bold text-yellow-400">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-gray-400 text-right">per month</p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-400 mb-2">What You&apos;ll Get</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• {selectedHive.bees.length} AI bees working 24/7</li>
                  <li>• Daily SMS insights and recommendations</li>
                  <li>• Performance tracking and ratings</li>
                  <li>• Bank-level security and privacy</li>
                  <li>• Cancel anytime, no hidden fees</li>
                </ul>
              </div>

              <Button 
                onClick={handleCheckout}
                disabled={isLoading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 text-lg"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    Complete Purchase
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </div>
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center mt-4">
                By completing this purchase, you agree to our Terms of Service and Privacy Policy.
                Your subscription will automatically renew each month.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MoneyBeezCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🐝</div>
          <h1 className="text-2xl font-bold mb-4">Loading Your Hive...</h1>
          <p className="text-gray-400">Preparing your MoneyBeez checkout experience</p>
        </div>
      </div>
    }>
      <MoneyBeezCheckoutContent />
    </Suspense>
  );
}
