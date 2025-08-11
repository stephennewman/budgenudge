"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, MessageCircle, TrendingUp, Zap, Shield, Crown, Sparkles, Star, Users, Award, Clock } from "lucide-react";

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

const hivePackages: HivePackage[] = [
  {
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
  {
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
  {
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
];

const testimonials = [
  {
    name: "Sarah M.",
    role: "Small Business Owner",
    rating: 5,
    text: "The MoneyBeez have completely transformed how I think about my business finances. Eddie keeps me on top of all my bills, and Yancy's daily insights help me make smarter spending decisions.",
    avatar: "👩‍💼"
  },
  {
    name: "Mike R.",
    role: "Recent Graduate",
    rating: 5,
    text: "As someone who was terrible with money, having these AI bees guide me has been a game-changer. I've saved over $2,000 in just 3 months!",
    avatar: "👨‍🎓"
  },
  {
    name: "Lisa T.",
    role: "Family Manager",
    rating: 5,
    text: "Managing a family budget used to be overwhelming. Now with the full hive, I have complete visibility and control. The weekly summaries from Wendy are my favorite!",
    avatar: "👩‍👧‍👦"
  }
];

export default function MoneyBeezLandingPage() {
  const [selectedHive, setSelectedHive] = useState<string>("middle");
  const [activeSection, setActiveSection] = useState<string>("hero");

  const handleSelectHive = (hiveId: string) => {
    setSelectedHive(hiveId);
  };

  const handleHireHive = () => {
    if (!selectedHive) return;
    // Redirect to checkout with selected hive
    window.location.href = `/moneybeez/checkout?hive=${selectedHive}`;
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const selectedHiveData = hivePackages.find(hive => hive.id === selectedHive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      {/* Hero Section */}
      <div id="hero" className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-yellow-500/10 via-transparent to-yellow-500/5"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1 text-left">
              <h1 className="text-5xl lg:text-6xl font-bold text-yellow-400 mb-6">
                Meet the MoneyBeez 🐝
              </h1>
              <p className="text-lg text-gray-300 mb-8 max-w-3xl">
                Transform your financial life with AI-powered bees that work 24/7 to keep your money buzzing in the right direction. 
                No more financial surprises &mdash; just sweet, actionable insights delivered straight to your phone.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={() => scrollToSection('hives')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-8 text-lg"
                >
                  Choose Your Hive 🏠
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => scrollToSection('how-it-works')}
                  className="border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-black font-bold py-4 px-8 text-lg"
                >
                  See How It Works 🎯
                </Button>
              </div>
            </div>
            
            {/* Hero Content */}
            <div className="flex-1 flex justify-center">
              <div className="relative bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 p-8 rounded-2xl border border-yellow-500/30">
                <div className="text-center">
                  <div className="text-6xl mb-4">🐝</div>
                  <h3 className="text-2xl font-bold text-yellow-400 mb-2">AI Financial Bees</h3>
                  <p className="text-gray-300 text-sm">Working 24/7 for your money</p>
                </div>
                <div className="absolute -top-4 -right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                  AI Powered 🧠
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="py-20 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-yellow-400 mb-6">
              How the Hive Works 🏠
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-3xl">
              Our MoneyBeez work tirelessly to analyze your spending, track your bills, and provide personalized financial insights. 
              They&apos;re like having a team of financial advisors in your pocket, but way more fun and affordable.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="bg-yellow-500/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-10 h-10 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-3">Connect Your Bank</h3>
              <p className="text-gray-300">Securely link your accounts and let our bees start analyzing your financial patterns.</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-500/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-3">Choose Your Hive</h3>
              <p className="text-gray-300">Select the perfect team size based on your financial needs and goals.</p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-500/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-10 h-10 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold text-yellow-400 mb-3">Watch Your Money Grow</h3>
              <p className="text-gray-300">Receive daily insights and watch your financial health improve over time.</p>
            </div>
          </div>

          {/* Process Flow Visualization */}
          <div className="text-center">
            <div className="max-w-4xl mx-auto bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 p-8 rounded-2xl border border-yellow-500/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">📱</div>
                  <p className="text-yellow-400 font-semibold">Mobile App</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">💻</div>
                  <p className="text-yellow-400 font-semibold">Web Dashboard</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">📧</div>
                  <p className="text-yellow-400 font-semibold">SMS Alerts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hive Packages Section */}
      <div id="hives" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-yellow-400 mb-6">
              Choose Your Perfect Hive 🏠
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-3xl">
              Each hive comes with a carefully selected team of bees working together to transform your financial life.
            </p>
          </div>

          {/* Hive Selection Visualization */}
          <div className="text-center mb-12">
            <div className="max-w-3xl mx-auto bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 p-8 rounded-2xl border border-yellow-500/30">
              <div className="text-center">
                <div className="text-6xl mb-4">🏠</div>
                <h3 className="text-2xl font-bold text-yellow-400 mb-2">Choose Your Perfect Hive</h3>
                <p className="text-gray-300">Select from our three carefully crafted packages</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {hivePackages.map((hive) => (
              <Card
                key={hive.id}
                className={`relative p-8 cursor-pointer transition-all duration-200 border-2 ${
                  selectedHive === hive.id
                    ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/25'
                    : 'border-gray-700 bg-gray-800/50 hover:border-yellow-400/50 hover:bg-gray-800/70'
                }`}
                onClick={() => handleSelectHive(hive.id)}
              >
                {/* Popular Badge */}
                {hive.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-yellow-500 text-black px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Best Value Badge */}
                {hive.bestValue && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                      <Crown className="w-4 h-4 mr-1" />
                      Best Value
                    </div>
                  </div>
                )}

                {/* Hive Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-yellow-400 mb-2">{hive.name}</h3>
                  <div className="text-4xl font-bold text-white mb-1">
                    ${hive.price.toFixed(2)}
                    <span className="text-lg text-gray-400 font-normal">/month</span>
                  </div>
                  <p className="text-gray-300 text-sm">{hive.description}</p>
                </div>

                {/* Bees Included */}
                <div className="mb-6">
                  <h4 className="font-semibold text-yellow-400 mb-3 flex items-center">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Bees Included ({hive.bees.length})
                  </h4>
                  <div className="space-y-2">
                    {hive.bees.map((bee, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
                        <span>{bee}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <h4 className="font-semibold text-yellow-400 mb-3 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Features
                  </h4>
                  <div className="space-y-2">
                    {hive.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-300">
                        <Check className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selection Indicator */}
                {selectedHive === hive.id && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-black" />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* CTA Section */}
          {selectedHive && (
            <div className="text-center">
              <div className="bg-gray-800/50 border border-yellow-500/30 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-semibold text-yellow-400 mb-2">
                  Selected: {selectedHiveData?.name}
                </h3>
                <p className="text-gray-300 mb-4">
                  {selectedHiveData?.bees.length} bees working for you at ${selectedHiveData?.price.toFixed(2)}/month
                </p>
                <Button 
                  onClick={handleHireHive}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 text-lg"
                >
                  Hire the {selectedHiveData?.name} 🐝
                </Button>
              </div>
            </div>
          )}

          {/* Sample Messages Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center text-yellow-400 mb-8">
              See What Your Bees Will Send You 🐝
            </h2>
            
            {/* Sample Messages Preview */}
            <div className="text-center mb-12">
              <div className="max-w-4xl mx-auto bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 p-8 rounded-2xl border border-yellow-500/30">
                <div className="text-center">
                  <div className="text-6xl mb-4">📱</div>
                  <h3 className="text-2xl font-bold text-yellow-400 mb-2">Real SMS Messages from Your Bees</h3>
                  <p className="text-gray-300">See exactly what you'll receive every day</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Yancy - Daily Spending */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🦊</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Yancy (Daily Spending)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Daily at 5 PM
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Yesterday&apos;s spending: $127.43 across 8 transactions</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Your coffee habit is showing - 3 visits to Starbucks totaling $24.50!</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Good news: you stayed under your daily budget</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐⭐☆</span>
                  </div>
                </div>
              </Card>

              {/* Eddie - Bill Management */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🦦</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Eddie (Bill Management)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Daily at 8 AM
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Great news - your rent payment cleared successfully! 🎉</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>3 bills coming up this week: Netflix ($15.99), Electric ($89.50), Phone ($45.00)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>You&apos;re on track for another perfect month!</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
              </Card>

              {/* Catrina - Category Analysis */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🐱</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Catrina (Category Analysis)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Daily at 8 AM
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Top spending categories this month:</span>
                  </div>
                  <div className="flex items-start ml-4">
                    <span className="text-yellow-500 mr-2">1)</span>
                    <span>Dining Out (85% of budget) - slow down!</span>
                  </div>
                  <div className="flex items-start ml-4">
                    <span className="text-yellow-500 mr-2">2)</span>
                    <span>Groceries (72% - good pace)</span>
                  </div>
                  <div className="flex items-start ml-4">
                    <span className="text-yellow-500 mr-2">3)</span>
                    <span>Entertainment (45% - room to spend)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐☆☆</span>
                  </div>
                </div>
              </Card>

              {/* Iggy - Income Patterns */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🦅</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Iggy (Income Patterns)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Daily at 8 AM
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Next paycheck arrives in 6 days on Friday</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>12-day financial runway based on current balance</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>That&apos;s 3 days longer than last month - you&apos;re building momentum! 💪</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐⭐☆</span>
                  </div>
                </div>
              </Card>

              {/* Marty - Merchant Insights */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🐺</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Marty (Merchant Insights)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Daily at 8 AM
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Top merchant: Amazon ($247.89) - 23% above 3-month average</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Consider setting up monthly budget for online shopping</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Other top spots: Target ($89.50), Shell ($67.20), Chipotle ($45.60)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐☆☆</span>
                  </div>
                </div>
              </Card>

              {/* Ashley - Daily Planning */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🦉</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Ashley (Daily Planning)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Daily at 5 PM
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Available balance: $1,247.89</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>$389.50 in expenses before Friday&apos;s paycheck</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Daily spending limit: $64.92</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>3rd week staying under budget - keep up the momentum! 🌟</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
              </Card>

              {/* Wendy - Weekly Strategy */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🐝</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Wendy (Weekly Strategy)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Weekly on Sundays
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Weekly Recap: $847.23 spent (down 12% from last week!)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Top categories: Dining ($234.50), Groceries ($189.75), Gas ($89.20)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Next week forecast: $789.50 expected spending</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>You&apos;re trending in the right direction! 🎯</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐⭐☆</span>
                  </div>
                </div>
              </Card>

              {/* Monty - Monthly Mastery */}
              <Card className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🐻</div>
                  <h3 className="text-lg font-semibold text-yellow-400">Monty (Monthly Mastery)</h3>
                  <p className="text-sm text-gray-400 flex items-center justify-center">
                    <Clock className="w-3 h-3 mr-1" />
                    Monthly on the 1st
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Monthly Summary: $3,247.89 spent (7% under budget!)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Savings rate: 23% (up from 18% last month)</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Top insights: Dining out decreased 15%, groceries increased 8%</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Next month forecast: $3,189.50</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>You&apos;re building wealth! 💰</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">•</span>
                    <span>Rating: ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-20 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-yellow-400 mb-6">
              What Our Users Say 🗣️
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-3xl">
              Join thousands of satisfied users who have transformed their financial lives with the MoneyBeez.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6 bg-gray-800/50 border border-gray-700 hover:border-yellow-500/50 transition-colors">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-3">{testimonial.avatar}</div>
                  <div className="flex justify-center mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <h3 className="text-lg font-semibold text-yellow-400">{testimonial.name}</h3>
                  <p className="text-sm text-gray-400">{testimonial.role}</p>
                </div>
                <p className="text-gray-300 text-center italic">"{testimonial.text}"</p>
              </Card>
            ))}
          </div>

          {/* Stats Section */}
          <div className="mt-16 grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">10K+</div>
              <p className="text-gray-300">Active Users</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">$2.5M+</div>
              <p className="text-gray-300">Money Saved</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">4.9/5</div>
              <p className="text-gray-300">User Rating</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-yellow-400 mb-2">24/7</div>
              <p className="text-gray-300">AI Support</p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Experience Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-yellow-400 mb-8">
            Experience the Full MoneyBeez Journey 🚀
          </h2>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-semibold text-yellow-400 mb-4">
                From Onboarding to Financial Mastery
              </h3>
              <p className="text-lg text-gray-300 mb-6 max-w-3xl">
                Experience the full power of AI-driven financial management. Your MoneyBeez will analyze your spending patterns, 
                identify opportunities to save, and keep you informed about your financial health every step of the way.
              </p>
              <div className="space-y-3">
                <div className="flex items-center text-gray-300">
                  <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                  <span>Smart spending pattern recognition</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                  <span>Proactive bill and expense alerts</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                  <span>Personalized financial coaching</span>
                </div>
                <div className="flex items-center text-gray-300">
                  <Check className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0" />
                  <span>Real-time financial health monitoring</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="w-full max-w-lg mx-auto bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 p-6 rounded-lg border border-yellow-500/30">
                <div className="text-4xl mb-2">📊</div>
                <h4 className="text-lg font-semibold text-yellow-400 mb-2">Financial Dashboard</h4>
                <p className="text-gray-300 text-sm">Real-time insights at your fingertips</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA with Image */}
      <div className="mb-16">
        <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-2xl p-8 text-center">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-yellow-400 mb-4">
                Ready to Transform Your Finances? 🐝
              </h3>
              <p className="text-lg text-gray-300 mb-6 max-w-3xl">
                Ready to transform your financial life? Join thousands of users who&apos;ve already discovered the power of having 
                a dedicated team of financial bees working for them. Start your journey to financial freedom today!
              </p>
              <Button 
                onClick={() => scrollToSection('hives')}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-8 text-lg"
              >
                Start Your Financial Journey 🚀
              </Button>
            </div>
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-sm bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 p-6 rounded-lg border border-yellow-500/30">
                <div className="text-center">
                  <div className="text-4xl mb-2">🎉</div>
                  <h4 className="text-lg font-semibold text-yellow-400 mb-2">Success Stories</h4>
                  <p className="text-gray-300 text-sm">Join thousands of happy users</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-12 bg-gray-900/50 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🐝</div>
              <div>
                <h3 className="text-xl font-bold text-yellow-400">MoneyBeez</h3>
                <p className="text-gray-400">AI-Powered Financial Management</p>
              </div>
            </div>
            <div className="flex gap-6">
              <Button variant="ghost" className="text-gray-300 hover:text-yellow-400">
                Privacy Policy
              </Button>
              <Button variant="ghost" className="text-gray-300 hover:text-yellow-400">
                Terms of Service
              </Button>
              <Button variant="ghost" className="text-gray-300 hover:text-yellow-400">
                Support
              </Button>
            </div>
          </div>
          <p className="text-lg text-gray-300 mb-8 max-w-3xl">
            Don&apos;t let your finances be a mystery. Our MoneyBeez are here to help you understand your spending, 
            optimize your budget, and achieve your financial goals. It&apos;s time to take control of your money!
          </p>
          <div className="flex items-center justify-center gap-4 text-gray-400">
            <Users className="w-5 h-5" />
            <span>10,000+ happy users</span>
            <Award className="w-5 h-5" />
            <span>4.9/5 rating</span>
            <Clock className="w-5 h-5" />
            <span>24/7 AI support</span>
          </div>
        </div>
      </div>
    </div>
  );
}
