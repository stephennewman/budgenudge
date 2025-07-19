"use client";

import { Button } from "@/components/ui/button";
import { useFormStatus } from "react-dom";

interface AuthSubmitButtonProps {
  idleText?: string;
  loadingText?: string;
}

export default function AuthSubmitButton({ 
  idleText = "Sign in", 
  loadingText = "Signing in..." 
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" aria-disabled={pending}>
      {pending ? loadingText : idleText}
    </Button>
  );
}
