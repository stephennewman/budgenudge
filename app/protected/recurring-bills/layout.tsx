import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recurring Bills & Payments | Money Texts Bill Tracking | Krezzo",
  description: "Track your recurring bills and payments. See which bills trigger your money texts alerts and manage upcoming payment reminders.",
  keywords: "recurring bills, payment tracking, money texts alerts, bill reminders, Krezzo",
};

export default function RecurringBillsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 