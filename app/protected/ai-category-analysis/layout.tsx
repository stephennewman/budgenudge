import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Category Spending Analysis | AI Money Texts Insights | Krezzo",
  description: "Analyze your spending by category with AI-powered insights. See which categories trigger your money texts alerts and track spending trends.",
  keywords: "category spending analysis, AI financial insights, money texts data, spending categories, Krezzo",
};

export default function AICategoryAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 