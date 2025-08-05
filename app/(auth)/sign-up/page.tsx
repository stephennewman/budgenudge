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

function SignUpForm() {
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
    <form
      className="flex-1 flex flex-col w-full max-w-sm sm:max-w-md mx-auto mt-6 sm:mt-8 px-4 sm:px-0"
      action={signUpAction}
    >
      <h1 className="text-2xl font-medium mb-2">Sign up</h1>
      <p className="text-sm text-muted-foreground mb-6 sm:mb-8">Create your account to get started</p>
      
      <div className="flex flex-col gap-4 sm:gap-2 [&>input]:mb-3 mt-2">
        {/* Hidden tracking token field */}
        <input type="hidden" name="trackingToken" value={trackingToken} />
        
        <Label htmlFor="email" className="text-base sm:text-sm">Email</Label>
        <Input 
          name="email" 
          placeholder="you@example.com" 
          required 
          className="h-12 sm:h-10 text-base"
        />
        
        <Label htmlFor="phone" className="text-base sm:text-sm">
          Phone Number 
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input 
          name="phone" 
          type="tel"
          placeholder="(555) 123-4567" 
          className="h-12 sm:h-10 text-base"
        />
        
        <div className="flex justify-between items-center">
          <Label htmlFor="password" className="text-base sm:text-sm">Password</Label>
        </div>
        <Input
          type="password"
          name="password"
          placeholder="Your password"
          required
          className="h-12 sm:h-10 text-base"
        />
        <AuthSubmitButton 
          idleText="Sign up" 
          loadingText="Creating account..." 
          className="h-12 sm:h-10 mt-2"
        />
        {message && <FormMessage message={message} />}
      </div>
      
      {/* Navigation Link */}
      <p className="text-sm text-foreground text-center mt-6 sm:mt-4">
        Already have an account?{" "}
        <Link className="text-foreground font-medium underline" href="/sign-in">
          Sign in
        </Link>
      </p>
      
      {/* Divider */}
      <div className="flex items-center gap-4 my-8 sm:my-6">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-sm text-muted-foreground">Or</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>
      
      {/* Google Sign-Up */}
      <div>
        <GoogleSignInButton text="Sign up with Google" className="h-12 sm:h-10" />
      </div>
    </form>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
