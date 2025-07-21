import { BouncingMoneyLoader } from "@/components/ui/bouncing-money-loader";

export default function PaidContentLoading() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-medium">Cat Photo Generator</h1>
        <p className="text-muted-foreground mt-2">Generate cat photos</p>
      </div>
      <div className="flex items-center justify-center h-full">
        <BouncingMoneyLoader text="Loading premium content..." />
      </div>
    </>
  );
}
