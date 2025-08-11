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
            label: "🤖 Agents",
            href: "/agents",
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
            label: "📱 Texts",
            href: "/sms-preferences",
          },
        ]}
      />
    </div>
  );
}
