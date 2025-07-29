import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Category Spending Analysis | Money Texts Insights | Krezzo",
  description: "Analyze your spending by category with intelligent insights. See which categories trigger your money texts alerts and track spending trends.",
  keywords: "category spending analysis, financial insights, money texts data, spending categories, Krezzo",
};

export default function AICategoryAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 