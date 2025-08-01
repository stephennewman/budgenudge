"use client";

import { createSupabaseClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import TransactionDashboard from "@/components/transaction-dashboard";
import VerificationSuccessBanner from "@/components/verification-success-banner";
import { ContentAreaLoader } from "@/components/ui/content-area-loader";
import type { User } from "@supabase/supabase-js";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [hasConnectedAccount, setHasConnectedAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseClient();

  useEffect(() => {
    async function fetchUserAndAccounts() {
      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError("There was an error loading your account. Please try again.");
          return;
        }

        setUser(user);

        // Check if user has connected a Plaid account
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id);

        console.log('🔍 Account Detection Debug:');
        console.log('User ID:', user.id);
        console.log('Items query result:', items);
        console.log('Items query error:', itemsError);
        console.log('Items count:', items?.length || 0);

        // TEMPORARY: Also check transactions to compare
        const { data: transactions, error: txError } = await supabase
          .from('transactions')
          .select('plaid_item_id')
          .limit(5);
        
        console.log('Transactions query result:', transactions);
        console.log('Transactions query error:', txError);

        setHasConnectedAccount(!!(items && items.length > 0));
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError("There was an error loading your account. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserAndAccounts();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="relative min-h-[600px]">
        <ContentAreaLoader />
      </div>
    );
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!user) {
    return (
      <div>There was an error loading your account. Please try again.</div>
    );
  }

  // If no connected account, show onboarding flow
  if (!hasConnectedAccount) {
    return (
      <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
        <VerificationSuccessBanner />
        
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">🏠 Account Setup</h1>
          <p className="text-muted-foreground mt-2">
            Complete your account setup to start using Krezzo
          </p>
        </div>

        <div className="border rounded-lg p-6 sm:p-8 text-center space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          
          <div>
            <h2 className="text-xl font-medium mb-3 sm:mb-2">🏦 Connect Your Bank Account</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Krezzo has partnered with Plaid to securely connect to thousands of banks. Authenticate your primary bank account and start automatically syncing transactional data.
            </p>
          </div>

          <TransactionDashboard />
        </div>
      </div>
    );
  }

  // Account management for connected users

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
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
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        
        {/* User Profile */}
        <div className="border rounded-lg p-4 sm:p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            👤 Profile Information
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium break-all">{user?.email}</div>
            </div>
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">User ID</div>
              <div className="font-mono text-xs text-gray-500 break-all">{user?.id}</div>
            </div>
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Last Sign In</div>
              <div className="text-xs sm:text-sm">
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
        </div>

        {/* Authentication Status */}
        <div className="border rounded-lg p-4 sm:p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            🔐 Security & Authentication
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-green-700">Authenticated</span>
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Providers</div>
              <div className="font-medium">
                {user.identities
                  ?.map((identity) => identity.provider)
                  .join(", ") || "Email"}
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-2">
              <div className="text-muted-foreground">Created</div>
              <div className="text-xs sm:text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

{/* COMMENTED OUT: Redundant sections as requested
        
        Account Actions
        <div className="border rounded-lg p-4 sm:p-6 space-y-4">
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

        Account Summary
        <div className="border rounded-lg p-4 sm:p-6 space-y-4">
          <h2 className="font-medium flex items-center gap-2">
            📈 Account Summary
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-2">
              <div className="text-muted-foreground">Connected Banks</div>
              <div className="font-medium">0 account(s)</div>
            </div>
            <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-2">
              <div className="text-muted-foreground">SMS Notifications</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-green-700">Active</span>
              </div>
            </div>
            <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-2">
              <div className="text-muted-foreground">AI Tagging</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-medium text-green-700">Enabled</span>
              </div>
            </div>
          </div>
        </div>
        */}
      </div>
    </div>
  );
}
