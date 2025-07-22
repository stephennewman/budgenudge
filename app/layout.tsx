import type { Metadata } from "next";
import "./globals.css";
import ConditionalHeader from "@/components/conditional-header";
import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"] });

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
      title: "Krezzo - Real-Time Transaction Monitoring",
  description: "Get instant SMS alerts for all your financial transactions with automated Plaid webhook integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.className}>
        <ConditionalHeader />
        {children}
      </body>
    </html>
  );
}
