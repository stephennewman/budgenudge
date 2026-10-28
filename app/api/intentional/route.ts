import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseClient } from "@/utils/supabase/server";

// Intentional — everything is a card.
//
// GET  → open cards + minutes logged today.
// POST json { action, ... }:
//   "capture"  { text, single? } → GPT splits a transcript (or one quick note
//              when single) into typed cards, linking them to existing cards.
//   "update"   { id, fields }
//   "archive" | "restore" { id }
//   "complete" { id, started_at? } → done (habits: done for today); logs time
//              when started_at is given.
//
// AUTH: Supabase session; tables are RLS-scoped to auth.uid().
export const dynamic = "force-dynamic";

const TZ = "America/New_York";
const KINDS = ["action", "thought", "idea", "reminder", "note", "habit", "principle"] as const;
type Kind = (typeof KINDS)[number];

const CARD_COLUMNS =
  "id, kind, title, body, est_minutes, stars, prioritized, status, due_date, related_ids, last_done_on, created_at";

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
  const [{ data: cards, error }, { data: logs }] = await Promise.all([
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
  ]);
  if (error) throw error;
  const seconds = (logs ?? []).reduce((sum, l) => sum + (l.seconds ?? 0), 0);
  return { cards: cards ?? [], today: todayLocal(), minutesToday: Math.round(seconds / 60) };
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

async function parseCards(
  text: string,
  single: boolean,
  existing: { id: string; kind: string; title: string }[]
): Promise<ParsedCard[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(now);

  const prompt = `You turn a personal voice-memo transcript into cards for an intentional-living app. Today is ${weekday}, ${todayLocal()}.

${single ? "This is ONE quick card the user typed. Return exactly one card." : "Split the transcript into every distinct card. Usually several."}

Input:
"""${text}"""

Existing open cards (for linking only):
${existing.map((c) => `${c.id} | ${c.kind} | ${c.title}`).join("\n") || "(none)"}

Card fields:
- "kind": one of action (a to-do), thought, idea, reminder (time-bound nudge), note (reference info), habit (something to do every day, e.g. exercise, read, time with kids), principle (a mindset/character reminder, e.g. "be concise", "don't seek validation").
- "title": short (max ~8 words). Imperative for actions/habits.
- "body": extra context worth keeping, or null.
- "est_minutes": realistic minutes to do it for action/habit/reminder, else null.
- "stars": importance 1-5 (5 = critical, e.g. insurance deadlines; 3 = normal).
- "due_date": YYYY-MM-DD if stated or clearly implied, resolved from today, else null.
- "related_ids": ids of existing cards that are clearly the same topic, else [].
Ignore filler and greetings.

Return ONLY JSON: {"cards":[{"kind":"action","title":"","body":null,"est_minutes":null,"stars":3,"due_date":null,"related_ids":[]}]}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You convert voice memos into structured cards. Always return valid JSON." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as {
    cards?: Partial<ParsedCard>[];
  };
  const validIds = new Set(existing.map((c) => c.id));

  const cards = (parsed.cards ?? [])
    .filter((c) => (c.title ?? "").trim().length > 0)
    .map((c) => ({
      kind: KINDS.includes(c.kind as Kind) ? (c.kind as Kind) : "action",
      title: c.title!.trim().slice(0, 200),
      body: c.body?.trim() || null,
      est_minutes:
        typeof c.est_minutes === "number" && c.est_minutes > 0 ? Math.round(c.est_minutes) : null,
      stars: typeof c.stars === "number" ? Math.min(5, Math.max(1, Math.round(c.stars))) : 3,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(c.due_date ?? "") ? c.due_date! : null,
      related_ids: (c.related_ids ?? []).filter((id) => validIds.has(id)),
    }));
  return single ? cards.slice(0, 1) : cards;
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
      }>;
    };

    switch (body.action) {
      case "capture": {
        const text = (body.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "Nothing to add" }, { status: 400 });
        if (text.length > 30000) return NextResponse.json({ error: "Transcript too long" }, { status: 413 });

        const { data: existing } = await supabase
          .from("intentional_cards")
          .select("id, kind, title")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(150);

        let cards: ParsedCard[];
        let aiFailed = false;
        try {
          cards = await parseCards(text, !!body.single, existing ?? []);
        } catch (err) {
          console.error("[intentional] parse failed, saving raw", err);
          aiFailed = true;
          cards = [{
            kind: body.single ? "action" : "note",
            title: (text.split("\n")[0] || text).slice(0, 120),
            body: body.single && text.length <= 120 ? null : text,
            est_minutes: null,
            stars: 3,
            due_date: null,
            related_ids: [],
          }];
        }
        if (cards.length === 0) {
          return NextResponse.json({ error: "Couldn't find any cards in that" }, { status: 422 });
        }

        let transcriptId: string | null = null;
        if (!body.single) {
          const { data: t, error } = await supabase
            .from("intentional_transcripts")
            .insert({ text })
            .select("id")
            .single();
          if (error) throw error;
          transcriptId = t.id;
        }

        const { data: inserted, error } = await supabase
          .from("intentional_cards")
          .insert(cards.map((c) => ({ ...c, transcript_id: transcriptId })))
          .select("id");
        if (error) throw error;
        return NextResponse.json({
          added: cards.length,
          aiFailed,
          addedIds: (inserted ?? []).map((r) => r.id),
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
