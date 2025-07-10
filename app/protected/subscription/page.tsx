// DISABLED FOR PERFORMANCE - Subscription management feature
// import SubscriptionActions from "@/components/subcription-actions";
// import { Card } from "@/components/ui/card";
// import { cn } from "@/utils/styles";
// import { createUpdateClient } from "@/utils/update/server";

export default async function Page() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">⚙️ Subscription Management</h1>
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
          Disabled: Subscription status, billing actions, plan management
        </div>
      </div>
    </div>
  );
}

/* COMMENTED OUT FOR PERFORMANCE:

import SubscriptionActions from "@/components/subcription-actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/utils/styles";
import { createUpdateClient } from "@/utils/update/server";

export default async function Page() {
  const client = await createUpdateClient();
  const { data, error } = await client.billing.getSubscriptions();

  if (error) {
    return (
      <div>
        There was an error loading your subscriptions. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">Subscriptions</h1>
          <p className="text-muted-foreground mt-2">
            Manage your subscription plans
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {data.subscriptions.map((subscription, index) => (
          <Card key={index}>
            <h2 className="font-medium">{subscription.product.name}</h2>
            <div className="grid gap-2 mt-2 text-sm">
              <div className="grid grid-cols-[150px_1fr]">
                <div className="text-muted-foreground">Plan description</div>
                <div>{subscription.product.description}</div>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <div className="text-muted-foreground">Price</div>
                <div>
                  ${(subscription.price.unit_amount / 100).toFixed(2)} per{" "}
                  {subscription.price.interval}
                </div>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <div className="text-muted-foreground">Status</div>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full bg-green-500",
                      (subscription.status === "past_due" ||
                        subscription.cancel_at_period_end) &&
                        "bg-yellow-500",
                      subscription.status === "inactive" && "bg-red-500"
                    )}
                  ></div>
                  {subscription.status === "active" &&
                    !subscription.cancel_at_period_end &&
                    "Active"}
                  {subscription.status === "active" &&
                    subscription.cancel_at_period_end &&
                    "Cancelling at period end"}
                  {subscription.status === "past_due" && "Past due"}
                  {subscription.status === "inactive" && "Inactive"}
                </div>
              </div>
              <SubscriptionActions subscription={subscription} />
            </div>
          </Card>
        ))}
      </div>
      <div>
        <h3 className="text-lg font-medium">Raw Data</h3>
        <div className="mt-2 border p-4 rounded-lg">
          <pre>{JSON.stringify(data.subscriptions, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

*/
