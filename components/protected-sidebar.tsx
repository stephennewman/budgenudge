import InPageSidebar from "@/components/in-page-sidebar";
// DISABLED FOR PERFORMANCE: Subscription features
// import { createUpdateClient } from "@/utils/update/server";

export default async function ProtectedSidebar() {
  // DISABLED FOR PERFORMANCE: Subscription entitlement check
  // const client = await createUpdateClient();
  // const { data } = await client.entitlements.check("premium");

  return (
    <div className="hidden lg:block">
      <InPageSidebar
        basePath="/protected"
        items={[
          {
            label: "🏠 Account",
            href: "/",
          },
          {
            label: "💳 Transactions",
            href: "/transactions",
          },
          // {
          //   label: "📊 Category Analysis",
          //   href: "/category-analysis",
          // },
          {
            label: "🗂️ Categories",
            href: "/ai-category-analysis",
          },
          {
            label: "🏪 Merchants",
            href: "/ai-merchant-analysis",
          },
          {
            label: "📊 Bubble Chart",
            href: "/merchant-spend-grid",
          },
          // REMOVED FOR PERFORMANCE: Heavy analytics features
          // {
          //   label: "Analysis",
          //   href: "/analysis",
          // },
          // {
          //   label: "Weekly Spending",
          //   href: "/weekly-spending",
          // },
          // {
          //   label: "Predictive Calendar",
          //   href: "/calendar",
          // },
          {
            label: "⭐ Bills",
            href: "/recurring-bills",
          },
          {
            label: "📱 Texts",
            href: "/sms-preferences",
          },
        ]}
      />
    </div>
  );
}
