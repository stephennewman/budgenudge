import InPageSidebar from "@/components/in-page-sidebar";
import { createSupabaseClient } from "@/utils/supabase/server";
import { isSuperAdmin } from "@/utils/auth/superadmin";
// DISABLED FOR PERFORMANCE: Subscription features
// import { createUpdateClient } from "@/utils/update/server";

export default async function ProtectedSidebar() {
  // DISABLED FOR PERFORMANCE: Subscription entitlement check
  // const client = await createUpdateClient();
  // const { data } = await client.entitlements.check("premium");

  // Check if current user is superadmin to show Feed
  let isUserSuperAdmin = false;
  try {
    const supabase = await createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    isUserSuperAdmin = user ? isSuperAdmin(user.id) : false;
  } catch (error) {
    console.error('Error checking superadmin status:', error);
  }

  const baseItems = [
    {
      label: "🏠 Account",
      href: "/",
    },
    {
      label: "💰 Income",
      href: "/income",
    },
    {
      label: "💸 Expenses",
      href: "/recurring-bills",
    },
    {
      label: "💳 Transactions",
      href: "/transactions",
    },
    {
      label: "🏪 Merchants",
      href: "/ai-merchant-analysis",
    },
    {
      label: "🗂️ Categories",
      href: "/ai-category-analysis",
    },
    {
      label: "📊 Insights",
      href: "/insights",
    },
    {
      label: "📱 Texts",
      href: "/texts",
    },
    {
      label: "🛒 Deals",
      href: "/deals",
    },
  ];

  // Add Feed for superadmin only
  const items = isUserSuperAdmin 
    ? [
        ...baseItems,
        {
          label: "📡 Feed",
          href: "/admin-feed",
        }
      ]
    : baseItems;

  return (
    <div className="hidden lg:block">
      <InPageSidebar
        basePath="/protected"
        items={items}
      />
    </div>
  );
}
