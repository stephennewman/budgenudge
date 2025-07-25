// DISABLED FOR PERFORMANCE - Subscription pricing feature
// import { createUpdateClient } from "@/utils/update/server";
// import PricingContent from "@/components/pricing-content";

export default async function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">💰 Pricing Plans</h1>
        <p className="text-gray-500 mb-6">This feature has been temporarily disabled to improve app performance.</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-yellow-700">
            <strong>Core functionality available:</strong><br/>
            • Real-time transaction monitoring<br/>
            • SMS notifications<br/>
            • Basic transaction dashboard
          </p>
        </div>
        <div className="mt-6 text-xs text-gray-400">
          Disabled: Subscription pricing, billing management
        </div>
      </div>
    </div>
  );
}

/* COMMENTED OUT FOR PERFORMANCE:

import { createUpdateClient } from "@/utils/update/server";
import PricingContent from "@/components/pricing-content";

export default async function PricingPage() {
  const client = await createUpdateClient();
  const { data, error } = await client.billing.getProducts();
  const { data: subscriptionData } = await client.billing.getSubscriptions();

  if (error) {
    return <div>There was an error loading products. Please try again.</div>;
  }

  const currentProductId =
    subscriptionData.subscriptions == null ||
    subscriptionData.subscriptions.length === 0
      ? null
      : subscriptionData.subscriptions[0].product.id;

  return (
    <>
      <div>
        <h1 className="text-2xl font-medium">Pricing Plans</h1>
        <p className="text-muted-foreground mt-2">
          Choose the perfect plan for your needs
        </p>
      </div>

      <PricingContent
        products={data.products}
        currentProductId={currentProductId}
      />
    </>
  );
}

*/
