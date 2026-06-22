/**
 * Superadmin authentication utilities
 * For SMS Feed monitoring and other admin-only features
 */

// Superadmin user ID.
// Sourced from NEXT_PUBLIC_SUPERADMIN_USER_ID (so the value is consistent
// across server and client components); falls back to the original value so
// existing deployments keep working until the env var is configured.
const SUPERADMIN_USER_ID =
  process.env.NEXT_PUBLIC_SUPERADMIN_USER_ID ||
  'bc474c8b-4b47-4c7d-b202-f469330af2a2';

/**
 * Check if a user ID belongs to the superadmin
 */
export function isSuperAdmin(userId: string): boolean {
  return userId === SUPERADMIN_USER_ID;
}

/**
 * Get the superadmin user ID (for testing/reference)
 */
export function getSuperAdminId(): string {
  return SUPERADMIN_USER_ID;
}

/**
 * Validate superadmin access for API routes
 * Throws error if not superadmin
 */
export function validateSuperAdminAccess(userId: string): void {
  if (!isSuperAdmin(userId)) {
    throw new Error('Unauthorized: Superadmin access required');
  }
}
