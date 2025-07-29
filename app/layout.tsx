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
  title: "Krezzo - Daily Money Texts | Stop Wondering Where Your Money Went",
  description: "Get daily money texts with your spending summary and upcoming bills. No apps needed - just simple SMS alerts that keep you financially aware.",
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
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
