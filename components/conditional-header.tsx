"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/header";

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Hide header for protected routes since we have sidebar navigation
  if (pathname.startsWith('/protected')) {
    return null;
  }
  
  // Hide header for plaid success page for clean onboarding experience
  if (pathname === '/plaid-success') {
    return null;
  }
  
  // Hide header for sign-up page for clean design with custom background
  if (pathname === '/sign-up') {
    return null;
  }
  
  return <Header />;
} 