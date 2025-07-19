'use client';

import { useState, Suspense } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSearchParams } from 'next/navigation';

function VerificationErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const description = searchParams.get('description');
  const [isRetrying, setIsRetrying] = useState(false);

  const getErrorConfig = () => {
    switch (error) {
      case 'expired':
        return {
          title: 'Verification Link Expired',
          icon: '⏰',
          message: 'Your verification link has expired for security reasons.',
          actionText: 'Get New Verification Link',
          actionPath: '/sign-up',
          canRetry: true,
          severity: 'warning'
        };
      
      case 'invalid':
        return {
          title: 'Invalid Verification Link',
          icon: '❌',
          message: 'This verification link is invalid or has already been used.',
          actionText: 'Sign Up Again',
          actionPath: '/sign-up',
          canRetry: true,
          severity: 'error'
        };
      
      case 'missing_code':
        return {
          title: 'Incomplete Verification',
          icon: '🔗',
          message: 'The verification link appears to be incomplete.',
          actionText: 'Try Again',
          actionPath: '/sign-up',
          canRetry: true,
          severity: 'warning'
        };
      
      case 'no_session':
        return {
          title: 'Session Creation Failed',
          icon: '🔐',
          message: 'Email verification succeeded, but we couldn\'t log you in automatically.',
          actionText: 'Sign In Manually',
          actionPath: '/sign-in',
          canRetry: false,
          severity: 'info'
        };
      
      case 'exchange_failed':
        return {
          title: 'Verification Failed',
          icon: '⚠️',
          message: 'We couldn\'t process your verification link.',
          actionText: 'Try Again',
          actionPath: '/sign-up',
          canRetry: true,
          severity: 'error'
        };
      
      default:
        return {
          title: 'Verification Error',
          icon: '❗',
          message: 'An unexpected error occurred during email verification.',
          actionText: 'Start Over',
          actionPath: '/sign-up',
          canRetry: true,
          severity: 'error'
        };
    }
  };

  const config = getErrorConfig();

  const handleRetry = async () => {
    setIsRetrying(true);
    // Add small delay for better UX
    setTimeout(() => {
      window.location.href = config.actionPath;
    }, 1000);
  };

  const getSeverityStyles = () => {
    switch (config.severity) {
      case 'warning':
        return {
          bgColor: 'bg-amber-100',
          iconColor: 'text-amber-600',
          borderColor: 'border-amber-200'
        };
      case 'error':
        return {
          bgColor: 'bg-red-100',
          iconColor: 'text-red-600',
          borderColor: 'border-red-200'
        };
      case 'info':
        return {
          bgColor: 'bg-blue-100',
          iconColor: 'text-blue-600',
          borderColor: 'border-blue-200'
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          iconColor: 'text-gray-600',
          borderColor: 'border-gray-200'
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto mt-24">
      <div className="text-center">
        <div className="mb-6">
          <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${styles.bgColor} ${styles.borderColor} border-2`}>
            <span className={`text-2xl ${styles.iconColor}`}>{config.icon}</span>
          </div>
        </div>
        
        <h1 className="text-2xl font-medium text-gray-900 mb-2">{config.title}</h1>
        <p className="text-sm text-gray-600 mb-2">{config.message}</p>
        
        {description && description !== 'undefined' && (
          <div className={`mt-4 p-3 rounded-md ${styles.bgColor} ${styles.borderColor} border`}>
            <p className="text-xs text-gray-700">{description}</p>
          </div>
        )}
        
        <div className="mt-8 space-y-4">
          {config.canRetry ? (
            <Button 
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Redirecting...
                </>
              ) : (
                config.actionText
              )}
            </Button>
          ) : (
            <Link href={config.actionPath}>
              <Button className="w-full">
                {config.actionText}
              </Button>
            </Link>
          )}
          
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Need help?{" "}
              <Link href="/sign-up" className="text-blue-600 hover:text-blue-500 underline">
                Start fresh with sign up
              </Link>
            </p>
            
            <p className="text-xs text-gray-500">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-blue-600 hover:text-blue-500 underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Debug information in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-3 bg-gray-50 rounded text-left">
            <p className="text-xs font-mono text-gray-500 mb-1">Debug Info:</p>
            <p className="text-xs font-mono text-gray-600">Error: {error || 'none'}</p>
            <p className="text-xs font-mono text-gray-600 break-all">Description: {description || 'none'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VerificationErrorFallback() {
  return (
    <div className="flex-1 flex flex-col w-full max-w-md mx-auto mt-24">
      <div className="text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 border-2 border-gray-200">
            <span className="text-2xl text-gray-600">⚠️</span>
          </div>
        </div>
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Loading...</h1>
        <p className="text-sm text-gray-600">Processing verification error...</p>
      </div>
    </div>
  );
}

export default function VerificationError() {
  return (
    <Suspense fallback={<VerificationErrorFallback />}>
      <VerificationErrorContent />
    </Suspense>
  );
} 