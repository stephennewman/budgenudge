"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export default function HomepageSlickTextForm() {
  const pathname = usePathname();
  
  // Only render on homepage
  if (pathname !== '/') {
    return null;
  }
  
  return (
    <div className="mb-12 flex justify-center">
      <div id="homepage-slicktext-form" className="w-full max-w-md">
        <Script
          src="https://static.slicktext.com/forms/scripts/embed/eyJ1cmwiOiJodHRwczpcL1wvc3Rmb3Jtcy5jb1wvNWEzZmFhZDExMGZiMjM5N2U5NjA1YzlmMTM2MjkzYzMifQ"
          strategy="lazyOnload"
        />
      </div>
    </div>
  );
} 