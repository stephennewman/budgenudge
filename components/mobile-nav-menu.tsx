"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthPageSignOutButton from "@/components/auth-sign-out-button";
import Logo from "@/components/logo";

interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
}

interface MobileNavMenuProps {
  basePath: string;
  items: NavItem[];
}

export default function MobileNavMenu({ basePath, items }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="p-2"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu Drawer - Now slides from RIGHT */}
          <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-lg transform translate-x-0">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold">Navigation</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                {items.map((item) => {
                  const fullHref = `${basePath}${item.href}`;
                  const isActive = pathname === fullHref;
                  
                  return (
                    <li key={item.href}>
                      <Link
                        href={fullHref}
                        onClick={() => setIsOpen(false)}
                        className={`
                          block px-4 py-3 rounded-lg text-sm font-medium transition-colors
                          ${isActive 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                          ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Sign Out Button */}
            <div className="p-4 border-t">
              <AuthPageSignOutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
} 