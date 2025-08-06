'use client';

import { useState, useEffect } from 'react';
import PlaidLinkButton from '@/components/plaid-link-button';

interface VerificationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export default function VerificationProgressModal({ 
  isOpen, 
  onClose, 
  userEmail 
}: VerificationProgressModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Slight delay for smooth animation
      setTimeout(() => setIsVisible(true), 50);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      // Restore body scroll
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    { id: 1, title: "Account Created", status: "completed", icon: "✅" },
    { id: 2, title: "Email Verified", status: "completed", icon: "✅" },
    { id: 3, title: "Connect Your Bank", status: "current", icon: "🔄" },
    { id: 4, title: "Instant Analysis", status: "pending", icon: "⏳" },
    { id: 5, title: "Smart SMS Alerts", status: "pending", icon: "⏳" }
  ];

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`absolute inset-x-4 bottom-4 bg-white rounded-lg shadow-xl max-w-md mx-auto transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              🎉 Welcome to Krezzo!
            </h2>
            <p className="text-sm text-gray-600">
              Your email {userEmail} has been successfully verified
            </p>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Your Progress:</h3>
            {steps.map((step) => (
              <div key={step.id} className="flex items-center space-x-3">
                <span className="text-lg">{step.icon}</span>
                <span 
                  className={`text-sm ${
                    step.status === 'completed' 
                      ? 'text-gray-900' 
                      : step.status === 'current'
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Securely connect your bank account to start receiving intelligent financial insights
            </p>
            <PlaidLinkButton redirectToAnalysis={true} />
          </div>
        </div>
      </div>
    </div>
  );
}