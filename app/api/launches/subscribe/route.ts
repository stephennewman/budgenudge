import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  canSendLaunchInvites,
  loadInviteReceipts,
  planInvitesForSubscriber,
  sendPlannedInvitesToEmail,
} from "@/utils/launches/deliver";
import { DEFAULT_INVITE_COUNT, normalizeInviteEmail, type InvitableLaunch } from "@/utils/launches/invite";

export const maxDuration = 60;

const inviteCount = () => {
  const parsed = Number(process.env.LAUNCH_INVITE_COUNT);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_INVITE_COUNT;
};

export async function POST(request: NextRequest) {
  let body: { email?: string; website?: string };
  try {
    body = (await request.json()) as { email?: string; website?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields; pretend it worked.
  if (body.website) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const email = normalizeInviteEmail(body.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: upsertError } = await supabase
    .from("launch_subscribers")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { data: launches, error: launchError } = await supabase
    .from("launch_schedule")
    .select("*")
    .limit(2000);
  if (launchError) {
    return NextResponse.json({ error: launchError.message }, { status: 500 });
  }

  const receipts = await loadInviteReceipts(supabase, email);
  const planned = planInvitesForSubscriber((launches ?? []) as InvitableLaunch[], receipts, {
    limit: inviteCount(),
  });

  if (planned.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      alreadySubscribed: Object.keys(receipts).length > 0,
    });
  }

  if (!canSendLaunchInvites()) {
    return NextResponse.json({
      success: true,
      sent: 0,
      queued: true,
    });
  }

  const result = await sendPlannedInvitesToEmail(supabase, email, planned, new Date());
  if (result.failed.length > 0 && result.sent.length === 0) {
    return NextResponse.json(
      { error: result.failed[0]?.error ?? "Could not send invites" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    sent: result.sent.length,
    failed: result.failed.length,
  });
}
