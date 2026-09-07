import { Cinzel, Cormorant_Garamond } from "next/font/google";

/**
 * Typography for the Red Fern pages.
 *
 * The sign at the gate is set in an inscriptional Roman capital, so Cinzel
 * carries the wordmark and the small caps that echo it. Cormorant Garamond —
 * the same lineage, easier to read in sentence case — handles headings. Body
 * copy stays on the app's sans.
 *
 * Scoped to this layout so the rest of the app doesn't pay to download them.
 */

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cinzel",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

export default function RedFernLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${cinzel.variable} ${cormorant.variable}`}>{children}</div>;
}
