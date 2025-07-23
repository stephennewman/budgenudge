import Image from "next/image";
import { cn } from "@/utils/styles";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "h-4", // 16px - very compact
  sm: "h-6", // 24px - navigation bars  
  md: "h-8", // 32px - standard usage
  lg: "h-12", // 48px - featured areas
  xl: "h-16", // 64px - hero sections
};

export default function Logo({ size = "md", className }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="Krezzo"
      width={812}
      height={200}
      className={cn(
        "w-auto object-contain",
        sizeClasses[size],
        className
      )}
      priority
    />
  );
} 