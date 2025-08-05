'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';

export default function JavaFormSlickText() {
  const [formLoading, setFormLoading] = useState(true);
  
  // Load SlickText Java Form script when component mounts
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadScript = () => {
      try {
        setFormLoading(true);
        
        // Wait for DOM to be ready
        const container = document.getElementById('java-form-container');
        if (!container) {
          console.warn('Java Form container not found, retrying...');
          timeoutId = setTimeout(loadScript, 100);
          return;
        }
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Check if script already exists globally to avoid duplicates
        if (document.querySelector('script[src*="030378ec5d0a9dbc2502ad4f47c9afb24"]')) {
          console.log('Java Form script already loaded');
          setFormLoading(false);
          return;
        }
        
        // Create and load script for Java Form
        const script = document.createElement('script');
        script.src = 'https://static.slicktext.com/forms/scripts/embed/eyJ1cmwiOiJodHRwczpcL1wvc3Rmb3Jtcy5jb1wvMDMwNzhlYzVkMGE5ZGJjMjUwMmFkNGY0N2M5YWZiMjQifQ';
        script.async = true;
        
        script.onload = () => {
          console.log('Java Form script loaded successfully');
          timeoutId = setTimeout(() => setFormLoading(false), 2000);
        };
        
        script.onerror = (error) => {
          console.error('Failed to load Java Form script:', error);
          setFormLoading(false);
        };
        
        container.appendChild(script);
        
      } catch (error) {
        console.error('Error in Java Form script loading:', error);
        setFormLoading(false);
      }
    };
    
    // Start loading after a short delay to ensure DOM is ready
    timeoutId = setTimeout(loadScript, 100);
    
    // Cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="border border-blue-200 rounded-lg p-4 min-h-[200px]" id="java-form-container">
        {formLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <LoaderIcon className="h-8 w-8 animate-spin text-blue-300 mb-4" />
            <p className="text-blue-200">Loading form...</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-blue-200 mb-4">
              If the form doesn&apos;t appear, try refreshing the page.
            </p>
          </div>
        )}
        {/* Java Form will load here via useEffect */}
      </div>
    </div>
  );
}