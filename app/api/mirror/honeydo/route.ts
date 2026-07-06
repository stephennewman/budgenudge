import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createSupabaseClient } from "@/utils/supabase/server";

// HoneyDo — shared voice-to-task list for the mirror.
//
// GET  ?token=  → open tasks + recently completed.
// POST multipart (audio, created_by, token) → transcribe with Whisper, parse
//      into one or more structured tasks with GPT, insert, return the list.
// POST json { action: "complete"|"reopen"|"delete", id } → task updates.
//      Completing a recurring task rolls a fresh copy forward by
//      recurrence_days so it reappears on schedule.
//
// AUTH: same gate as the other mirror write routes — a logged-in Supabase
// session or the shared in-home MIRROR_TOKEN. Data lives in `honeydo_tasks`
// (service role only; RLS denies anon).
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TZ = "America/New_York";

async function isAuthorized(searchParams: URLSearchParams): Promise<boolean> {
  try {
    const authClient = await createSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user) return true;
  } catch {
    /* fall through to token */
  }
  const token = searchParams.get("token");
  const expected = process.env.MIRROR_TOKEN;
  return !!(expected && token && token === expected);
}

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  transcript: string | null;
  created_by: string;
  due_date: string | null;
  recurrence: string | null;
  recurrence_days: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  starred: boolean;
  kind: string;
  owner: string | null;
};

const TASK_COLUMNS =
  "id, title, details, transcript, created_by, due_date, recurrence, recurrence_days, status, completed_at, created_at, starred, kind, owner";

async function buildList() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: open }, { data: done }] = await Promise.all([
    supabase
      .from("honeydo_tasks")
      .select(TASK_COLUMNS)
      .eq("status", "open")
      .order("starred", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("honeydo_tasks")
      .select(TASK_COLUMNS)
      .eq("status", "done")
      .gte("completed_at", weekAgo)
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);

  return {
    open: (open ?? []) as TaskRow[],
    done: (done ?? []) as TaskRow[],
  };
}

// Turn a raw voice transcript into one or more structured tasks. A single
// recording may mention several to-dos ("grab trash bags and call the vet").
async function parseTasks(
  transcript: string
): Promise<
  {
    title: string;
    details: string | null;
    due_date: string | null;
    recurrence: string | null;
    recurrence_days: number | null;
  }[]
> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const today = todayLocal();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
  }).format(new Date());

  const prompt = `You turn a voice memo from a shared household to-do list into structured tasks. Today is ${weekday}, ${today}.

Voice memo transcript:
"${transcript}"

Rules:
- Extract every distinct task mentioned. Usually 1, sometimes more.
- "title": short imperative phrase (max ~8 words), e.g. "Buy trash bags".
- "details": extra context from the memo worth keeping, or null.
- "due_date": YYYY-MM-DD if a date/day is stated or clearly implied ("by Friday", "tomorrow"), else null. Resolve relative dates from today's date above.
- "recurrence": short human-readable schedule if the task repeats ("every Saturday", "monthly"), else null.
- "recurrence_days": the repeat interval in days (weekly=7, monthly=30, etc.) when recurrence is set, else null.
- Ignore filler, greetings, and anything that is not a task.

Return ONLY valid JSON: {"tasks":[{"title":"","details":null,"due_date":null,"recurrence":null,"recurrence_days":null}]}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You convert voice memos into structured to-do items. Always return valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw) as {
    tasks?: {
      title?: string;
      details?: string | null;
      due_date?: string | null;
      recurrence?: string | null;
      recurrence_days?: number | null;
    }[];
  };

  return (parsed.tasks ?? [])
    .filter((t) => (t.title ?? "").trim().length > 0)
    .map((t) => ({
      title: t.title!.trim(),
      details: t.details?.trim() || null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date ?? "") ? t.due_date! : null,
      recurrence: t.recurrence?.trim() || null,
      recurrence_days:
        typeof t.recurrence_days === "number" && t.recurrence_days > 0
          ? Math.round(t.recurrence_days)
          : null,
    }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (!(await isAuthorized(searchParams))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await buildList());
  } catch (err) {
    console.error("[honeydo] list", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (!(await isAuthorized(searchParams))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    // Voice capture: multipart upload with the recorded audio blob.
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const audio = form.get("audio");
      if (!(audio instanceof File) || audio.size === 0) {
        return NextResponse.json({ error: "No audio received" }, { status: 400 });
      }
      if (audio.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "Recording too long" }, { status: 413 });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const transcription = await openai.audio.transcriptions.create({
        file: audio,
        model: "whisper-1",
      });
      const transcript = (transcription.text || "").trim();
      if (!transcript) {
        return NextResponse.json(
          { error: "Couldn't hear anything — try again" },
          { status: 422 }
        );
      }

      const tasks = await parseTasks(transcript);
      if (tasks.length === 0) {
        return NextResponse.json(
          { error: "No task found in that recording", transcript },
          { status: 422 }
        );
      }

      const { error } = await supabase.from("honeydo_tasks").insert(
        tasks.map((t) => ({ ...t, transcript }))
      );
      if (error) throw error;

      return NextResponse.json({ transcript, added: tasks.length, ...(await buildList()) });
    }

    // JSON actions: update / complete / reopen / delete.
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      fields?: {
        title?: string;
        due_date?: string | null;
        starred?: boolean;
        kind?: string;
        owner?: string | null;
      };
    };
    if (!body.id) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    switch (body.action) {
      case "update": {
        const f = body.fields ?? {};
        const patch: Record<string, unknown> = {};
        if (typeof f.title === "string" && f.title.trim()) {
          patch.title = f.title.trim().slice(0, 200);
        }
        if (f.due_date === null) patch.due_date = null;
        else if (typeof f.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.due_date)) {
          patch.due_date = f.due_date;
        }
        if (typeof f.starred === "boolean") patch.starred = f.starred;
        if (f.kind === "task" || f.kind === "project") patch.kind = f.kind;
        if (f.owner === null) patch.owner = null;
        else if (f.owner === "Stephen" || f.owner === "Whitney") patch.owner = f.owner;

        if (Object.keys(patch).length === 0) {
          return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }
        await supabase.from("honeydo_tasks").update(patch).eq("id", body.id);
        return NextResponse.json(await buildList());
      }

      case "complete": {
        const { data: task } = await supabase
          .from("honeydo_tasks")
          .select(TASK_COLUMNS)
          .eq("id", body.id)
          .eq("status", "open")
          .maybeSingle();
        if (!task) {
          return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        await supabase
          .from("honeydo_tasks")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", body.id);

        // Recurring task: schedule the next occurrence.
        const t = task as TaskRow;
        if (t.recurrence_days && t.recurrence_days > 0) {
          const base = t.due_date ? new Date(`${t.due_date}T12:00:00`) : new Date();
          base.setDate(base.getDate() + t.recurrence_days);
          const nextDue = base.toISOString().split("T")[0];
          await supabase.from("honeydo_tasks").insert({
            title: t.title,
            details: t.details,
            transcript: t.transcript,
            created_by: t.created_by,
            due_date: nextDue,
            recurrence: t.recurrence,
            recurrence_days: t.recurrence_days,
            starred: t.starred,
            kind: t.kind,
            owner: t.owner,
          });
        }
        return NextResponse.json(await buildList());
      }

      case "reopen": {
        await supabase
          .from("honeydo_tasks")
          .update({ status: "open", completed_at: null })
          .eq("id", body.id)
          .eq("status", "done");
        return NextResponse.json(await buildList());
      }

      case "delete": {
        await supabase.from("honeydo_tasks").delete().eq("id", body.id);
        return NextResponse.json(await buildList());
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[honeydo]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
