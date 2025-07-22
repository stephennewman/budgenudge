"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/header";

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Hide header for protected routes since we have sidebar navigation
  if (pathname.startsWith('/protected')) {
    return null;
  }
  
  return <Header />;
} 