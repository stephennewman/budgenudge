'use client';

import { signUpAction } from "@/app/actions";
import AuthSubmitButton from "@/components/auth-submit-button";
import GoogleSignInButton from "@/components/google-sign-in-button";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function SignUpFormContent() {
  const searchParams = useSearchParams();
  const [trackingToken, setTrackingToken] = useState<string>('');
  
  // Get tracking token from localStorage
  useEffect(() => {
    const token = localStorage.getItem('sampleSmsToken') || '';
    setTrackingToken(token);
  }, []);
  
  // Convert searchParams to Message format for compatibility
  let message: Message | undefined;
  if (searchParams.get('message')) {
    message = { message: searchParams.get('message') || '' };
  } else if (searchParams.get('error')) {
    message = { error: searchParams.get('error') || '' };
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <span className="text-2xl">📱</span>
        </div>
        <h3 className="text-2xl font-bold mb-2">Get Started with Money Texts</h3>
        <p className="text-gray-600">Daily financial insights sent to your phone</p>
      </div>

      <form action={signUpAction} className="space-y-4">
        {/* Hidden tracking token field */}
        <input type="hidden" name="trackingToken" value={trackingToken} />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName" className="text-sm">First Name</Label>
            <Input 
              name="firstName" 
              placeholder="John" 
              required 
              className="h-10 text-base"
            />
          </div>
          
          <div>
            <Label htmlFor="lastName" className="text-sm">Last Name</Label>
            <Input 
              name="lastName" 
              placeholder="Smith" 
              required 
              className="h-10 text-base"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input 
              name="email" 
              type="email"
              placeholder="you@example.com" 
              required 
              className="h-10 text-base"
            />
          </div>
          
          <div>
            <Label htmlFor="phone" className="text-sm">Phone Number</Label>
            <Input 
              name="phone" 
              type="tel"
              placeholder="(555) 123-4567" 
              required
              pattern="[0-9\s\(\)\-\+\.]+"
              title="Please enter a valid phone number"
              className="h-10 text-base"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="password" className="text-sm">Password</Label>
          <Input
            type="password"
            name="password"
            placeholder="Create a password"
            required
            className="h-10 text-base"
          />
        </div>
        
        <AuthSubmitButton 
          idleText="Start Getting Money Texts" 
          loadingText="Creating account..." 
          className="w-full h-12 text-base font-semibold"
        />
        
        {message && <FormMessage message={message} />}
      </form>
      
      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-sm text-muted-foreground">Or</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>
      
      {/* Google Sign-Up */}
      <div>
        <GoogleSignInButton text="Sign up with Google" className="w-full h-10" />
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-blue-800 text-center">
          ✅ Secure bank-level encryption<br/>
          ✅ No access to your money<br/>
          ✅ Cancel anytime
        </p>
      </div>
      
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <Link className="text-blue-600 font-medium underline" href="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function HomepageSignUpForm() {
  return (
    <Suspense fallback={<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-lg animate-pulse h-96"></div>}>
      <SignUpFormContent />
    </Suspense>
  );
}