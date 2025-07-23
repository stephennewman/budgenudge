import Image from "next/image";
import { cn } from "@/utils/styles";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  xs: "h-6", // 24px
  sm: "h-8", // 32px  
  md: "h-10", // 40px
  lg: "h-12", // 48px
  xl: "h-16", // 64px
};

export default function Logo({ size = "md", className }: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="Krezzo"
      width={349}
      height={77}
      className={cn(
        "w-auto object-contain",
        sizeClasses[size],
        className
      )}
      priority
    />
  );
} 