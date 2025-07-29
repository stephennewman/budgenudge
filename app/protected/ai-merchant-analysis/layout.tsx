import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merchant Spending Analysis | AI-Powered Money Texts Insights | Krezzo",
  description: "Analyze your merchant spending patterns with AI-powered insights. See which merchants drive your money texts alerts and track spending trends.",
  keywords: "merchant spending analysis, AI financial insights, money texts data, spending patterns, Krezzo",
};

export default function AIMerchantAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 