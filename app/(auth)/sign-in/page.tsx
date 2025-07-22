import { signInAction } from "@/app/actions";
import AuthSubmitButton from "@/components/auth-submit-button";
import GoogleSignInButton from "@/components/google-sign-in-button";
import { FormMessage, Message } from "@/components/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function SignIn(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;

  return (
    <form
      className="flex-1 flex flex-col w-full max-w-sm mx-auto mt-8"
      action={signInAction}
    >
      <h1 className="text-2xl font-medium">Sign in</h1>
      
      <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
        <Label htmlFor="email">Email</Label>
        <Input name="email" placeholder="you@example.com" required />
        <div className="flex justify-between items-center">
          <Label htmlFor="password">Password</Label>
        </div>
        <Input
          type="password"
          name="password"
          placeholder="Your password"
          required
        />
        <AuthSubmitButton />
        <FormMessage message={searchParams} />
      </div>
      
      {/* Navigation Link */}
      <p className="text-sm text-foreground text-center mt-4">
        Don&apos;t have an account?{" "}
        <Link className="text-foreground font-medium underline" href="/sign-up">
          Sign up
        </Link>
      </p>
      
      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border"></div>
        <span className="text-sm text-muted-foreground">Or</span>
        <div className="flex-1 h-px bg-border"></div>
      </div>
      
      {/* Google Sign-In */}
      <div>
        <GoogleSignInButton text="Continue with Google" />
      </div>
    </form>
  );
}
