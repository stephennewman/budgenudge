import { BouncingMoneyLoader } from "@/components/ui/bouncing-money-loader";

export default function SubscriptionLoading() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-medium">Subscriptions</h1>
          <p className="text-muted-foreground mt-2">
            Manage your subscription plans
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center h-full">
        <BouncingMoneyLoader text="Loading subscription info..." />
      </div>
    </>
  );
}
