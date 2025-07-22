import { createSupabaseClient } from "@/utils/supabase/server";
import AuthPageSignOutButton from "@/components/auth-sign-out-button";
import TransactionDashboard from "@/components/transaction-dashboard";
import VerificationSuccessBanner from "@/components/verification-success-banner";

export default async function AccountPage() {
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
        <VerificationSuccessBanner />
        
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">🏠 Account Setup</h1>
          <p className="text-muted-foreground mt-2">
            Complete your account setup to start using Krezzo
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
              Your account is authenticated, but you need to connect a bank account to access Krezzo features.
            </p>
            <AuthPageSignOutButton />
          </div>
        </div>
      </div>
    );
  }

  // Account management for connected users
  return (
    <div className="space-y-8">
      <VerificationSuccessBanner />
      
      <div className="flex flex-col">
        <h1 className="text-2xl font-medium">🏠 Account</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and connected bank accounts
        </p>
      </div>

      {/* Connected Bank Accounts */}
      <TransactionDashboard />

      {/* Account Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* User Profile */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            👤 Profile Information
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">User ID</div>
              <div className="font-mono text-xs text-gray-500">{user?.id}</div>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Last Sign In</div>
              <div>
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Status */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            🔐 Security & Authentication
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-green-700">Authenticated</span>
              </div>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Providers</div>
              <div className="font-medium">
                {user.identities
                  ?.map(identity => identity.provider)
                  .join(", ") || "Email"}
              </div>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Created</div>
              <div>
                {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            ⚙️ Account Actions
          </h2>
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground">Sign out of your account</label>
              <AuthPageSignOutButton />
            </div>
          </div>
        </div>

        {/* Account Summary */}
        <div className="border rounded-lg p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            📈 Account Summary
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <div className="text-muted-foreground">Connected Banks</div>
              <div className="font-medium">{items?.length || 0} account(s)</div>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <div className="text-muted-foreground">SMS Notifications</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-green-700">Active</span>
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <div className="text-muted-foreground">AI Tagging</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-green-700">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
