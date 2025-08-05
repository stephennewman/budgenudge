'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';

export default function JavaFormSlickText() {
  const [formLoading, setFormLoading] = useState(true);
  
  // Backup form capture (in addition to SlickText JavaScript injection)
  // This provides double coverage in case SlickText timing fails
  const setupBackupCapture = () => {
    console.log('🔧 Setting up backup form capture...');
    
    let attempts = 0;
    const maxAttempts = 15;
    
    const findAndCaptureForm = () => {
      attempts++;
      console.log(`🔍 Backup capture attempt ${attempts}/${maxAttempts}`);
      
      // Look for forms in multiple ways
      const containerForms = document.querySelectorAll('#java-form-container form');
      const allForms = document.querySelectorAll('form');
      const anyInputs = document.querySelectorAll('input[type="email"], input[type="tel"]');
      
      console.log(`📊 Backup found: ${containerForms.length} container forms, ${allForms.length} total forms, ${anyInputs.length} email/phone inputs`);
      
      const targetForm = containerForms[0] || allForms[0];
      
      if (!targetForm && attempts < maxAttempts) {
        console.log('⏳ Backup: No form found, retrying...');
        setTimeout(findAndCaptureForm, 1000);
        return;
      }
      
      if (!targetForm) {
        console.log('❌ Backup: No forms found after all attempts');
        return;
      }
      
      console.log('📋 Backup: Form found!', targetForm);
      
      // Check if listener already attached
      if (targetForm.dataset.krezzoBackupAttached) {
        console.log('⚠️ Backup: Already attached to this form');
        return;
      }
      
      targetForm.dataset.krezzoBackupAttached = 'true';
      
      targetForm.addEventListener('submit', function() {
        console.log('📤 BACKUP CAPTURE: Form submitted!');
        
        try {
          // Get form data with multiple strategies
          const formData = new FormData(targetForm as HTMLFormElement);
          
          console.log('📊 Backup: All form fields:');
          const allData: Record<string, string> = {};
          for (let [key, value] of formData.entries()) {
            allData[key] = value.toString();
            console.log(`  ${key}: ${value}`);
          }
          
          // Find fields by multiple methods
          const inputs = targetForm.querySelectorAll('input, select, textarea');
          let phoneValue = '', emailValue = '', firstNameValue = '', lastNameValue = '';
          
          inputs.forEach((input: any) => {
            const value = input.value || '';
            const type = input.type || '';
            const name = input.name || '';
            const placeholder = input.placeholder || '';
            
            console.log(`🔍 Backup checking input: type="${type}" name="${name}" placeholder="${placeholder}" value="${value}"`);
            
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
          
          console.log('📊 Backup captured data:', captureData);
          
          // Send to our API
          fetch('/api/capture-slicktext-lead', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(captureData)
          })
          .then(response => response.json())
          .then(data => {
            console.log('✅ Backup: Successfully sent to Krezzo:', data);
          })
          .catch(error => {
            console.error('❌ Backup: Error sending to Krezzo:', error);
          });
          
        } catch (error) {
          console.error('❌ Backup: Error capturing form data:', error);
        }
      });
      
      console.log('✅ Backup: Submit listener attached successfully');
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