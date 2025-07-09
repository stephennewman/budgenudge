import { createSupabaseClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/protected";

  if (code) {
    const client = await createSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // User confirmed successfully - redirect to protected area
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      // Error confirming - redirect to sign in with error message
      return NextResponse.redirect(
        `${origin}/sign-in?message=Error confirming account. Please try signing in.`
      );
    }
  }

  // No code provided - redirect to sign in
  return NextResponse.redirect(`${origin}/sign-in`);
} 