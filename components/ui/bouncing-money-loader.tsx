"use client";

import React from "react";
import { cn } from "@/utils/styles";

export function BouncingMoneyLoader({
  className,
  isLoading = true,
}: {
  className?: string;
  isLoading?: boolean;
}) {
  if (!isLoading) return null;

  return (
    <>
      <style>{`
        @keyframes growingBounce {
          0% {
            transform: translateY(0) scale(1);
          }
          15% {
            transform: translateY(-20px) scale(1.1);
          }
          30% {
            transform: translateY(0) scale(1.2);
          }
          45% {
            transform: translateY(-15px) scale(1.3);
          }
          60% {
            transform: translateY(0) scale(1.4);
          }
          75% {
            transform: translateY(-10px) scale(1.5);
          }
          90% {
            transform: translateY(0) scale(1.6);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        .money-bag-bounce {
          animation: growingBounce 2s ease-in-out infinite;
          transform-origin: bottom center;
        }
      `}</style>
      
      <div className={cn("flex items-center justify-center min-h-[200px]", className)}>
        <div className="money-bag-bounce">
          <div className="text-6xl select-none">💰</div>
        </div>
      </div>
    </>
  );
} 