'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';

export default function SlickTextForm() {
  const [formLoading, setFormLoading] = useState(true);
  
  // Load SlickText form script when component mounts
  useEffect(() => {
    setFormLoading(true);
    
    // Clear any existing form first
    const container = document.getElementById('slicktext-inline-form');
    if (container) {
      container.innerHTML = '';
    }
    
    // Add script with load handler
    const script = document.createElement('script');
    script.src = 'https://static.slicktext.com/forms/scripts/embed/eyJ1cmwiOiJodHRwczpcL1wvc3Rmb3Jtcy5jb1wvNWEzZmFhZDExMGZiMjM5N2U5NjA1YzlmMTM2MjkzYzMifQ';
    script.async = true;
    
    script.onload = () => {
      console.log('SlickText script loaded for inline form');
      setTimeout(() => setFormLoading(false), 2000); // Give form time to render
    };
    
    script.onerror = () => {
      console.error('Failed to load SlickText script');
      setFormLoading(false);
    };
    
    if (container) {
      container.appendChild(script);
    }
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <span className="text-2xl">📱</span>
        </div>
        <h3 className="text-2xl font-bold mb-2">Subscribe to SMS Alerts</h3>
        <p className="text-gray-600">Get daily financial insights sent to your phone</p>
      </div>

      {/* SlickText Embedded Form */}
      <div className="border border-gray-200 rounded-lg p-4 min-h-[200px]" id="slicktext-inline-form">
        {formLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <LoaderIcon className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading subscription form...</p>
          </div>
        )}
        {/* SlickText form will load here via useEffect */}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-blue-800 text-center">
          ✅ Official SMS subscription through SlickText<br/>
          ✅ TCPA compliant opt-in process<br/>
          ✅ Start receiving daily financial insights
        </p>
      </div>
      
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          After subscribing, you&apos;ll get a welcome text and can{' '}
          <a href="/sign-up" className="text-blue-600 hover:underline">
            sign up for full access
          </a>
        </p>
      </div>
    </div>
  );
}