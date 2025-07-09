import Link from "next/link";

export default function CheckEmail() {
  return (
    <div className="flex-1 flex flex-col w-full max-w-sm mx-auto mt-24">
      <div className="text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-600 mb-8">
          We&apos;ve sent you a confirmation email. Please click the link in the email to verify your account and complete your sign up.
        </p>
        
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Didn&apos;t receive an email? Check your spam folder or{" "}
            <Link href="/sign-up" className="text-blue-600 hover:text-blue-500 underline">
              try signing up again
            </Link>
          </p>
          
          <div className="pt-4 border-t border-gray-200">
            <Link 
              href="/sign-in" 
              className="text-sm text-gray-600 hover:text-gray-500 underline"
            >
              Already confirmed? Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 