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
import Image from "next/image";

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
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Background Image */}
      <Image
        src="/assets/pictures/blurred_background.png"
        alt="Blurred background"
        fill
        className="object-cover w-full h-full"
        priority
      />
      
      {/* Content Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm sm:max-w-md">
        {/* White Form Container */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <form
            className="flex flex-col w-full"
            action={signUpAction}
          >
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center text-gray-900">Sign up</h1>
            <p className="text-sm text-gray-600 mb-6 sm:mb-8 text-center">Create your account to get started</p>
            
            <div className="flex flex-col gap-4 sm:gap-4">
              {/* Hidden tracking token field */}
              <input type="hidden" name="trackingToken" value={trackingToken} />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name</Label>
                  <Input 
                    name="firstName" 
                    placeholder="John" 
                    required 
                    className="h-11 sm:h-12 text-base mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name</Label>
                  <Input 
                    name="lastName" 
                    placeholder="Smith" 
                    required 
                    className="h-11 sm:h-12 text-base mt-1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                  <Input 
                    name="email" 
                    placeholder="you@example.com" 
                    required 
                    className="h-11 sm:h-12 text-base mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                  <Input 
                    name="phone" 
                    type="tel"
                    placeholder="(555) 123-4567" 
                    required
                    pattern="[0-9\s\(\)\-\+\.]+"
                    title="Please enter a valid phone number"
                    className="h-11 sm:h-12 text-base mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <Input
                  type="password"
                  name="password"
                  placeholder="Your password"
                  required
                  className="h-11 sm:h-12 text-base mt-1"
                />
              </div>
              
              <AuthSubmitButton 
                idleText="Sign up" 
                loadingText="Creating account..." 
                className="h-11 sm:h-12 mt-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-semibold"
              />
              {message && <FormMessage message={message} />}
            </div>
            
            {/* Navigation Link */}
            <p className="text-sm text-gray-600 text-center mt-4 sm:mt-6">
              Already have an account?{" "}
              <Link className="text-blue-600 font-medium hover:text-blue-700 underline" href="/sign-in">
                Sign in
              </Link>
            </p>
            
            {/* Divider */}
            <div className="flex items-center gap-4 my-4 sm:my-6">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-sm text-gray-500">Or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>
            
            {/* Google Sign-Up */}
            <div>
              <GoogleSignInButton text="Sign up with Google" className="h-11 sm:h-12" />
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
