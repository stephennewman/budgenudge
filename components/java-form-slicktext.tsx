'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';

export default function JavaFormSlickText() {
  const [formLoading, setFormLoading] = useState(true);
  
  // Function to set up form capture after SlickText form loads
  const setupFormCapture = () => {
    console.log('🔍 Setting up Java Form capture...');
    
    const findAndCaptureForm = () => {
      // Look for forms in multiple ways
      const containerForms = document.querySelectorAll('#java-form-container form');
      const allForms = document.querySelectorAll('form');
      
      console.log(`🔍 Found ${containerForms.length} forms in container, ${allForms.length} total forms`);
      
      // Debug: log all forms found
      allForms.forEach((form, index) => {
        console.log(`Form ${index}:`, form);
        const inputs = form.querySelectorAll('input');
        console.log(`  - Has ${inputs.length} inputs`);
        inputs.forEach(input => {
          console.log(`    - Input: name="${input.name}" type="${input.type}" placeholder="${input.placeholder}"`);
        });
      });
      
      const targetForm = containerForms[0] || allForms[0];
      
      if (!targetForm) {
        console.log('⏳ No forms found, retrying in 500ms...');
        setTimeout(findAndCaptureForm, 500);
        return;
      }
      
      console.log('📋 Form found! Setting up capture on:', targetForm);
      
      targetForm.addEventListener('submit', function() {
        console.log('📤 Form submitted! Capturing data...');
        
        try {
          // Get form data - try multiple field name variations
          const formData = new FormData(targetForm as HTMLFormElement);
          
          // Debug: log all form data
          console.log('📊 All form data:');
          for (let [key, value] of formData.entries()) {
            console.log(`  ${key}: ${value}`);
          }
          
          // Try various field name patterns
          const firstName = formData.get('first_name') || formData.get('firstname') || formData.get('First Name') || formData.get('fname') || '';
          const lastName = formData.get('last_name') || formData.get('lastname') || formData.get('Last Name') || formData.get('lname') || '';
          const email = formData.get('email') || formData.get('Email') || formData.get('email_address') || '';
          const phoneNumber = formData.get('phone') || formData.get('phone_number') || formData.get('Phone') || formData.get('mobile') || '';
          
          const captureData = {
            firstName: firstName.toString(),
            lastName: lastName.toString(), 
            email: email.toString(),
            phoneNumber: phoneNumber.toString()
          };
          
          console.log('📊 Captured data:', captureData);
          
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
            console.log('✅ Successfully sent to Krezzo:', data);
          })
          .catch(error => {
            console.error('❌ Error sending to Krezzo:', error);
          });
          
        } catch (error) {
          console.error('❌ Error capturing form data:', error);
        }
      });
      
      console.log('✅ Form capture listener attached successfully');
    };
    
    // Start looking for the form with multiple attempts
    console.log('🚀 Starting form detection...');
    setTimeout(findAndCaptureForm, 1000);
    setTimeout(findAndCaptureForm, 2000);
    setTimeout(findAndCaptureForm, 3000);
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
          
          // Set up form capture after script loads
          setupFormCapture();
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