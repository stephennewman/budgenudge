import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transaction History | Money Texts Data | Krezzo",
  description: "View your complete transaction history and spending data that powers your daily money texts. Track spending patterns and financial insights.",
  keywords: "transaction history, money texts data, spending tracking, financial insights, Krezzo",
};

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 