'use client';

import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  redirectToAnalysis?: boolean; // New prop to control redirect behavior
  buttonText?: string; // Custom button text
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'; // Button variant
  showSkeleton?: boolean; // Show skeleton instead of "Loading Plaid Link..."
}

export default function PlaidLinkButton({ 
  onSuccess, 
  redirectToAnalysis = false, 
  buttonText = 'Connect my account',
  buttonVariant = 'default',
  showSkeleton = false
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createSupabaseClient();
  const router = useRouter();

  // Fetch link token when component mounts
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        if (!user || !session) return;

        const response = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
        });

        if (response.ok) {
          const data = await response.json();
          setLinkToken(data.link_token);
        }
      } catch (error) {
        console.error('Error fetching link token:', error);
      }
    }

    fetchLinkToken();
  }, [supabase]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
          onSuccess: async (public_token, metadata) => {
        setIsLoading(true);
        try {
          // Get current session for auth
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;



          // Exchange public token for access token
          const response = await fetch('/api/plaid/exchange-public-token', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ 
              public_token,
              institution_id: metadata.institution?.institution_id,
            }),
          });

        if (response.ok) {
          if (redirectToAnalysis) {
            // Redirect to analysis screen for new user flow
            router.push('/plaid-success');
          } else if (onSuccess) {
            // Use callback for existing dashboard flow
            onSuccess();
          }
        } else {
          console.error('Plaid token exchange failed:', response.status);
          // Even on error, redirect to plaid-success if redirectToAnalysis is true
          // The success page can handle the error state
          if (redirectToAnalysis) {
            router.push('/plaid-success');
          }
        }
      } catch (error) {
        console.error('Error exchanging token:', error);
        // Even on exception, redirect to plaid-success if redirectToAnalysis is true
        // The success page can handle the error state
        if (redirectToAnalysis) {
          router.push('/plaid-success');
        }
      } finally {
        setIsLoading(false);
      }
    },
    onExit: (err) => {
      // Only log actual errors, not normal exits (empty objects)
      if (err && Object.keys(err).length > 0) {
        console.error('Plaid Link exit error:', err);
      }
      // Normal exit (user closed modal) - no need to log
    },
  });

  // Show skeleton if showSkeleton prop is true, regardless of linkToken state
  if (showSkeleton) {
    return (
      <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
    );
  }

  if (!linkToken) {
    return (
      <Button disabled>
        Loading Plaid Link...
      </Button>
    );
  }

  return (
    <Button 
      onClick={() => open()} 
      disabled={!ready || isLoading}
      variant={buttonVariant}
      className={buttonVariant === 'default' ? "bg-green-600 hover:bg-green-700" : ""}
    >
      {isLoading ? 'Connecting...' : buttonText}
    </Button>
  );
} 