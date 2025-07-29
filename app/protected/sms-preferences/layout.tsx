import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Money Texts Preferences | Customize Your Financial Alerts | Krezzo",
  description: "Customize your money texts preferences. Choose which financial alerts you want to receive and when. Bills, spending, merchant pacing, and more.",
  keywords: "money texts preferences, financial alerts customization, SMS settings, Krezzo notifications",
};

export default function SMSPreferencesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 