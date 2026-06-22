/**
 * Shared authentication guards for API route handlers.
 *
 * Centralizes the three access patterns used across the API:
 *  - requireUser():       any signed-in user (session cookie)
 *  - requireSuperAdmin(): signed-in user that is the superadmin
 *  - isAuthorizedCron():  Vercel cron header or CRON_SECRET bearer token
 *
 * Guards that protect a request return either { user } on success or
 * { response } containing the NextResponse to return early.
 */
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/utils/supabase/server';
import { isSuperAdmin } from '@/utils/auth/superadmin';

export type GuardResult = { user: User } | { response: NextResponse };

export function isGuardFailure(
  result: GuardResult
): result is { response: NextResponse } {
  return 'response' in result;
}

/** Returns the signed-in user from the session cookie, or null. */
export async function getAuthedUser(): Promise<User | null> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require any signed-in user. */
export async function requireUser(): Promise<GuardResult> {
  const user = await getAuthedUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { user };
}

/** Require the signed-in user to be the superadmin. */
export async function requireSuperAdmin(): Promise<GuardResult> {
  const result = await requireUser();
  if (isGuardFailure(result)) return result;
  if (!isSuperAdmin(result.user.id)) {
    return {
      response: NextResponse.json(
        { error: 'Forbidden: Superadmin access required' },
        { status: 403 }
      ),
    };
  }
  return result;
}

/**
 * Require the signed-in user to either own `targetUserId` or be the superadmin.
 * Use for endpoints that accept an explicit userId in the request.
 */
export async function requireUserOrSuperAdmin(
  targetUserId: string | null | undefined
): Promise<GuardResult> {
  const result = await requireUser();
  if (isGuardFailure(result)) return result;
  if (
    targetUserId &&
    targetUserId !== result.user.id &&
    !isSuperAdmin(result.user.id)
  ) {
    return {
      response: NextResponse.json(
        { error: 'Forbidden: cannot act on behalf of another user' },
        { status: 403 }
      ),
    };
  }
  return result;
}

/** True when the request is an authorized Vercel cron invocation. */
export function isAuthorizedCron(request: Request): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const authHeader = request.headers.get('authorization');
  return (
    !!process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  );
}
