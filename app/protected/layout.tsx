import ProtectedSidebar from "@/components/protected-sidebar";
import MobileNavMenu from "@/components/mobile-nav-menu";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Money Texts Dashboard | Your Financial Overview | Krezzo",
  description: "View your money texts dashboard with transaction history, account balances, and upcoming financial alerts.",
  keywords: "money texts dashboard, financial overview, transaction history, Krezzo account",
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navItems = [
    {
      label: "🏠 Account",
      href: "/",
    },
    {
      label: "💳 Transactions",
      href: "/transactions",
    },
    {
      label: "🗂️ Categories",
      href: "/ai-category-analysis",
    },
    {
      label: "🏪 Merchants",
      href: "/ai-merchant-analysis",
    },
    {
      label: "⭐ Bills",
      href: "/recurring-bills",
    },
    {
      label: "📱 Texts",
      href: "/sms-preferences",
    },
  ];

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
