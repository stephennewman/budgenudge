'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckIcon, LoaderIcon } from 'lucide-react';

interface SampleSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = 'phone' | 'verification' | 'success';

export default function SampleSMSModal({ isOpen, onClose }: SampleSMSModalProps) {
  const [step, setStep] = useState<ModalStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send verification code');
      }

      setStep('verification');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/verify-and-send-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code: verificationCode })
      });

      if (!response.ok) {
        throw new Error('Invalid verification code');
      }

      setStep('success');
    } catch {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('phone');
    setPhoneNumber('');
    setVerificationCode('');
    setError('');
    onClose();
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return digits;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === 'phone' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Get Your Sample Financial Text</h2>
              <p className="text-gray-600">Step 1: Subscribe to receive SMS alerts</p>
            </div>
            
            {/* SlickText Embedded Opt-in Form */}
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <script 
                  async 
                  src="https://static.slicktext.com/forms/scripts/embed/eyJ1cmwiOiJodHRwczpcL1wvc3Rmb3Jtcy5jb1wvNWEzZmFhZDExMGZiMjM5N2U5NjA1YzlmMTM2MjkzYzMifQ"
                ></script>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✅ Official SMS subscription through SlickText<br/>
                  ✅ TCPA compliant opt-in process<br/>
                  ✅ Required for SMS delivery
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  After subscribing above, click here to get your verification code:
                </p>
                <form onSubmit={handleSendCode}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phone">Phone Number (same as above)</Label>
                      <Input 
                        id="phone"
                        name="phone" 
                        placeholder="(555) 123-4567" 
                        type="tel"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        maxLength={14}
                        required 
                        className="text-lg h-12"
                      />
                    </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  disabled={loading || phoneNumber.length < 14}
                  className="w-full h-12 text-lg"
                >
                  {loading ? (
                    <LoaderIcon className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Send Verification Code
                </Button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {step === 'verification' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <span className="text-2xl">📲</span>
              </div>
              <h2 className="text-xl font-bold mb-2">Enter Verification Code</h2>
              <p className="text-gray-600">
                We sent a 4-digit code to<br/>
                <span className="font-medium">{phoneNumber}</span>
              </p>
            </div>
            
            <form onSubmit={handleVerifyCode}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">Verification Code</Label>
                  <Input 
                    id="code"
                    placeholder="1234" 
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    className="text-center text-2xl font-mono h-16 tracking-[0.5em]"
                    required
                  />
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  disabled={loading || verificationCode.length !== 4}
                  className="w-full h-12 text-lg"
                >
                  {loading ? (
                    <LoaderIcon className="w-5 h-5 animate-spin mr-2" />
                  ) : null}
                  Verify & Send Sample
                </Button>
                
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back to phone number
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                <CheckIcon className="w-10 h-10 text-green-600" />
              </div>
              
              <h2 className="text-2xl font-bold mb-4">
                📱 Sample Text Coming Your Way!
              </h2>
              
              <p className="text-lg text-gray-600 mb-8">
                You&apos;ll receive your sample financial analysis in the next 30 seconds.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-blue-800 mb-2">Want to see YOUR real data?</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Connect your bank account to get personalized insights about your actual spending
                </p>
                <Button asChild size="lg" className="w-full">
                  <a href="/sign-up" onClick={handleClose}>
                    Use My Real Data →
                  </a>
                </Button>
              </div>
              
              <button
                onClick={handleClose}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}