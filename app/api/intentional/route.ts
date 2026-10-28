import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createSupabaseClient } from "@/utils/supabase/server";
import { guessDueDate } from "@/utils/intentional/dates";

// Intentional — everything is a card.
//
// GET  → open cards, intentions (life areas) with minutes this week, minutes
//        logged today. Seeds default intentions on first use.
// POST json { action, ... }:
//   "capture"  { text, single? } → saves the raw text as a card immediately,
//              then (after responding) GPT types/estimates it, or splits a
//              transcript into cards that replace the raw note.
//   "update"   { id, fields }
//   "archive" | "restore" { id }
//   "complete" { id, started_at? } → done (habits: done for today); logs time
//              when started_at is given.
//   "area_save" { id?, fields } | "area_archive" { id } → manage intentions.
//
// AUTH: Supabase session; tables are RLS-scoped to auth.uid().
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TZ = "America/New_York";
const KINDS = ["action", "thought", "idea", "reminder", "note", "habit", "principle", "lesson"] as const;
type Kind = (typeof KINDS)[number];

const CARD_COLUMNS =
  "id, kind, title, body, est_minutes, stars, prioritized, status, due_date, related_ids, last_done_on, created_at, boost, area_id";

const AREA_COLUMNS = "id, name, emoji, statement, weekly_minutes, focus, sort";

const DEFAULT_AREAS = [
  { name: "Me", emoji: "🧭", focus: "any", weekly_minutes: 210, statement: "Become the man I want to be: lead without permission, be clear and assertive, take care of my body." },
  { name: "Marriage", emoji: "💍", focus: "personal", weekly_minutes: 300, statement: "Pursue Whitney. Be present, plan time together, carry the load." },
  { name: "Family", emoji: "👨‍👧", focus: "personal", weekly_minutes: 420, statement: "Be a present, intentional dad." },
  { name: "Faith", emoji: "🙏", focus: "any", weekly_minutes: 105, statement: "Stay rooted: Bible, prayer, church." },
  { name: "Checkit", emoji: "💼", focus: "work", weekly_minutes: null, statement: "Do excellent, focused work at my day job." },
  { name: "Context Memo", emoji: "🚀", focus: "any", weekly_minutes: 300, statement: "Build and grow my side business." },
  { name: "Home & admin", emoji: "🏠", focus: "any", weekly_minutes: 120, statement: "Keep the house, money, and paperwork handled." },
];
const FOCUSES = ["work", "personal", "any"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Area = { id: string; name: string; emoji: string; statement: string | null };

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

function startOfWeekIso(): string {
  const today = new Date(startOfTodayIso());
  const weekday = new Date(`${todayLocal()}T12:00:00`).getDay();
  return new Date(today.getTime() - ((weekday + 6) % 7) * 86400000).toISOString();
}

async function buildState(supabase: Supabase) {
  const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayStart = startOfTodayIso();
  const historyStart = new Date(Date.now() - 60 * 86400000).toISOString();
  const [{ data: cards, error }, { data: logs }, { data: jobs }, { data: areas }, { data: done }, { data: history }] = await Promise.all([
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
      .select("seconds, ended_at, area_id")
      .gte("ended_at", startOfWeekIso()),
    supabase
      .from("intentional_transcripts")
      .select("id, status, progress, log, created_at")
      .or(`status.eq.processing,created_at.gte.${recent},and(status.eq.failed,created_at.gte.${dayAgo})`)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("intentional_areas")
      .select(AREA_COLUMNS)
      .eq("archived", false)
      .order("sort", { ascending: true }),
    supabase
      .from("intentional_cards")
      .select(`${CARD_COLUMNS}, completed_at`)
      .eq("status", "done")
      .gte("completed_at", historyStart)
      .order("completed_at", { ascending: false })
      .limit(300),
    supabase
      .from("intentional_time_logs")
      .select("card_id, area_id, seconds, ended_at")
      .gte("ended_at", historyStart)
      .order("ended_at", { ascending: false })
      .limit(1000),
  ]);
  if (error) throw error;
  const weekSecs = new Map<string, number>();
  let todaySecs = 0;
  for (const l of logs ?? []) {
    if (l.ended_at >= todayStart) todaySecs += l.seconds ?? 0;
    if (l.area_id) weekSecs.set(l.area_id, (weekSecs.get(l.area_id) ?? 0) + (l.seconds ?? 0));
  }
  return {
    cards: cards ?? [],
    done: done ?? [],
    history: history ?? [],
    jobs: jobs ?? [],
    areas: (areas ?? []).map((a) => ({ ...a, minutes_week: Math.round((weekSecs.get(a.id) ?? 0) / 60) })),
    today: todayLocal(),
    minutesToday: Math.round(todaySecs / 60),
  };
}

type ParsedCard = {
  kind: Kind;
  title: string;
  body: string | null;
  est_minutes: number | null;
  stars: number;
  due_date: string | null;
  related_ids: string[];
  area_id: string | null;
};

type Existing = { id: string; kind: string; title: string };

function cardSpec(existing: Existing[], areas: Area[]): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date());
  return `Today is ${weekday}, ${todayLocal()}.

The user's intentions (life areas), id | name | why:
${areas.map((a) => `${a.id} | ${a.emoji} ${a.name} | ${a.statement ?? ""}`).join("\n") || "(none)"}

Existing open cards (id | kind | title):
${existing.map((c) => `${c.id} | ${c.kind} | ${c.title}`).join("\n") || "(none)"}

Card fields:
- "kind": one of action (a to-do), thought, idea, reminder (time-bound nudge), note (reference info), habit (something to do every day, e.g. exercise, read, time with kids), principle (a mindset/character reminder, e.g. "be concise", "don't seek validation"), lesson (a mistake made and what to do differently).
- "title": short (max ~8 words). Imperative for actions/habits.
- "body": extra context worth keeping, or null.
- "est_minutes": realistic minutes to do it for action/habit/reminder, else null.
- "stars": importance 1-5 (5 = critical, e.g. insurance deadlines; 3 = normal).
- "due_date": YYYY-MM-DD if stated or clearly implied, resolved from today, else null.
- "related_ids": ids of existing cards that are clearly the same topic, else [].
- "area_id": id of the ONE intention this card best serves, or null if none fit.
- "duplicate_of": id of an existing card that this is essentially the same as, else null.
Ignore filler and greetings.`;
}

function cleanCard(c: Partial<ParsedCard>, validIds: Set<string>, areaIds: Set<string>): ParsedCard | null {
  if (!(c.title ?? "").trim()) return null;
  return {
    kind: KINDS.includes(c.kind as Kind) ? (c.kind as Kind) : "action",
    title: c.title!.trim().slice(0, 200),
    body: c.body?.trim() || null,
    est_minutes: typeof c.est_minutes === "number" && c.est_minutes > 0 ? Math.round(c.est_minutes) : null,
    stars: typeof c.stars === "number" ? Math.min(5, Math.max(1, Math.round(c.stars))) : 3,
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(c.due_date ?? "") ? c.due_date! : null,
    related_ids: (c.related_ids ?? []).filter((id) => validIds.has(id)),
    area_id: c.area_id && areaIds.has(c.area_id) ? c.area_id : null,
  };
}

async function parseSingle(text: string, existing: Existing[], areas: Area[]): Promise<ParsedCard | null> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You convert notes into structured cards. Always return valid JSON." },
      {
        role: "user",
        content: `Turn this ONE quick note into exactly one card for an intentional-living app.\n\nNote: """${text}"""\n\n${cardSpec(existing, areas)}\n\nReturn ONLY JSON: {"kind":"action","title":"","body":null,"est_minutes":null,"stars":3,"due_date":null,"related_ids":[],"area_id":null,"duplicate_of":null}`,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as Partial<ParsedCard>;
  return cleanCard(parsed, new Set(existing.map((c) => c.id)), new Set(areas.map((a) => a.id)));
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
  existing: Existing[],
  areas: Area[],
  forcedArea: string | null,
  reflect: boolean
) {
  const log: string[] = [];
  const today = todayLocal();
  // a past local date → roughly noon that day; today → now
  const whenIso = (d: string | null | undefined) =>
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today ? new Date(`${d}T16:00:00Z`).toISOString() : new Date().toISOString();
  const logTime = async (cardId: string, areaId: string | null, minutes: unknown, endedAt: string) => {
    if (typeof minutes !== "number" || minutes <= 0 || minutes > 24 * 60) return;
    const secs = Math.round(minutes * 60);
    await admin.from("intentional_time_logs").insert({
      user_id: userId,
      card_id: cardId,
      area_id: areaId,
      started_at: new Date(Date.parse(endedAt) - secs * 1000).toISOString(),
      ended_at: endedAt,
      seconds: secs,
    });
  };
  const step = async (line: string, progress: number, status = "processing") => {
    log.push(line);
    await admin
      .from("intentional_transcripts")
      .update({ log, progress: Math.round(progress), status })
      .eq("id", transcriptId);
  };
  const byId = new Map(existing.map((c) => [c.id, c]));
  const validIds = new Set(byId.keys());
  const areaIds = new Set(areas.map((a) => a.id));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  try {
    await step(`▸ Reading ${reflect ? "reflection" : "transcript"} · ${text.split(/\s+/).length} words`, 5);
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
          content: reflect
            ? `This is a RETROSPECTIVE: the user reflecting on what already happened (things done, worked on, mistakes made). Split it into every distinct card, all in the past.\n\nReflection: """${text}"""\n\n${forcedArea ? `Everything here belongs to the intention ${forcedArea}; use it as area_id.\n\n` : ""}${cardSpec(existing, areas)}\n\nFor reflections also:\n- Use kind "action" for things done or worked on (title in past tense, e.g. "Took kids to the park"), "lesson" for mistakes and what to do differently, "thought" for other reflections.\n- "occurred_on": YYYY-MM-DD when it happened (resolve "yesterday", "Monday" etc. from today; default today).\n- "minutes_spent": minutes spent if stated or clearly implied, else null.\n- "duplicate_of": id of an existing OPEN card this completes (e.g. reflection "called Prudential" completes card "Call Prudential"), else null.\n\nOutput format (NDJSON):\nLine 1: {"count": <number of cards you will output>}\nThen one line per card: {"kind":"action","title":"","body":null,"stars":3,"related_ids":[],"area_id":null,"duplicate_of":null,"occurred_on":"${today}","minutes_spent":null}`
            : `Split this voice-memo transcript into every distinct card for an intentional-living app.\n\nTranscript: """${text}"""\n\n${forcedArea ? `Everything here belongs to the intention ${forcedArea}; use it as area_id.\n\n` : ""}${cardSpec(existing, areas)}\n\nOutput format (NDJSON):\nLine 1: {"count": <number of cards you will output>}\nThen one line per card: {"kind":"action","title":"","body":null,"est_minutes":null,"stars":3,"due_date":null,"related_ids":[],"area_id":null,"duplicate_of":null}`,
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
      let obj: Partial<ParsedCard> & {
        count?: number;
        duplicate_of?: string | null;
        occurred_on?: string | null;
        minutes_spent?: number | null;
      };
      try { obj = JSON.parse(trimmed); } catch { return; }
      if (typeof obj.count === "number") {
        total = obj.count;
        await step(`▸ Found ${total} card${total === 1 ? "" : "s"} — organizing`, 15);
        return;
      }
      const done = added + dupes + 1;
      const pct = 15 + 80 * Math.min(1, done / Math.max(total, done));
      const dup = obj.duplicate_of && byId.get(obj.duplicate_of);
      if (dup && reflect) {
        dupes++;
        const at = whenIso(obj.occurred_on);
        const { data: updated } = await admin
          .from("intentional_cards")
          .update(dup.kind === "habit" ? { last_done_on: (obj.occurred_on ?? today) } : { status: "done", completed_at: at })
          .eq("id", dup.id)
          .eq("user_id", userId)
          .select("area_id")
          .maybeSingle();
        await logTime(dup.id, updated?.area_id ?? null, obj.minutes_spent, at);
        await step(`✓ Marked done: “${dup.title}”`, pct);
        return;
      }
      if (dup) {
        dupes++;
        await step(`↺ Duplicate of “${dup.title}” — skipped`, pct);
        return;
      }
      const card = cleanCard(obj, validIds, areaIds);
      if (!card) return;
      if (forcedArea) card.area_id = forcedArea;
      const at = whenIso(obj.occurred_on);
      const { data: inserted, error } = await admin
        .from("intentional_cards")
        .insert({
          ...card,
          user_id: userId,
          transcript_id: transcriptId,
          ...(reflect ? { status: "done", completed_at: at, due_date: null, est_minutes: null } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (reflect) await logTime(inserted.id, card.area_id, obj.minutes_spent, at);
      added++;
      const links = card.related_ids.map((id) => byId.get(id)?.title).filter(Boolean);
      const area = card.area_id ? areaById.get(card.area_id) : null;
      const extras = [
        area && `${area.emoji} ${area.name}`,
        !reflect && card.est_minutes && `~${card.est_minutes}m`,
        reflect && typeof obj.minutes_spent === "number" && obj.minutes_spent > 0 && `${obj.minutes_spent}m logged`,
        reflect && obj.occurred_on && obj.occurred_on !== today && obj.occurred_on,
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

    if (added === 0 && !(reflect && dupes)) {
      await step("✗ No new cards found — kept your transcript as a note", 100, "done");
      return;
    }
    await admin.from("intentional_cards").delete().eq("id", rawId).eq("user_id", userId);
    await step(
      reflect
        ? `✓ Done · ${added} reflection${added === 1 ? "" : "s"} logged${dupes ? ` · ${dupes} open card${dupes === 1 ? "" : "s"} marked done` : ""}`
        : `✓ Done · ${added} card${added === 1 ? "" : "s"} added${dupes ? ` · ${dupes} duplicate${dupes === 1 ? "" : "s"} skipped` : ""}`,
      100,
      "done"
    );
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
  transcriptId: string | null,
  forcedArea: string | null,
  reflect = false
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
  const { data: areas } = await admin
    .from("intentional_areas")
    .select("id, name, emoji, statement")
    .eq("user_id", userId)
    .eq("archived", false);

  if (!single && transcriptId) {
    await processTranscript(admin, userId, rawId, text, transcriptId, (existing ?? []) as Existing[], (areas ?? []) as Area[], forcedArea, reflect);
    return;
  }

  try {
    const c = await parseSingle(text, (existing ?? []) as Existing[], (areas ?? []) as Area[]);
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
        ...(!forcedArea && c.area_id ? { area_id: c.area_id } : {}),
      })
      .eq("id", rawId)
      .eq("user_id", userId)
      .eq("status", "open");
  } catch (err) {
    console.error("[intentional] enrich failed; raw card kept", err);
  }
}

// One-time: sort existing cards into the freshly seeded intentions.
async function classifyExisting(userId: string) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  try {
    const [{ data: cards }, { data: areas }] = await Promise.all([
      admin.from("intentional_cards").select("id, kind, title").eq("user_id", userId).eq("status", "open").is("area_id", null).limit(200),
      admin.from("intentional_areas").select("id, name, emoji, statement").eq("user_id", userId).eq("archived", false),
    ]);
    if (!cards?.length || !areas?.length) return;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: `Assign each card to the ONE intention (life area) it best serves, or null.\n\nIntentions (id | name | why):\n${areas.map((a) => `${a.id} | ${a.name} | ${a.statement ?? ""}`).join("\n")}\n\nCards (id | kind | title):\n${cards.map((c) => `${c.id} | ${c.kind} | ${c.title}`).join("\n")}\n\nReturn ONLY JSON: {"assignments":[{"id":"","area_id":null}]}`,
      }],
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}") as { assignments?: { id: string; area_id: string | null }[] };
    const areaIds = new Set(areas.map((a) => a.id));
    const cardIds = new Set(cards.map((c) => c.id));
    await Promise.all(
      (parsed.assignments ?? [])
        .filter((a) => cardIds.has(a.id) && a.area_id && areaIds.has(a.area_id))
        .map((a) => admin.from("intentional_cards").update({ area_id: a.area_id }).eq("id", a.id).eq("user_id", userId).is("area_id", null))
    );
  } catch (err) {
    console.error("[intentional] classify existing failed", err);
  }
}

async function validArea(supabase: Supabase, id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const { data } = await supabase.from("intentional_areas").select("id").eq("id", id).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { count } = await supabase.from("intentional_areas").select("id", { count: "exact", head: true });
    if (count === 0) {
      const { error } = await supabase
        .from("intentional_areas")
        .insert(DEFAULT_AREAS.map((a, i) => ({ ...a, sort: i })));
      if (error) throw error;
      after(() => classifyExisting(user.id));
    }
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
      area_id?: string | null;
      mode?: string;
      fields?: Partial<{
        kind: string;
        title: string;
        body: string | null;
        est_minutes: number | null;
        stars: number;
        prioritized: boolean;
        due_date: string | null;
        boost: number;
        area_id: string | null;
        name: string;
        emoji: string;
        statement: string | null;
        weekly_minutes: number | null;
        focus: string;
      }>;
    };

    switch (body.action) {
      case "capture": {
        const text = (body.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "Nothing to add" }, { status: 400 });
        if (text.length > 30000) return NextResponse.json({ error: "Transcript too long" }, { status: 413 });

        const reflect = body.mode === "reflect";
        const single = !reflect && !!body.single;
        const forcedArea = await validArea(supabase, body.area_id);
        let transcriptId: string | null = null;
        if (!single) {
          const { data: t, error } = await supabase
            .from("intentional_transcripts")
            .insert({
              text,
              mode: reflect ? "reflect" : "dump",
              log: [reflect ? "▸ Saved reflection" : "▸ Saved transcript as a card"],
              progress: 2,
            })
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
            area_id: forcedArea,
            ...(reflect ? { status: "done", completed_at: new Date().toISOString() } : {}),
          })
          .select("id, created_at")
          .single();
        if (error) throw error;

        after(() => enrich(user.id, raw.id, text, single, transcriptId, forcedArea, reflect));

        return NextResponse.json({
          addedId: raw.id,
          addedSince: raw.created_at,
          transcriptId,
          ...(await buildState(supabase)),
        });
      }

      case "reprocess": {
        const { data: t } = await supabase
          .from("intentional_transcripts")
          .select("id, text, mode")
          .eq("id", body.id ?? "")
          .maybeSingle();
        if (!t) return NextResponse.json({ error: "Transcript not found" }, { status: 404 });

        let { data: raw } = await supabase
          .from("intentional_cards")
          .select("id")
          .eq("transcript_id", t.id)
          .eq("kind", "note")
          .neq("status", "archived")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!raw) {
          const { data: created, error } = await supabase
            .from("intentional_cards")
            .insert({
              kind: "note",
              title: (t.text.split("\n")[0] || t.text).slice(0, 120),
              body: t.text,
              transcript_id: t.id,
              ...(t.mode === "reflect" ? { status: "done", completed_at: new Date().toISOString() } : {}),
            })
            .select("id")
            .single();
          if (error) throw error;
          raw = created;
        }

        await supabase
          .from("intentional_transcripts")
          .update({ status: "processing", progress: 2, log: ["▸ Retrying"] })
          .eq("id", t.id);
        after(() => enrich(user.id, raw!.id, t.text, false, t.id, null, t.mode === "reflect"));
        return NextResponse.json(await buildState(supabase));
      }

      case "area_save": {
        const f = body.fields ?? {};
        const patch: Record<string, unknown> = {};
        if (typeof f.name === "string" && f.name.trim()) patch.name = f.name.trim().slice(0, 40);
        if (typeof f.emoji === "string" && f.emoji.trim()) patch.emoji = f.emoji.trim().slice(0, 8);
        if (f.statement === null || typeof f.statement === "string") patch.statement = f.statement?.trim().slice(0, 300) || null;
        if (f.weekly_minutes === null) patch.weekly_minutes = null;
        else if (typeof f.weekly_minutes === "number" && f.weekly_minutes > 0) patch.weekly_minutes = Math.round(f.weekly_minutes);
        if (typeof f.focus === "string" && FOCUSES.includes(f.focus)) patch.focus = f.focus;
        if (body.id) {
          await supabase.from("intentional_areas").update(patch).eq("id", body.id);
        } else {
          if (!patch.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
          const { count } = await supabase.from("intentional_areas").select("id", { count: "exact", head: true });
          await supabase.from("intentional_areas").insert({ ...patch, sort: count ?? 0 });
        }
        return NextResponse.json(await buildState(supabase));
      }

      case "area_archive": {
        if (!body.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
        await supabase.from("intentional_areas").update({ archived: true }).eq("id", body.id);
        await supabase.from("intentional_cards").update({ area_id: null }).eq("area_id", body.id);
        return NextResponse.json(await buildState(supabase));
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
        if (f.area_id === null) patch.area_id = null;
        else if (f.area_id !== undefined) {
          const area = await validArea(supabase, f.area_id);
          if (area) patch.area_id = area;
        }
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
          .select("id, kind, area_id")
          .eq("id", body.id)
          .maybeSingle();
        if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

        const startedMs = body.started_at ? Date.parse(body.started_at) : NaN;
        if (Number.isNaN(startedMs) && card.kind === "habit") {
          // no timer: still record the check-off for Reflect history
          await supabase.from("intentional_time_logs").insert({
            card_id: card.id,
            area_id: card.area_id,
            started_at: new Date().toISOString(),
            seconds: 0,
          });
        } else if (!Number.isNaN(startedMs) && startedMs < Date.now()) {
          await supabase.from("intentional_time_logs").insert({
            card_id: card.id,
            area_id: card.area_id,
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
