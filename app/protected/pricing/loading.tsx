import { BouncingMoneyLoader } from "@/components/ui/bouncing-money-loader";

export default function PricingLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <BouncingMoneyLoader />
    </div>
  );
}
