import ProtectedSidebar from "@/components/protected-sidebar";
import MobileNavMenu from "@/components/mobile-nav-menu";
import { createSupabaseClient } from "@/utils/supabase/server";
import { isSuperAdmin } from "@/utils/auth/superadmin";
import { getProtectedNavItems } from "@/components/protected-nav-items";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Money Texts Dashboard | Your Financial Overview | Krezzo",
  description: "View your money texts dashboard with transaction history, account balances, and upcoming financial alerts.",
  keywords: "money texts dashboard, financial overview, transaction history, Krezzo account",
};

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if current user is superadmin to show Feed in mobile nav
  let isUserSuperAdmin = false;
  try {
    const supabase = await createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    isUserSuperAdmin = user ? isSuperAdmin(user.id) : false;
  } catch (error) {
    console.error('Error checking superadmin status for mobile nav:', error);
  }

  const navItems = getProtectedNavItems(isUserSuperAdmin);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full">
      {/* Mobile Navigation */}
      <MobileNavMenu basePath="/protected" items={navItems} />
      
      {/* Desktop Sidebar */}
      <ProtectedSidebar />
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:h-screen">
        <div className="p-4 sm:p-6 max-w-none min-h-screen lg:min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
