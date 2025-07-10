// DISABLED FOR PERFORMANCE - Subscription feature
// import { createUpdateClient } from "@/utils/update/server";
// import { Button } from "@/components/ui/button";
// import { Card } from "@/components/ui/card";
// import PaidContentCard from "@/components/paid-content-card";

export default async function PaidContent() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-600 mb-4">💳 Paid Content</h1>
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
          Disabled: Subscription management, paid content access
        </div>
      </div>
    </div>
  );
}

/* COMMENTED OUT FOR PERFORMANCE:

import { createUpdateClient } from "@/utils/update/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PaidContentCard from "@/components/paid-content-card";

export default async function PaidContent() {
  const client = await createUpdateClient();
  const { data, error } = await client.entitlements.check("premium");

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-red-600">Error</h2>
          <p className="mt-2 text-muted-foreground">
            There was an error fetching your subscriptions.
          </p>
        </Card>
      </div>
    );
  }

  if (!data.hasAccess) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">No Access</h2>
          <p className="mt-2 text-muted-foreground">
            You don&apos;t have access to any paid content.
          </p>
          <Button className="mt-4" variant="outline">
            Upgrade Now
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-medium">Cat Photo Generator</h1>
        <p className="text-muted-foreground mt-2">Generate cat photos</p>
      </div>
      <PaidContentCard className="mt-4" />
    </div>
  );
}

*/
