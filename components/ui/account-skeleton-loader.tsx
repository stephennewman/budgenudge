"use client";

import React from "react";
import { cn } from "@/utils/styles";

interface AccountSkeletonLoaderProps {
  className?: string;
  isLoading?: boolean;
  accountGroups?: number;
  accountsPerGroup?: number;
}

export function AccountSkeletonLoader({
  className,
  isLoading = true,
  accountGroups = 2,
  accountsPerGroup = 2,
}: AccountSkeletonLoaderProps) {
  if (!isLoading) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Generate skeleton groups */}
      {Array.from({ length: accountGroups }).map((_, groupIndex) => (
        <div key={groupIndex} className="border rounded-lg p-4">
          {/* Bank Header Skeleton */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {/* Green dot skeleton */}
              <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse"></div>
              <div>
                {/* Account count skeleton */}
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
          
          {/* Account List Skeletons */}
          <div className="space-y-2">
            {Array.from({ length: accountsPerGroup }).map((_, accountIndex) => (
              <div 
                key={accountIndex}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                {/* Account Info Skeleton */}
                <div className="flex-1">
                  {/* Account name skeleton */}
                  <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                  {/* Account type skeleton */}
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Balance Area Skeleton */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {/* Available balance skeleton */}
                    <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-1"></div>
                    {/* Current balance skeleton */}
                    <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  {/* Remove button skeleton */}
                  <div className="h-8 w-8 rounded bg-gray-200 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 