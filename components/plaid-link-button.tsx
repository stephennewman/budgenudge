'use client';

import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';

interface PlaidLinkButtonProps {
  onSuccess: () => void;
}

// Extended metadata type to include phone verification
interface PlaidLinkMetadataWithPhone {
  institution?: {
    institution_id: string;
    name: string;
  };
  phone_number_verification?: {
    phone_number: string;
  };
}

export default function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createSupabaseClient();

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

        // Save phone number if provided by Plaid
        const metadataWithPhone = metadata as PlaidLinkMetadataWithPhone;
        if (metadataWithPhone.phone_number_verification?.phone_number) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.auth.updateUser({
              data: { phone: metadataWithPhone.phone_number_verification.phone_number }
            });
            console.log('📱 Phone number saved from Plaid:', metadataWithPhone.phone_number_verification.phone_number);
          }
        }

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
          onSuccess();
        }
      } catch (error) {
        console.error('Error exchanging token:', error);
      } finally {
        setIsLoading(false);
      }
    },
    onExit: (err) => {
      if (err) {
        console.error('Plaid Link exit error:', err);
      }
    },
  });

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
      className="bg-blue-600 hover:bg-blue-700"
    >
      {isLoading ? 'Connecting...' : '🏦 Connect Bank Account'}
    </Button>
  );
} 