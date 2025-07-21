import { BouncingMoneyLoader } from "@/components/ui/bouncing-money-loader";

export default function PricingLoading() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-medium">Pricing Plans</h1>
        <p className="text-muted-foreground mt-2">
          Choose the perfect plan for your needs
        </p>
      </div>

      <div className="flex items-center justify-center h-full">
        <BouncingMoneyLoader text="Loading pricing plans..." />
      </div>
    </>
  );
}
