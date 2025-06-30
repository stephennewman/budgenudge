import { createSupabaseClient } from "@/utils/supabase/server";
import AuthPageSignOutButton from "@/components/auth-sign-out-button";
import TransactionDashboard from "@/components/transaction-dashboard";
import SmsButton from "@/components/sms-button";


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

  return (
    <div className="space-y-8">
      <div className="flex flex-col">
        <h1 className="text-2xl font-medium">BudgeNudge Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track your spending automatically with Plaid webhooks
        </p>
      </div>

      {/* SMS Test Button */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="font-medium">📱 SMS Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Test your SMS notifications by clicking the button below. This will send a test message to your phone.
        </p>
        <SmsButton 
          buttonText="📱 Send Test SMS"
          message={`🔔 Test Alert from BudgeNudge!\n\nHey ${user?.email}!\n\nThis is a manual test of your SMS notification system.\n\nTriggered at: ${new Date().toLocaleString()}\n\n✅ Your notifications are working perfectly!`}
          variant="outline"
          userId={user?.id}
          allowScheduling={true}
        />
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
