"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowLeft, CreditCard, Shield } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Agent {
  id: string;
  name: string;
  title: string;
  price: number;
  features: string[];
}

const agents: Record<string, Agent> = {
  yancy: {
    id: "yancy",
    name: "Yancy",
    title: "Daily Spending Analyst",
    price: 4.99,
    features: [
      "Daily transaction summaries",
      "Spending pattern analysis",
      "Performance ratings",
      "Personalized insights"
    ]
  },
  eddie: {
    id: "eddie",
    name: "Eddie",
    title: "Bill Management Specialist",
    price: 4.99,
    features: [
      "Recurring bill detection",
      "Upcoming expense alerts",
      "Payment encouragement",
      "Performance tracking"
    ]
  },
  catrina: {
    id: "catrina",
    name: "Catrina",
    title: "Category Spending Coach",
    price: 4.99,
    features: [
      "Category pacing analysis",
      "Spending recommendations",
      "Budget optimization tips",
      "Performance tracking"
    ]
  },
  iggy: {
    id: "iggy",
    name: "Iggy",
    title: "Income Pattern Detective",
    price: 4.99,
    features: [
      "Income pattern detection",
      "Payday predictions",
      "Financial runway planning",
      "Daily income updates"
    ]
  },
  marty: {
    id: "marty",
    name: "Marty",
    title: "Merchant Spending Analyst",
    price: 4.99,
    features: [
      "Merchant spending analysis",
      "Location-based insights",
      "Spending optimization",
      "Performance tracking"
    ]
  },
  ashley: {
    id: "ashley",
    name: "Ashley",
    title: "Daily Financial Advisor",
    price: 4.99,
    features: [
      "Balance forecasting",
      "Daily spending limits",
      "Expense predictions",
      "Emotional support"
    ]
  },
  wendy: {
    id: "wendy",
    name: "Wendy",
    title: "Weekly Financial Strategist",
    price: 2.99,
    features: [
      "Weekly summaries",
      "Trend analysis",
      "Strategic planning",
      "Weekly forecasts"
    ]
  },
  monty: {
    id: "monty",
    name: "Monty",
    title: "Monthly Financial Strategist",
    price: 1.99,
    features: [
      "Monthly summaries",
      "Long-term trend analysis",
      "Strategic planning",
      "Monthly forecasts"
    ]
  }
};

function AgentCheckoutContent() {
  const searchParams = useSearchParams();
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"review" | "checkout" | "success">("review");

  useEffect(() => {
    const agentsParam = searchParams.get("agents");
    if (agentsParam) {
      setSelectedAgentIds(agentsParam.split(","));
    }
  }, [searchParams]);

  const selectedAgents = selectedAgentIds.map(id => agents[id]).filter(Boolean);
  const subtotal = selectedAgents.reduce((total, agent) => total + agent.price, 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const handleCheckout = async () => {
    setIsLoading(true);
    // TODO: Integrate with your existing subscription system
    // This would create the subscription and activate the agents
    setTimeout(() => {
      setIsLoading(false);
      setStep("success");
    }, 2000);
  };

  if (step === "success") {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8 py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Your AI Team!</h1>
        <p className="text-lg text-gray-600">
          Your financial agents are now active and will start working for you immediately.
        </p>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            You&apos;ll receive your first messages according to each agent&apos;s schedule:
          </p>
          <div className="space-y-2">
            {selectedAgents.map(agent => (
              <div key={agent.id} className="text-sm text-gray-700">
                <strong>{agent.name}</strong> - {agent.title}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <Link href="/protected/agents">
            <Button>View Your Team</Button>
          </Link>
          <Link href="/protected">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/protected/agents/onboarding">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Purchase</h1>
          <p className="text-gray-600">Review your selected agents and complete checkout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Order Summary */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
          
          {/* Selected Agents */}
          <div className="space-y-4">
            {selectedAgents.map((agent) => (
              <Card key={agent.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{agent.name}</h3>
                    <p className="text-sm text-gray-600">{agent.title}</p>
                    <div className="mt-2 space-y-1">
                      {agent.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-3 h-3 text-green-500" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      ${agent.price.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">/month</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <Card className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span>${total.toFixed(2)}/month</span>
            </div>
          </Card>
        </div>

        {/* Checkout Form */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Payment Information</h2>
          
          <Card className="p-6 space-y-6">
            {/* Payment Method */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Payment Method</label>
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">Credit Card</span>
              </div>
            </div>

            {/* Billing Address */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Billing Address</label>
              <div className="p-3 border rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">
                  Billing address will be collected during checkout
                </p>
              </div>
            </div>

            {/* Terms and Security */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900">Secure Checkout</p>
                  <p>Your payment information is encrypted and secure</p>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            <Button 
              onClick={handleCheckout}
              disabled={isLoading || selectedAgents.length === 0}
              className="w-full py-3"
            >
              {isLoading ? "Processing..." : `Complete Purchase - $${total.toFixed(2)}/month`}
            </Button>

            {/* Terms */}
            <p className="text-xs text-gray-500 text-center">
              By completing this purchase, you agree to our Terms of Service and Privacy Policy. 
              You can cancel your subscription at any time.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AgentCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto space-y-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    }>
      <AgentCheckoutContent />
    </Suspense>
  );
}
