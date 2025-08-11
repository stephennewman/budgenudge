"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Settings, Star, Clock, MessageSquare } from "lucide-react";
import Link from "next/link";

interface UserAgent {
  id: string;
  name: string;
  title: string;
  status: "active" | "paused" | "inactive";
  lastMessage: string;
  nextMessage: string;
  rating: number;
  messagesSent: number;
  price: number;
}

// Mock data - this would come from your database
const mockUserAgents: UserAgent[] = [
  {
    id: "yancy",
    name: "Yancy",
    title: "Daily Spending Analyst",
    status: "active",
    lastMessage: "Yesterday you spent $127 on dining out - that's 3x your usual Tuesday pattern! ⭐⭐⭐",
    nextMessage: "Today at 5:00 PM",
    rating: 4.2,
    messagesSent: 23,
    price: 4.99
  },
  {
    id: "eddie",
    name: "Eddie",
    title: "Bill Management Specialist",
    status: "active",
    lastMessage: "Great job! You've paid 8/8 bills this month. Keep it up! ⭐⭐⭐⭐⭐",
    nextMessage: "Tomorrow at 8:00 AM",
    rating: 4.8,
    messagesSent: 31,
    price: 4.99
  },
  {
    id: "ashley",
    name: "Ashley",
    title: "Daily Financial Advisor",
    status: "active",
    lastMessage: "Available balance: $1,247. You can spend up to $89/day until Friday. ⭐⭐⭐⭐",
    nextMessage: "Today at 5:00 PM",
    rating: 4.5,
    messagesSent: 28,
    price: 4.99
  }
];

export default function AgentsPage() {
  const [agents] = useState<UserAgent[]>(mockUserAgents);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "paused":
        return "Paused";
      case "inactive":
        return "Inactive";
      default:
        return "Unknown";
    }
  };

  const totalMonthlyCost = agents.reduce((total, agent) => total + agent.price, 0);
  const totalRating = agents.reduce((total, agent) => total + agent.rating, 0) / agents.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Financial AI Team</h1>
          <p className="text-gray-600 mt-2">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} working for you
          </p>
        </div>
        <Link href="/protected/agents/onboarding">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Hire New Agent
          </Button>
        </Link>
      </div>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-gray-900">{agents.length}</div>
          <div className="text-sm text-gray-600">Active Agents</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-gray-900">${totalMonthlyCost.toFixed(2)}</div>
          <div className="text-sm text-gray-600">Monthly Cost</div>
        </Card>
        <Card className="p-6 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalRating.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Team Rating</div>
        </Card>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <Card key={agent.id} className="p-6 space-y-4">
            {/* Agent Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{agent.name}</h3>
                <p className="text-sm text-gray-600">{agent.title}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                  {getStatusText(agent.status)}
                </span>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Rating and Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span className="font-medium">{agent.rating}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>{agent.messagesSent} messages</span>
              </div>
              <div className="text-gray-500">${agent.price}/month</div>
            </div>

            {/* Last Message */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-700">{agent.lastMessage}</p>
            </div>

            {/* Next Message */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Next: {agent.nextMessage}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1">
                Pause Agent
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                View History
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {agents.length === 0 && (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No agents hired yet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Start building your financial AI team by hiring agents that match your needs and budget.
            </p>
            <Link href="/protected/agents/onboarding">
              <Button>Hire Your First Agent</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm">
            Pause All Agents
          </Button>
          <Button variant="outline" size="sm">
            View Team Performance
          </Button>
          <Button variant="outline" size="sm">
            Export Agent Data
          </Button>
          <Button variant="outline" size="sm">
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
}
