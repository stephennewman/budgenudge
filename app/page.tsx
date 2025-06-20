import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-2xl flex flex-col text-center">
        <div className="flex justify-center items-center mb-8">
          <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            💳 BudgeNudge
          </div>
        </div>
        
        <h1 className="text-4xl lg:text-5xl font-bold !leading-tight mb-6">
          Real-Time Transaction Monitoring
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-lg mx-auto">
          Get instant SMS alerts for every financial transaction. Connected to your Charles Schwab account 
          with live Plaid webhooks for real-time monitoring.
        </p>

        <div className="flex gap-4 justify-center mb-12">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/sign-in">View Dashboard</Link>
          </Button>
          <Button variant="outline" asChild size="lg" className="text-lg px-8">
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="font-semibold mb-2">Instant Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Get SMS alerts within seconds of any transaction on your accounts
            </p>
          </div>
          
          <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="font-semibold mb-2">Bank-Level Security</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Plaid&apos;s secure API with read-only access to your accounts
            </p>
          </div>
          
          <div className="border rounded-xl p-6 bg-gradient-to-b from-background to-muted/20">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="font-semibold mb-2">Live Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              View all transactions in real-time with automatic categorization
            </p>
          </div>
        </div>

        <div className="mt-12 p-6 border rounded-xl bg-green-50 dark:bg-green-950/20">
          <div className="text-2xl mb-2">✅ System Status: LIVE</div>
          <p className="text-sm text-muted-foreground">
            Webhook monitoring active • 100+ transactions tracked • SMS alerts enabled
          </p>
        </div>
      </div>
    </div>
  );
}
