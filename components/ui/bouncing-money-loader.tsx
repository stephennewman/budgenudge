"use client";

import React from "react";
import { cn } from "@/utils/styles";

export function BouncingMoneyLoader({
  className,
  isLoading = true,
  showText = true,
  text = "Loading...",
}: {
  className?: string;
  isLoading?: boolean;
  showText?: boolean;
  text?: string;
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

        @keyframes coinFloat1 {
          0%, 100% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 0.8;
          }
          25% {
            transform: translateY(-8px) rotate(90deg) scale(1.1);
            opacity: 1;
          }
          50% {
            transform: translateY(-4px) rotate(180deg) scale(0.9);
            opacity: 0.6;
          }
          75% {
            transform: translateY(-12px) rotate(270deg) scale(1.2);
            opacity: 0.9;
          }
        }

        @keyframes coinFloat2 {
          0%, 100% {
            transform: translateY(0) rotate(0deg) scale(0.8);
            opacity: 0.6;
          }
          33% {
            transform: translateY(-6px) rotate(120deg) scale(1);
            opacity: 1;
          }
          66% {
            transform: translateY(-2px) rotate(240deg) scale(0.7);
            opacity: 0.8;
          }
        }

        @keyframes coinFloat3 {
          0%, 100% {
            transform: translateY(0) rotate(0deg) scale(0.7);
            opacity: 0.5;
          }
          40% {
            transform: translateY(-4px) rotate(144deg) scale(0.9);
            opacity: 0.8;
          }
          80% {
            transform: translateY(-1px) rotate(288deg) scale(0.6);
            opacity: 0.7;
          }
        }

        .money-bag-bounce {
          animation: growingBounce 2s ease-in-out infinite;
          transform-origin: bottom center;
        }

        .coin-float-1 {
          animation: coinFloat1 3s ease-in-out infinite;
        }

        .coin-float-2 {
          animation: coinFloat2 3.5s ease-in-out infinite;
        }

        .coin-float-3 {
          animation: coinFloat3 2.5s ease-in-out infinite;
        }
      `}</style>
      
      <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
        {/* Bouncing Money Bag Container */}
        <div className="relative">
          {/* Main Money Bag */}
          <div className="money-bag-bounce">
            <div className="text-4xl select-none">💰</div>
          </div>
          
          {/* Floating Coins */}
          <div className="absolute -top-2 -right-1 coin-float-1">
            <div className="text-sm">🪙</div>
          </div>
          <div className="absolute -top-1 -left-2 coin-float-2">
            <div className="text-xs">🪙</div>
          </div>
          <div className="absolute top-1 right-2 coin-float-3">
            <div className="text-xs opacity-70">🪙</div>
          </div>
        </div>

        {/* Loading Text */}
        {showText && (
          <p className="text-muted-foreground font-medium animate-pulse">
            {text}
          </p>
        )}
      </div>
    </>
  );
} 