"use server";

import { createSupabaseClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { encodedRedirect } from "@/utils/redirect";

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const client = await createSupabaseClient();

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/protected");
};

export const signUpAction = async (formData: FormData) => {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const phone = formData.get("phone") as string;
  const trackingToken = formData.get("trackingToken") as string;
  const client = await createSupabaseClient();

  // Use the correct URL for the current environment
  const url = process.env.NODE_ENV === 'production'
    ? "https://get.krezzo.com/auth/callback"
    : "http://localhost:3000/auth/callback";

  // Clean phone number if provided
  const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
  
  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: url,
      data: {
        sampleSmsToken: trackingToken || null,
        signupPhone: cleanPhone, // Store phone from signup form
        firstName: firstName, // Store first name from signup form
        lastName: lastName // Store last name from signup form
      }
    },
  });

  if (error) {
    return encodedRedirect("error", "/sign-up", error.message);
  }

  return redirect("/check-email");
};

export const googleSignInAction = async () => {
  const client = await createSupabaseClient();
  
  // Use the correct URL for the current environment
  const redirectTo = process.env.NODE_ENV === 'production'
    ? "https://get.krezzo.com/auth/callback"
    : "http://localhost:3000/auth/callback";

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", "Could not authenticate with Google");
  }

  if (data.url) {
    redirect(data.url); // Redirect to Google OAuth
  }
};

export const signOutAction = async () => {
  const client = await createSupabaseClient();
  await client.auth.signOut();
  return redirect("/sign-in");
};
