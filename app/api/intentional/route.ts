import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createSupabaseClient } from "@/utils/supabase/server";
import { guessDueDate } from "@/utils/intentional/dates";

// Intentional — everything is a card.
//
// GET  → open cards + minutes logged today.
// POST json { action, ... }:
//   "capture"  { text, single? } → saves the raw text as a card immediately,
//              then (after responding) GPT types/estimates it, or splits a
//              transcript into cards that replace the raw note.
//   "update"   { id, fields }
//   "archive" | "restore" { id }
//   "complete" { id, started_at? } → done (habits: done for today); logs time
//              when started_at is given.
//
// AUTH: Supabase session; tables are RLS-scoped to auth.uid().
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TZ = "America/New_York";
const KINDS = ["action", "thought", "idea", "reminder", "note", "habit", "principle"] as const;
type Kind = (typeof KINDS)[number];

const CARD_COLUMNS =
  "id, kind, title, body, est_minutes, stars, prioritized, status, due_date, related_ids, last_done_on, created_at, boost";

type Supabase = Awaited<ReturnType<typeof createSupabaseClient>>;

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function startOfTodayIso(): string {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const offsetMs = now.getTime() - local.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() + offsetMs).toISOString();
}

async function buildState(supabase: Supabase) {
  const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const [{ data: cards, error }, { data: logs }, { data: jobs }] = await Promise.all([
    supabase
      .from("intentional_cards")
      .select(CARD_COLUMNS)
      .eq("status", "open")
      .order("prioritized", { ascending: false })
      .order("stars", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("intentional_time_logs")
      .select("seconds")
      .gte("ended_at", startOfTodayIso()),
    supabase
      .from("intentional_transcripts")
      .select("id, status, progress, log, created_at")
      .or(`status.eq.processing,created_at.gte.${recent}`)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  if (error) throw error;
  const seconds = (logs ?? []).reduce((sum, l) => sum + (l.seconds ?? 0), 0);
  return { cards: cards ?? [], jobs: jobs ?? [], today: todayLocal(), minutesToday: Math.round(seconds / 60) };
}

type ParsedCard = {
  kind: Kind;
  title: string;
  body: string | null;
  est_minutes: number | null;
  stars: number;
  due_date: string | null;
  related_ids: string[];
};

type Existing = { id: string; kind: string; title: string };

function cardSpec(existing: Existing[]): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date());
  return `Today is ${weekday}, ${todayLocal()}.

Existing open cards (id | kind | title):
${existing.map((c) => `${c.id} | ${c.kind} | ${c.title}`).join("\n") || "(none)"}

Card fields:
- "kind": one of action (a to-do), thought, idea, reminder (time-bound nudge), note (reference info), habit (something to do every day, e.g. exercise, read, time with kids), principle (a mindset/character reminder, e.g. "be concise", "don't seek validation").
- "title": short (max ~8 words). Imperative for actions/habits.
- "body": extra context worth keeping, or null.
- "est_minutes": realistic minutes to do it for action/habit/reminder, else null.
- "stars": importance 1-5 (5 = critical, e.g. insurance deadlines; 3 = normal).
- "due_date": YYYY-MM-DD if stated or clearly implied, resolved from today, else null.
- "related_ids": ids of existing cards that are clearly the same topic, else [].
- "duplicate_of": id of an existing card that this is essentially the same as, else null.
Ignore filler and greetings.`;
}

function cleanCard(c: Partial<ParsedCard>, validIds: Set<string>): ParsedCard | null {
  if (!(c.title ?? "").trim()) return null;
  return {
    kind: KINDS.includes(c.kind as Kind) ? (c.kind as Kind) : "action",
    title: c.title!.trim().slice(0, 200),
    body: c.body?.trim() || null,
    est_minutes: typeof c.est_minutes === "number" && c.est_minutes > 0 ? Math.round(c.est_minutes) : null,
    stars: typeof c.stars === "number" ? Math.min(5, Math.max(1, Math.round(c.stars))) : 3,
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(c.due_date ?? "") ? c.due_date! : null,
    related_ids: (c.related_ids ?? []).filter((id) => validIds.has(id)),
  };
}

async function parseSingle(text: string, existing: Existing[]): Promise<ParsedCard | null> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You convert notes into structured cards. Always return valid JSON." },
      {
        role: "user",
        content: `Turn this ONE quick note into exactly one card for an intentional-living app.\n\nNote: """${text}"""\n\n${cardSpec(existing)}\n\nReturn ONLY JSON: {"kind":"action","title":"","body":null,"est_minutes":null,"stars":3,"due_date":null,"related_ids":[],"duplicate_of":null}`,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as Partial<ParsedCard>;
  return cleanCard(parsed, new Set(existing.map((c) => c.id)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof createClient<any>>;

// Streams cards out of a transcript one at a time (NDJSON), inserting each as it
// arrives and writing a progress log the client polls.
async function processTranscript(
  admin: Admin,
  userId: string,
  rawId: string,
  text: string,
  transcriptId: string,
  existing: Existing[]
) {
  const log: string[] = [];
  const step = async (line: string, progress: number, status = "processing") => {
    log.push(line);
    await admin
      .from("intentional_transcripts")
      .update({ log, progress: Math.round(progress), status })
      .eq("id", transcriptId);
  };
  const byId = new Map(existing.map((c) => [c.id, c]));
  const validIds = new Set(byId.keys());

  try {
    await step(`▸ Reading transcript · ${text.split(/\s+/).length} words`, 5);
    await step(`▸ Comparing against ${existing.length} existing cards`, 10);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You convert voice memos into structured cards. Output NDJSON only: one compact JSON object per line, no prose, no code fences." },
        {
          role: "user",
          content: `Split this voice-memo transcript into every distinct card for an intentional-living app.\n\nTranscript: """${text}"""\n\n${cardSpec(existing)}\n\nOutput format (NDJSON):\nLine 1: {"count": <number of cards you will output>}\nThen one line per card: {"kind":"action","title":"","body":null,"est_minutes":null,"stars":3,"due_date":null,"related_ids":[],"duplicate_of":null}`,
        },
      ],
    });

    let buffer = "";
    let total = 0;
    let added = 0;
    let dupes = 0;
    const handle = async (line: string) => {
      const trimmed = line.trim().replace(/^```\w*|```$/g, "");
      if (!trimmed.startsWith("{")) return;
      let obj: Partial<ParsedCard> & { count?: number; duplicate_of?: string | null };
      try { obj = JSON.parse(trimmed); } catch { return; }
      if (typeof obj.count === "number") {
        total = obj.count;
        await step(`▸ Found ${total} card${total === 1 ? "" : "s"} — organizing`, 15);
        return;
      }
      const done = added + dupes + 1;
      const pct = 15 + 80 * Math.min(1, done / Math.max(total, done));
      const dup = obj.duplicate_of && byId.get(obj.duplicate_of);
      if (dup) {
        dupes++;
        await step(`↺ Duplicate of “${dup.title}” — skipped`, pct);
        return;
      }
      const card = cleanCard(obj, validIds);
      if (!card) return;
      const { error } = await admin
        .from("intentional_cards")
        .insert({ ...card, user_id: userId, transcript_id: transcriptId });
      if (error) throw error;
      added++;
      const links = card.related_ids.map((id) => byId.get(id)?.title).filter(Boolean);
      const extras = [
        card.est_minutes && `~${card.est_minutes}m`,
        card.stars >= 4 && "★".repeat(card.stars),
        card.due_date && `due ${card.due_date}`,
      ].filter(Boolean).join(" · ");
      await step(`+ ${card.kind} · ${card.title}${extras ? ` (${extras})` : ""}`, pct);
      if (links.length) await step(`  🔗 linked to “${links.join("”, “")}”`, pct);
    };

    for await (const chunk of stream) {
      buffer += chunk.choices[0]?.delta?.content ?? "";
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        await handle(line);
      }
    }
    await handle(buffer);

    if (added === 0) {
      await step("✗ No new cards found — kept your transcript as a note", 100, "done");
      return;
    }
    await admin.from("intentional_cards").delete().eq("id", rawId).eq("user_id", userId);
    await step(`✓ Done · ${added} card${added === 1 ? "" : "s"} added${dupes ? ` · ${dupes} duplicate${dupes === 1 ? "" : "s"} skipped` : ""}`, 100, "done");
  } catch (err) {
    console.error("[intentional] transcript failed; raw card kept", err);
    await step("✗ AI unavailable — kept your transcript as a note", 100, "failed");
  }
}

// Runs after the response, so it can't rely on request cookies; scoped by userId.
async function enrich(
  userId: string,
  rawId: string,
  text: string,
  single: boolean,
  transcriptId: string | null
) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: existing } = await admin
    .from("intentional_cards")
    .select("id, kind, title")
    .eq("user_id", userId)
    .eq("status", "open")
    .neq("id", rawId)
    .order("created_at", { ascending: false })
    .limit(150);

  if (!single && transcriptId) {
    await processTranscript(admin, userId, rawId, text, transcriptId, (existing ?? []) as Existing[]);
    return;
  }

  try {
    const c = await parseSingle(text, (existing ?? []) as Existing[]);
    if (!c) return;
    await admin
      .from("intentional_cards")
      .update({
        kind: c.kind,
        // keep what the user typed unless it was long
        ...(text.length > 120 ? { title: c.title, body: text } : {}),
        est_minutes: c.est_minutes,
        stars: c.stars,
        ...(c.due_date ? { due_date: c.due_date } : {}),
        related_ids: c.related_ids,
      })
      .eq("id", rawId)
      .eq("user_id", userId)
      .eq("status", "open");
  } catch (err) {
    console.error("[intentional] enrich failed; raw card kept", err);
  }
}

export async function GET() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await buildState(supabase));
  } catch (err) {
    console.error("[intentional] list", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      text?: string;
      single?: boolean;
      started_at?: string;
      fields?: Partial<{
        kind: string;
        title: string;
        body: string | null;
        est_minutes: number | null;
        stars: number;
        prioritized: boolean;
        due_date: string | null;
        boost: number;
      }>;
    };

    switch (body.action) {
      case "capture": {
        const text = (body.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "Nothing to add" }, { status: 400 });
        if (text.length > 30000) return NextResponse.json({ error: "Transcript too long" }, { status: 413 });

        const single = !!body.single;
        let transcriptId: string | null = null;
        if (!single) {
          const { data: t, error } = await supabase
            .from("intentional_transcripts")
            .insert({ text, log: ["▸ Saved transcript as a card"], progress: 2 })
            .select("id")
            .single();
          if (error) throw error;
          transcriptId = t.id;
        }

        // Save the raw text now; AI sorting happens after the response.
        const { data: raw, error } = await supabase
          .from("intentional_cards")
          .insert({
            kind: single ? "action" : "note",
            title: (text.split("\n")[0] || text).slice(0, 120),
            body: single && text.length <= 120 ? null : text,
            due_date: single ? guessDueDate(text, todayLocal()) : null,
            transcript_id: transcriptId,
          })
          .select("id, created_at")
          .single();
        if (error) throw error;

        after(() => enrich(user.id, raw.id, text, single, transcriptId));

        return NextResponse.json({
          addedId: raw.id,
          addedSince: raw.created_at,
          transcriptId,
          ...(await buildState(supabase)),
        });
      }

      case "update": {
        if (!body.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
        const f = body.fields ?? {};
        const patch: Record<string, unknown> = {};
        if (KINDS.includes(f.kind as Kind)) patch.kind = f.kind;
        if (typeof f.title === "string" && f.title.trim()) patch.title = f.title.trim().slice(0, 200);
        if (f.body === null || typeof f.body === "string") patch.body = f.body?.trim() || null;
        if (f.est_minutes === null) patch.est_minutes = null;
        else if (typeof f.est_minutes === "number" && f.est_minutes > 0) patch.est_minutes = Math.round(f.est_minutes);
        if (typeof f.stars === "number") patch.stars = Math.min(5, Math.max(1, Math.round(f.stars)));
        if (typeof f.prioritized === "boolean") patch.prioritized = f.prioritized;
        if (typeof f.boost === "number" && Number.isFinite(f.boost)) patch.boost = Math.max(-1000, Math.min(1000, f.boost));
        if (f.due_date === null) patch.due_date = null;
        else if (typeof f.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.due_date)) patch.due_date = f.due_date;
        if (Object.keys(patch).length === 0) {
          return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }
        await supabase.from("intentional_cards").update(patch).eq("id", body.id);
        return NextResponse.json(await buildState(supabase));
      }

      case "archive":
      case "restore": {
        if (!body.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
        await supabase
          .from("intentional_cards")
          .update({ status: body.action === "archive" ? "archived" : "open" })
          .eq("id", body.id);
        return NextResponse.json(await buildState(supabase));
      }

      case "complete": {
        if (!body.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
        const { data: card } = await supabase
          .from("intentional_cards")
          .select("id, kind")
          .eq("id", body.id)
          .maybeSingle();
        if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

        const startedMs = body.started_at ? Date.parse(body.started_at) : NaN;
        if (!Number.isNaN(startedMs) && startedMs < Date.now()) {
          await supabase.from("intentional_time_logs").insert({
            card_id: card.id,
            started_at: new Date(startedMs).toISOString(),
            seconds: Math.round((Date.now() - startedMs) / 1000),
          });
        }

        await supabase
          .from("intentional_cards")
          .update(
            card.kind === "habit"
              ? { last_done_on: todayLocal() }
              : { status: "done", completed_at: new Date().toISOString() }
          )
          .eq("id", card.id);
        return NextResponse.json(await buildState(supabase));
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[intentional]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
