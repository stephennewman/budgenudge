/**
 * The two gates on the Red Fern demo.
 *
 * The outer one covers the whole section: nothing under /red-fern or
 * /api/red-fern answers until a visitor has entered the house code, so the
 * demo can sit on a public deploy without being something a stranger can find.
 * The inner one covers the family's own book — guest names, phone numbers and
 * money — and also signs the subscribable calendar feed, because a calendar
 * client can only carry a secret in a query string.
 *
 * Both fall back to a published default when nothing is configured, so a fresh
 * checkout runs, and both pages say on screen which code they're using rather
 * than locking a demo behind a secret nobody set.
 */

/** Cookie holding the code a visitor typed at /red-fern/enter. */
export const SITE_COOKIE = "red_fern_pass";

/** How long a visitor stays past the gate. */
export const SITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const DEMO_SITE_CODE = "redfern";
export const DEMO_SCHEDULE_CODE = "redfern";

/** Code for the section as a whole. */
export function siteCode(): string {
  return process.env.RED_FERN_SITE_CODE || DEMO_SITE_CODE;
}

/** True when the outer gate is still on the published demo code. */
export function isDemoSiteCode(): boolean {
  return !process.env.RED_FERN_SITE_CODE;
}

/** Code for the private schedule and the calendar feed. */
export function scheduleCode(): string {
  return process.env.RED_FERN_SCHEDULE_CODE || DEMO_SCHEDULE_CODE;
}

/** True when the schedule gate is still on the published demo code. */
export function isDemoCode(): boolean {
  return !process.env.RED_FERN_SCHEDULE_CODE;
}

/**
 * Compares in time that doesn't depend on how much of the code matched.
 * Overkill for a demo, cheap enough to do anyway.
 */
export function codeMatches(given: string | undefined, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}
