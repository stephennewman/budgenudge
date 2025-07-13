import InPageSidebar from "@/components/in-page-sidebar";
// DISABLED FOR PERFORMANCE: Subscription features
// import { createUpdateClient } from "@/utils/update/server";

export default async function ProtectedSidebar() {
  // DISABLED FOR PERFORMANCE: Subscription entitlement check
  // const client = await createUpdateClient();
  // const { data } = await client.entitlements.check("premium");

  return (
    <InPageSidebar
      basePath="/protected"
      items={[
        {
          label: "🏠 Dashboard",
          href: "/",
        },
        {
          label: "💳 Transactions",
          href: "/transactions",
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
          label: "⭐ Recurring Bills",
          href: "/recurring-bills",
        },
        {
          label: "📱 SMS Preferences",
          href: "/sms-preferences",
        },
        // REMOVED FOR PERFORMANCE: Subscription/paid features
        // {
        //   label: "Pricing",
        //   href: "/pricing",
        // },
        // {
        //   label: "Subscription",
        //   href: "/subscription",
        // },
        // {
        //   label: "Paid Content",
        //   href: "/paid-content",
        //   disabled: data != null && !data.hasAccess,
        // },
        {
          label: "🧪 Test Suite",
          href: "/test-suite",
        },
      ]}
    />
  );
}
