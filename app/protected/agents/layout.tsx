import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financial AI Agents | Hire Your Financial Team | Krezzo",
  description: "Choose and hire your personalized financial AI agents. Each agent has specific expertise to help you master your finances.",
  keywords: "financial AI agents, financial advisors, money management, budgeting, Krezzo",
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
