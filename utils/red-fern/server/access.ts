/**
 * The gate on the private schedule.
 *
 * The family who runs the place needs to see guest names, phone numbers and
 * money; the public booking page must never show any of it. One shared code
 * covers the schedule page and the subscribable feed, because a calendar
 * client can only carry a secret in a query string anyway.
 *
 * With no code configured the demo falls back to a published default and says
 * so on the page, rather than locking the schedule behind a secret nobody set.
 */

export const DEMO_SCHEDULE_CODE = "redfern";

export function scheduleCode(): string {
  return process.env.RED_FERN_SCHEDULE_CODE || DEMO_SCHEDULE_CODE;
}

/** True when the gate is still on the published demo code. */
export function isDemoCode(): boolean {
  return !process.env.RED_FERN_SCHEDULE_CODE;
}
