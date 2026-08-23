/**
 * Single source of truth for brand identity, canonical URLs, and email senders.
 *
 * To change the domain or brand: update NEXT_PUBLIC_SITE_URL in Vercel and the
 * values below. Nothing else in the codebase should hardcode these.
 */

export const BRAND_NAME = "Krezzo";

/** Canonical app origin, no trailing slash. Set via NEXT_PUBLIC_SITE_URL in Vercel. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://get.krezzo.com"
).replace(/\/$/, "");

/** Host-only form for SMS copy where a bare "domain/path" reads better than a full URL. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/** Marketing root domain (apex). */
export const MARKETING_URL = "https://krezzo.com";

/** Transactional/alert emails (SMS fallbacks, verification, system messages). */
export const EMAIL_FROM_ALERTS = `${BRAND_NAME} <alerts@krezzo.com>`;

/** Digest/insight emails (daily/weekly summaries). */
export const EMAIL_FROM_INSIGHTS = `${BRAND_NAME} <insights@krezzo.com>`;
