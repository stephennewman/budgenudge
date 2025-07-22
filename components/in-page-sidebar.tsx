"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/styles";
import { Button } from "@/components/ui/button";
import { createSupabaseClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = {
  label: string;
  href: string;
  disabled?: boolean;
};

export default function InPageSidebar({
  basePath,
  items,
}: {
  basePath: string;
  items: Item[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-w-[250px] h-screen border-r bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <Link href="/" className="text-lg font-semibold">
          💰 BudgeNudge
        </Link>
      </div>
      
             {/* Navigation */}
       <div className="flex-1 p-4">
         <div className="flex flex-col gap-1">
           {items.map((item, index) => {
             const { label, href, disabled = false } = item;
             const fullHref = `${basePath}${href}`;
             const isActive =
               href === "/"
                 ? pathname === basePath || pathname === `${basePath}/`
                 : pathname === fullHref;
             return (
               <SidebarLink
                 key={`sidebar-item-${item.href}-${index}`}
                 href={fullHref}
                 label={label}
                 isActive={isActive}
                 isDisabled={disabled}
               />
             );
           })}
         </div>
       </div>

       {/* Footer */}
       <div className="p-4 border-t">
         <SignOutButton />
       </div>
     </div>
  );
}

function SidebarLink({
  href,
  label,
  isActive,
  isDisabled,
}: {
  href: string;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
}) {
  return (
    <>
      <Link
        href={href}
        onClick={e => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
        }}
        className={cn(
          "p-3 rounded-md text-sm text-gray-500 hover:text-foreground transition-colors block",
          isActive &&
            "bg-accent text-foreground font-medium hover:text-foreground",
          isDisabled && "text-gray-600 cursor-not-allowed hover:text-gray-700"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="leading-none">{label}</div>
        </div>
      </Link>
    </>
  );
}

function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseClient();

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button 
      onClick={signOut} 
      disabled={isSigningOut}
      variant="outline" 
      className="w-full"
    >
      {isSigningOut ? "Signing Out..." : "Sign Out"}
    </Button>
  );
}
