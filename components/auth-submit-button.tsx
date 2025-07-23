"use client";

import { Button } from "@/components/ui/button";
import { useFormStatus } from "react-dom";
import { cn } from "@/utils/styles";

interface AuthSubmitButtonProps {
  idleText?: string;
  loadingText?: string;
  className?: string;
}

export default function AuthSubmitButton({ 
  idleText = "Sign in", 
  loadingText = "Signing in...",
  className
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" aria-disabled={pending} className={cn(className)}>
      {pending ? loadingText : idleText}
    </Button>
  );
}
