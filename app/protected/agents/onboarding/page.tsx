"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  title: string;
  description: string;
  personality: string;
  tasks: string[];
  schedule: string;
  price: number;
  features: string[];
  sampleMessage: string;
}

const agents: Agent[] = [
  {
    id: "yancy",
    name: "Yancy",
    title: "🦊 Daily Spending Fox",
    description: "Your clever spending detective who sniffs out spending patterns and provides witty insights with fox-like cunning.",
    personality: "Observant, witty, and always has a story to tell about your spending patterns.",
    tasks: [
      "Summarizes all yesterday's posted transactions",
      "Provides commentary on spending habits and trends",
      "Identifies spending outliers and unusual patterns",
      "Gives daily 5-star performance ratings"
    ],
    schedule: "Daily at 5 PM",
    price: 4.99,
        features: [
      "Daily transaction summaries",
      "Spending pattern analysis", 
      "Performance ratings",
      "Personalized insights"
    ],
    sampleMessage: "🦊 Yancy here! Yesterday you spent $127.43 across 8 transactions. Your coffee habit is showing - 3 visits to Starbucks totaling $24.50! But good news: you stayed under your daily budget. Rating: ⭐⭐⭐⭐☆"
  },
  {
    id: "eddie",
    name: "Eddie",
    title: "🦦 Bill Management Otter",
    description: "Your organized otter friend who keeps track of all your recurring bills and ensures nothing falls through the cracks.",
    personality: "Encouraging, organized, and loves celebrating when you pay bills on time.",
    tasks: [
      "Identifies and tracks recurring expenses",
      "Highlights upcoming bills (rent, utilities, etc.)",
      "Provides daily bill payment encouragement",
      "Gives 5-star ratings based on bill payment performance"
    ],
    schedule: "Daily at 8 AM",
    price: 4.99,
    features: [
      "Recurring bill detection",
      "Upcoming expense alerts",
      "Payment encouragement",
      "Performance tracking"
    ],
    sampleMessage: "🦦 Eddie here! Great news - your rent payment cleared successfully! 🎉 You have 3 bills coming up this week: Netflix ($15.99), Electric ($89.50), and Phone ($45.00). You're on track for another perfect month! Rating: ⭐⭐⭐⭐⭐"
  },
  {
    id: "catrina",
    name: "Catrina",
    title: "🐱 Category Spending Cat",
    description: "Your graceful feline advisor who analyzes your spending by category and helps you land on your feet financially.",
    personality: "Analytical, encouraging, and always has practical advice for optimizing your spending.",
    tasks: [
      "Tracks spending against category baselines",
      "Identifies top 5 spending categories by pace",
      "Provides suggestions for spending adjustments",
      "Gives 5-star ratings on category management"
    ],
    schedule: "Daily at 8 AM",
    price: 4.99,
    features: [
      "Category pacing analysis",
      "Spending recommendations",
      "Budget optimization tips",
      "Performance tracking"
    ],
    sampleMessage: "🐱 Catrina here! Your top spending categories this month: 1) Dining Out (85% of budget) - slow down! 2) Groceries (72% - good pace) 3) Entertainment (45% - room to spend) 4) Gas (38% - excellent) 5) Shopping (25% - great control). Rating: ⭐⭐⭐☆☆"
  },
  {
    id: "iggy",
    name: "Iggy",
    title: "🦅 Income Pattern Eagle",
    description: "Your sharp-eyed eagle who soars above your finances to identify income patterns and predict when money will arrive.",
    personality: "Predictive, strategic, and always thinking about your financial future.",
    tasks: [
      "Identifies income streams and cycles",
      "Predicts upcoming income dates",
      "Provides daily income updates",
      "Helps plan spending between paydays"
    ],
    schedule: "Daily at 8 AM",
    price: 4.99,
    features: [
      "Income pattern detection",
      "Payday predictions",
      "Financial runway planning",
      "Daily income updates"
    ],
    sampleMessage: "🦅 Iggy here! Your next paycheck arrives in 6 days on Friday. Based on your current balance and upcoming expenses, you have a 12-day financial runway. That's 3 days longer than last month - you're building momentum! 💪 Rating: ⭐⭐⭐⭐☆"
  },
  {
    id: "marty",
    name: "Marty",
    title: "🐺 Merchant Spending Wolf",
    description: "Your pack leader wolf who analyzes your spending by merchant and location to identify optimization opportunities.",
    personality: "Detail-oriented, strategic, and always looking for ways to optimize your merchant relationships.",
    tasks: [
      "Analyzes spending at specific merchants",
      "Tracks merchant spending against baselines",
      "Identifies top spending locations",
      "Provides merchant-specific recommendations"
    ],
    schedule: "Daily at 8 AM",
    price: 4.99,
    features: [
      "Merchant spending analysis",
      "Location-based insights",
      "Spending optimization",
      "Performance tracking"
    ],
    sampleMessage: "🐺 Marty here! Your top merchant this month: Amazon ($247.89). You're spending 23% more there than your 3-month average. Consider setting up a monthly budget for online shopping. Other top spots: Target ($89.50), Shell ($67.20), Chipotle ($45.60). Rating: ⭐⭐⭐☆☆"
  },
  {
    id: "ashley",
    name: "Ashley",
    title: "🦉 Daily Financial Owl",
    description: "Your wise owl advisor who provides comprehensive daily financial guidance with wisdom and insight.",
    personality: "Supportive, practical, and always there to help you make smart financial decisions.",
    tasks: [
      "Provides available balance updates",
      "Forecasts expenses before next income",
      "Calculates daily spending limits",
      "Offers emotional support and encouragement"
    ],
    schedule: "Daily at 5 PM",
    price: 4.99,
    features: [
      "Balance forecasting",
      "Daily spending limits",
      "Expense predictions",
      "Emotional support"
    ],
    sampleMessage: "🦉 Ashley here! Your available balance: $1,247.89. You have $389.50 in expenses before Friday's paycheck. Your daily spending limit: $64.92. You're doing great - this is your 3rd week staying under budget! Keep up the momentum! 🌟 Rating: ⭐⭐⭐⭐⭐"
  },
  {
    id: "wendy",
    name: "Wendy",
    title: "🐝 Weekly Financial Bee",
    description: "Your busy bee who delivers comprehensive weekly summaries and strategic planning for the week ahead.",
    personality: "Strategic, comprehensive, and always thinking about the bigger financial picture.",
    tasks: [
      "Provides weekly spending recaps",
      "Analyzes weekly trends and patterns",
      "Forecasts financial needs for the week ahead",
      "Offers strategic financial planning advice"
    ],
    schedule: "Weekly on Sundays",
    price: 2.99,
    features: [
      "Weekly summaries",
      "Trend analysis",
      "Strategic planning",
      "Weekly forecasts"
    ],
    sampleMessage: "🐝 Wendy here! Weekly Recap: You spent $847.23 (down 12% from last week!). Top categories: Dining ($234.50), Groceries ($189.75), Gas ($89.20). Next week forecast: $789.50 expected spending. You're trending in the right direction! 🎯 Rating: ⭐⭐⭐⭐☆"
  },
  {
    id: "monty",
    name: "Monty",
    title: "🐻 Monthly Financial Bear",
    description: "Your strong and steady bear who delivers comprehensive monthly summaries and long-term financial planning insights.",
    personality: "Strategic, analytical, and always focused on long-term financial success.",
    tasks: [
      "Provides comprehensive monthly recaps",
      "Analyzes monthly trends and patterns",
      "Forecasts financial needs for the month ahead",
      "Offers long-term financial planning advice"
    ],
    schedule: "Monthly on the 1st",
    price: 1.99,
    features: [
      "Monthly summaries",
      "Long-term trend analysis",
      "Strategic planning",
      "Monthly forecasts"
    ],
    sampleMessage: "🐻 Monty here! Monthly Summary: You spent $3,247.89 (7% under budget!). Savings rate: 23% (up from 18% last month). Top insights: Dining out decreased 15%, groceries increased 8%, entertainment stayed steady. Next month forecast: $3,189.50. You're building wealth! 💰 Rating: ⭐⭐⭐⭐⭐"
  }
];

export default function AgentOnboardingPage() {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const getTotalPrice = () => {
    return selectedAgents.reduce((total, agentId) => {
      const agent = agents.find(a => a.id === agentId);
      return total + (agent?.price || 0);
    }, 0);
  };

  const handleContinue = async () => {
    if (selectedAgents.length === 0) return;
    
    // Redirect to checkout with selected agents
    const agentsParam = selectedAgents.join(',');
    window.location.href = `/protected/agents/checkout?agents=${agentsParam}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">
          Hire Your Financial AI Team
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Choose which financial agents you want working for you. Each agent has a specific role, 
          personality, and expertise to help you master your finances.
        </p>
      </div>

      {/* Agent Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <Card 
            key={agent.id}
            className={`p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedAgents.includes(agent.id) 
                ? 'ring-2 ring-blue-500 bg-blue-50' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => toggleAgent(agent.id)}
          >
            {/* Agent Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{agent.name}</h3>
                <p className="text-sm text-gray-600">{agent.title}</p>
              </div>
              {selectedAgents.includes(agent.id) && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-700 mb-4">{agent.description}</p>

            {/* Personality */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Personality:</p>
              <p className="text-sm text-gray-700 italic">&ldquo;{agent.personality}&rdquo;</p>
            </div>

            {/* Sample Message */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Sample Message:</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-gray-800 font-mono">{agent.sampleMessage}</p>
              </div>
            </div>

            {/* Tasks */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">What they do:</p>
              <ul className="space-y-1">
                {agent.tasks.map((task, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {task}
                  </li>
                ))}
              </ul>
            </div>

            {/* Schedule */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Schedule:</p>
              <p className="text-sm text-gray-700 font-medium">{agent.schedule}</p>
            </div>

            {/* Features */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Features:</p>
              <div className="flex flex-wrap gap-1">
                {agent.features.map((feature, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="text-center pt-4 border-t">
              <div className="text-2xl font-bold text-gray-900">
                ${agent.price.toFixed(2)}
                <span className="text-sm font-normal text-gray-600">/month</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Summary and Continue */}
      {selectedAgents.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm text-gray-600">
                {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} selected
              </p>
              <p className="text-lg font-semibold text-gray-900">
                Total: ${getTotalPrice().toFixed(2)}/month
              </p>
            </div>
            <Button 
              onClick={handleContinue}
              className="px-8 py-3"
            >
              Continue to Checkout
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Spacing */}
      {selectedAgents.length > 0 && <div className="h-32" />}
    </div>
  );
}
