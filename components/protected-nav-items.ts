/**
 * Single source of truth for the protected dashboard navigation.
 * Consumed by both the desktop sidebar (protected-sidebar.tsx) and the
 * mobile nav (protected/layout.tsx) so the two never drift out of sync.
 */
export interface NavItem {
  label: string;
  href: string;
}

export const PROTECTED_NAV_ITEMS: NavItem[] = [
  { label: "🏠 Account", href: "/" },
  { label: "💰 Income", href: "/income" },
  { label: "💸 Expenses", href: "/recurring-bills" },
  { label: "💳 Transactions", href: "/transactions" },
  { label: "🏪 Merchants", href: "/ai-merchant-analysis" },
  { label: "🗂️ Categories", href: "/ai-category-analysis" },
  { label: "🎯 Pacing", href: "/pacing" },
  { label: "📊 Insights", href: "/insights" },
  { label: "📈 Trends", href: "/merchant-weekly-report" },
  { label: "💰 Flow", href: "/flow" },
  { label: "📱 Texts", href: "/texts" },
  { label: "🧪 SMS Builder", href: "/simple-builder" },
  { label: "🛒 Deals", href: "/deals" },
];

const SUPERADMIN_NAV_ITEM: NavItem = { label: "📡 Feed", href: "/admin-feed" };

/** Returns the nav items, appending superadmin-only entries when applicable. */
export function getProtectedNavItems(isSuperAdmin: boolean): NavItem[] {
  return isSuperAdmin
    ? [...PROTECTED_NAV_ITEMS, SUPERADMIN_NAV_ITEM]
    : PROTECTED_NAV_ITEMS;
}
