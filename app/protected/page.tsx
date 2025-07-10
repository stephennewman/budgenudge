import { createSupabaseClient } from "@/utils/supabase/server";
import AuthPageSignOutButton from "@/components/auth-sign-out-button";
import TransactionDashboard from "@/components/transaction-dashboard";
import SmsButton from "@/components/sms-button";
import RecurringSmsButton from "@/components/recurring-sms-button";
import ManualRefreshButton from "@/components/manual-refresh-button";


export default async function ProtectedPage() {
  const client = await createSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return (
      <div>There was an error loading your account. Please try again.</div>
    );
  }

  // Check if user has connected a Plaid account
  const { data: items } = await client
    .from('items')
    .select('*')
    .eq('user_id', user.id);

  const hasConnectedAccount = !!(items && items.length > 0);

  // If no connected account, show onboarding flow
  if (!hasConnectedAccount) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">Welcome to BudgeNudge!</h1>
          <p className="text-muted-foreground mt-2">
            Connect your bank account to start receiving real-time transaction alerts
          </p>
        </div>

        <div className="border rounded-lg p-8 text-center space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          
          <div>
            <h2 className="text-xl font-medium mb-2">Connect Your Bank Account</h2>
            <p className="text-muted-foreground mb-6">
              Securely link your bank account to get instant SMS notifications for every transaction. 
              We use Plaid&apos;s bank-grade security to protect your information.
            </p>
          </div>

          <TransactionDashboard />

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-4">
              Your account is authenticated, but you need to connect a bank account to access BudgeNudge features.
            </p>
            <AuthPageSignOutButton />
          </div>
        </div>
      </div>
    );
  }

  // Full dashboard for connected users
  return (
    <div className="space-y-8">
      <div className="flex flex-col">
        <h1 className="text-2xl font-medium">BudgeNudge Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track your spending automatically with Plaid webhooks
        </p>
      </div>

      {/* Control Panel */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* SMS Notifications */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">📱 SMS Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Test your SMS notifications and get summaries of your spending patterns.
          </p>
          
          <div className="space-y-3">
            <SmsButton 
              buttonText="📱 Send Test SMS"
              message={`🔔 Test Alert from BudgeNudge!\n\nHey ${user?.email}!\n\nThis is a manual test of your SMS notification system.\n\nTriggered at: ${new Date().toLocaleString()}\n\n✅ Your notifications are working perfectly!`}
              variant="outline"
              userId={user?.id}
              allowScheduling={true}
            />
            
            <RecurringSmsButton 
              userId={user?.id}
              buttonText="📊 Text My Recurring Bills"
              variant="outline"
            />
          </div>
        </div>

        {/* Transaction Management */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">🔄 Transaction Data</h2>
          <p className="text-sm text-muted-foreground">
            Manually refresh your transaction data to get the latest updates from your bank.
          </p>
          
          <ManualRefreshButton 
            variant="outline"
          />
        </div>
      </div>

      {/* Plaid Transaction Dashboard */}
      <TransactionDashboard />

      <div className="space-y-6">
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">User Information</h2>
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-[120px_1fr]">
              <div className="text-muted-foreground">Email</div>
              <div>{user?.email}</div>
            </div>
            <div className="grid grid-cols-[120px_1fr]">
              <div className="text-muted-foreground">User ID</div>
              <div className="font-mono">{user?.id}</div>
            </div>
            <div className="grid grid-cols-[120px_1fr]">
              <div className="text-muted-foreground">Last Sign In</div>
              <div>
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium">Authentication Status</h2>
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-[120px_1fr]">
              <div className="text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Authenticated
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr]">
              <div className="text-muted-foreground">Providers</div>
              <div>
                {user.identities
                  ?.map(identity => identity.provider)
                  .join(", ") || "Email"}
              </div>
            </div>
          </div>
          <div className="pt-4 border-t">
            <AuthPageSignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
