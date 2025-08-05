'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSupabaseClient } from '@/utils/supabase/client';

interface GoogleOAuthDataCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  fullName?: string;
  onDataCollected: () => void;
}

export default function GoogleOAuthDataCollectionModal({
  isOpen,
  onClose,
  userEmail,
  fullName = '',
  onDataCollected
}: GoogleOAuthDataCollectionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pre-populate names from Google full_name if available
  const nameParts = fullName.split(' ');
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [phone, setPhone] = useState('');
  
  const supabase = createSupabaseClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');
      
      if (cleanPhone.length < 10) {
        setError('Please enter a valid 10-digit phone number');
        setIsLoading(false);
        return;
      }

      if (!firstName.trim() || !lastName.trim()) {
        setError('Please enter both first and last name');
        setIsLoading(false);
        return;
      }

      // Update user metadata with the collected information
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          signupPhone: cleanPhone,
          googleOAuthDataCompleted: true
        }
      });

      if (updateError) {
        throw updateError;
      }

      // Update phone number in auth.users table
      const formattedPhone = `+1${cleanPhone}`;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const updateResponse = await fetch('/api/profile/phone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            phone: formattedPhone,
            user_id: user.id
          })
        });

        if (!updateResponse.ok) {
          console.warn('Phone update API call failed:', updateResponse.status);
        }
      }

      // Create/update SMS settings
      const { error: smsError } = await supabase
        .from('user_sms_settings')
        .upsert({
          user_id: user.id,
          phone_number: cleanPhone,
          send_time: '14:00' // Default to 2 PM
        });

      if (smsError) {
        console.warn('SMS settings update failed:', smsError);
      }

      // Add to SlickText with complete information
      try {
        const slickTextResponse = await fetch('/api/add-user-to-slicktext', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            email: userEmail,
            phone: cleanPhone,
            first_name: firstName.trim(),
            last_name: lastName.trim()
          })
        });

        if (slickTextResponse.ok) {
          console.log('✅ User successfully added to SlickText with complete data');
        } else {
          console.warn('⚠️ SlickText integration failed, but user data was saved');
        }
      } catch (slickTextError) {
        console.warn('⚠️ SlickText integration error:', slickTextError);
      }

      onDataCollected();
      onClose();

    } catch (error) {
      console.error('Data collection error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    setPhone(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            🎉 Welcome to Krezzo!
          </DialogTitle>
          <p className="text-center text-muted-foreground mt-2">
            We need a few quick details to personalize your experience and enable SMS notifications.
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="text-sm">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                required
                className="mt-1"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <Label htmlFor="phone" className="text-sm">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="5551234567"
              required
              pattern="[0-9]{10}"
              title="Please enter a 10-digit phone number"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required for SMS transaction alerts and insights
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Saving...' : 'Complete Setup'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}