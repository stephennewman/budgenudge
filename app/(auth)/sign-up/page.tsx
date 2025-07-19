import { signUpAction } from "@/app/actions";
import AuthSubmitButton from "@/components/auth-submit-button";
import GoogleSignInButton from "@/components/google-sign-in-button";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function SignUp(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;

  return (
    <form
      className="flex-1 flex flex-col w-full max-w-sm mx-auto mt-24"
      action={signUpAction}
    >
      <h1 className="text-2xl font-medium">Sign up</h1>
      <p className="text-sm text-foreground">
        Already have an account?{" "}
        <Link className="text-foreground font-medium underline" href="/sign-in">
          Sign in
        </Link>
      </p>
      
      {/* Google Sign-Up */}
      <div className="mt-8">
        <GoogleSignInButton text="Sign up with Google" />
      </div>
      
      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-sm text-muted-foreground">Or continue with email</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>
      
      <div className="flex flex-col gap-2 [&>input]:mb-3">
        <Label htmlFor="email">Email</Label>
        <Input name="email" placeholder="you@example.com" required />
        
        <Label htmlFor="phone">Phone Number</Label>
        <Input 
          name="phone" 
          type="tel" 
          placeholder="(555) 123-4567" 
          required 
          pattern="[0-9\s\-\(\)]{10,}"
          title="Please enter a valid phone number"
        />
        
        <div className="flex justify-between items-center">
          <Label htmlFor="password">Password</Label>
        </div>
        <Input
          type="password"
          name="password"
          placeholder="Your password"
          required
        />
        <AuthSubmitButton 
          idleText="Sign up" 
          loadingText="Creating account..." 
        />
        <FormMessage message={searchParams} />
      </div>
    </form>
  );
}
