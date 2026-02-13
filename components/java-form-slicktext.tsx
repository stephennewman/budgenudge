'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';

export default function JavaFormSlickText() {
  const [formLoading, setFormLoading] = useState(true);
  
  // Backup form capture (in addition to SlickText JavaScript injection)
  // This provides double coverage in case SlickText timing fails
  const setupBackupCapture = () => {
    let attempts = 0;
    const maxAttempts = 15;
    
    const findAndCaptureForm = () => {
      attempts++;
      // Look for forms in multiple ways
      const containerForms = document.querySelectorAll('#java-form-container form');
      const allForms = document.querySelectorAll('form');
      const targetForm = containerForms[0] || allForms[0];
      
      if (!targetForm && attempts < maxAttempts) {
        setTimeout(findAndCaptureForm, 1000);
        return;
      }
      
      if (!targetForm) {
        return;
      }
      
      // Check if listener already attached
      if ((targetForm as HTMLFormElement).dataset.krezzoBackupAttached) {
        return;
      }
      
      (targetForm as HTMLFormElement).dataset.krezzoBackupAttached = 'true';
      
      targetForm.addEventListener('submit', function() {
        try {
          // Get form data with multiple strategies
          const formData = new FormData(targetForm as HTMLFormElement);
          
          const allData: Record<string, string> = {};
          for (const [key, value] of formData.entries()) {
            allData[key] = value.toString();
          }
          
          // Find fields by multiple methods
          const inputs = targetForm.querySelectorAll('input, select, textarea');
          let phoneValue = '', emailValue = '', firstNameValue = '', lastNameValue = '';
          
          inputs.forEach((input) => {
            const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            const value = element.value || '';
            const type = (element as HTMLInputElement).type || '';
            const name = element.name || '';
            const placeholder = (element as HTMLInputElement).placeholder || '';
            
            if (type === 'tel' || name.toLowerCase().includes('phone') || placeholder.toLowerCase().includes('phone')) {
              phoneValue = value;
            } else if (type === 'email' || name.toLowerCase().includes('email') || placeholder.toLowerCase().includes('email')) {
              emailValue = value;
            } else if (name.toLowerCase().includes('first') || placeholder.toLowerCase().includes('first')) {
              firstNameValue = value;
            } else if (name.toLowerCase().includes('last') || placeholder.toLowerCase().includes('last')) {
              lastNameValue = value;
            }
          });
          
          const captureData = {
            firstName: firstNameValue,
            lastName: lastNameValue,
            email: emailValue,
            phoneNumber: phoneValue
          };
          
          // Send to our API
          fetch('/api/capture-slicktext-lead', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(captureData)
          })
          .then(response => response.json())
          .then(() => {
          })
          .catch(error => {
            console.error('❌ Backup: Error sending to Krezzo:', error);
          });
          
        } catch (error) {
          console.error('❌ Backup: Error capturing form data:', error);
        }
      });
      
    };
    
    // Start looking immediately and keep trying
    setTimeout(findAndCaptureForm, 500);
    setTimeout(findAndCaptureForm, 2000);
    setTimeout(findAndCaptureForm, 4000);
    setTimeout(findAndCaptureForm, 6000);
    setTimeout(findAndCaptureForm, 8000);
  };
  
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
          setFormLoading(false);
          return;
        }
        
        // Create and load script for Java Form
        const script = document.createElement('script');
        script.src = 'https://static.slicktext.com/forms/scripts/embed/eyJ1cmwiOiJodHRwczpcL1wvc3Rmb3Jtcy5jb1wvMDMwNzhlYzVkMGE5ZGJjMjUwMmFkNGY0N2M5YWZiMjQifQ';
        script.async = true;
        
        script.onload = () => {
          timeoutId = setTimeout(() => setFormLoading(false), 2000);
          
          // Set up backup capture after SlickText script loads
          setupBackupCapture();
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