'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function VerificationSuccessBanner() {
  const searchParams = useSearchParams();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      setShowBanner(true);
      
      // Auto-hide after 15 seconds (longer for better visibility)
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 15000);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!showBanner) return null;

  return (
    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-800">Email Verified Successfully!</h3>
            <p className="mt-1 text-sm text-green-700">
              Welcome to Krezzo! Your email has been verified and you&apos;re now logged in. 
              {' '}Start by connecting your bank account to receive real-time transaction alerts.
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBanner(false)}
            className="text-green-600 hover:text-green-800 hover:bg-green-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
} 