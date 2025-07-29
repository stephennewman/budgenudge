import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merchant Spending Analysis | Money Texts Insights | Krezzo",
  description: "Analyze your merchant spending patterns with intelligent insights. See which merchants drive your money texts alerts and track spending trends.",
  keywords: "merchant spending analysis, financial insights, money texts data, spending patterns, Krezzo",
};

export default function AIMerchantAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 