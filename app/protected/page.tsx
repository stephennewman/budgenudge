"use client";

import { createSupabaseClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import TransactionDashboard from "@/components/transaction-dashboard";
import PlaidLinkButton from "@/components/plaid-link-button";
import VerificationSuccessBanner from "@/components/verification-success-banner";
import VerificationProgressModal from "@/components/verification-progress-modal";
// import GoogleOAuthDataCollectionModal from "@/components/google-oauth-data-collection-modal"; // REMOVED
import { ContentAreaLoader } from "@/components/ui/content-area-loader";
import { Button } from "@/components/ui/button";

import type { User } from "@supabase/supabase-js";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [hasConnectedAccount, setHasConnectedAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  // REMOVED: Modal state variables (no longer needed)

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
        const { data: items } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id);

        setHasConnectedAccount(!!(items && items.length > 0));

        // Get phone number from auth.users or user_sms_settings
        let phone: string | null = user.phone || null; // Try auth.users first
        
        if (!phone) {
          // Fallback to SMS settings table
          const { data: smsSettings } = await supabase
            .from('user_sms_settings')
            .select('phone_number')
            .eq('user_id', user.id)
            .single();
          
          phone = smsSettings?.phone_number ? `+1${smsSettings.phone_number}` : null;
        }
        
        setPhoneNumber(phone);

        // DISABLED: Google OAuth data collection modal (causing false positives)
        // const needsData = isGoogleOAuthUserMissingData(user, phone);
        // setNeedsDataCollection(needsData);
        
        // Check if we should show verification progress modal
        const searchParams = new URLSearchParams(window.location.search);
        const isVerified = searchParams.get('verified') === 'true';
        const hasNoAccounts = !items || items.length === 0;
        
        // Debug logging
        console.log('🔍 Modal Debug:', {
          url: window.location.href,
          isVerified,
          hasNoAccounts,
          itemsCount: items?.length || 0,
          willShowModal: isVerified && hasNoAccounts
        });
        
        if (isVerified && hasNoAccounts) {
          console.log('🎯 Showing verification progress modal');
          setShowProgressModal(true);
        }
        
        // Modal disabled - users can manually add data via SMS preferences if needed
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError("There was an error loading your account. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserAndAccounts();
  }, [supabase]);

  // REMOVED: All modal-related functions (no longer needed)

  const handleAddPhone = async () => {
    if (!user) return;
    
    setIsUpdatingPhone(true);
    
    try {
      // Get phone from SlickText leads if available
      const { data: leads } = await supabase
        .from('sample_sms_leads')
        .select('phone_number')
        .eq('user_id', user.id)
        .limit(1);
      
      if (leads && leads.length > 0 && leads[0].phone_number) {
        const phoneToAdd = `+1${leads[0].phone_number}`;
        
        // Update auth.users phone field
        const { error: authError } = await supabase.auth.updateUser({
          phone: phoneToAdd
        });
        
        if (!authError) {
          // Also ensure SMS settings has the phone number
          const { error: smsError } = await supabase
            .from('user_sms_settings')
            .upsert({ 
              user_id: user.id, 
              phone_number: leads[0].phone_number 
            });
          
          if (!smsError) {
            setPhoneNumber(phoneToAdd);
          }
        }
      } else {
        // Navigate to SMS preferences to add phone manually
        window.location.href = '/protected/sms-preferences';
      }
    } catch (error) {
      console.error('Error adding phone:', error);
    } finally {
      setIsUpdatingPhone(false);
    }
  };

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
        
        {/* REMOVED: Data Collection Notice - this was causing false positive prompts */}
        
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
              Securely connect your bank account to start receiving intelligent financial insights via SMS.
            </p>
          </div>

          <PlaidLinkButton redirectToAnalysis={true} />
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
              <div className="text-muted-foreground">Phone</div>
              <div className="flex items-center gap-2">
                {phoneNumber ? (
                  <span className="font-medium">{phoneNumber}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">Not set</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleAddPhone}
                      disabled={isUpdatingPhone}
                      className="text-xs h-6 px-2"
                    >
                      {isUpdatingPhone ? "Adding..." : "Add Phone"}
                    </Button>
                  </div>
                )}
              </div>
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

      {/* REMOVED: Google OAuth Data Collection Modal - disabled to prevent false positives */}
      
      {/* Verification Progress Modal */}
      {user && (
        <VerificationProgressModal
          isOpen={showProgressModal}
          onClose={() => setShowProgressModal(false)}
          userEmail={user.email || ''}
        />
      )}
    </div>
  );
}
