/**
 * Production delivery of launch invites: Resend send + per-subscriber receipts.
 *
 * Kept out of invite.ts so the planner stays free of Next.js and Supabase
 * imports and the unit tests can still compile it with plain tsc.
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { EMAIL_FROM_ALERTS, SITE_URL } from "@/lib/brand";
import {
  applyInviteReceipts,
  planLaunchInvites,
  sendLaunchInvites,
  type InvitableLaunch,
  type InviteEmail,
  type PlannedInvite,
  type SendResult,
} from "@/utils/launches/invite";

/** Resend reads `content_type`; the SDK's own type only declares `contentType`. */
type ResendAttachment = { filename: string; content: string; content_type: string };

export const ORGANIZER = { email: "alerts@krezzo.com", name: "Krezzo Launch Calendar" };

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export function canSendLaunchInvites(): boolean {
  return process.env.VERCEL_ENV === "production" && Boolean(process.env.RESEND_API_KEY);
}

export async function listLaunchSubscriberEmails(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase.from("launch_subscribers").select("email");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.email as string);
}

export async function loadInviteReceipts(
  supabase: SupabaseClient,
  email: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("launch_invite_receipts")
    .select("launch_id, invited_sequence")
    .eq("email", email);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    (data ?? []).map((row) => [row.launch_id as string, row.invited_sequence as number])
  );
}

export function planInvitesForSubscriber(
  launches: InvitableLaunch[],
  receipts: Record<string, number>,
  options: { now?: Date; limit?: number } = {}
): PlannedInvite[] {
  return planLaunchInvites(applyInviteReceipts(launches, receipts), options);
}

export async function sendPlannedInvitesToEmail(
  supabase: SupabaseClient,
  to: string,
  planned: PlannedInvite[],
  now: Date
): Promise<SendResult> {
  if (planned.length === 0) return { sent: [], failed: [] };

  return sendLaunchInvites(planned, {
    to,
    from: EMAIL_FROM_ALERTS,
    organizer: ORGANIZER,
    subscribeUrl: `${SITE_URL}/launches`,
    now,
    send: async (email: InviteEmail) => {
      const { error } = await getResend().emails.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments as unknown as ResendAttachment[],
      });
      return { error: error ? error.message : null };
    },
    record: async (launchId, sequence) => {
      const { error } = await supabase.from("launch_invite_receipts").upsert(
        {
          email: to,
          launch_id: launchId,
          invited_sequence: sequence,
          invited_at: now.toISOString(),
        },
        { onConflict: "email,launch_id" }
      );
      if (error) throw new Error(`sent but not recorded: ${error.message}`);
    },
  });
}
