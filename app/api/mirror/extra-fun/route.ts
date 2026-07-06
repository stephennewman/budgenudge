import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// "Extra Fun" — passcode-gated couples challenge generator.
//
// All state lives in `extra_fun_challenges` (service role only; RLS denies
// anon). The passcode maps to a person and must accompany every action, so
// nothing works without it even though the page itself is public.
//
// Daily limits: 3 generations per person per day (1 initial + 2 regens).

export const dynamic = "force-dynamic";

type Person = "stephen" | "whitney";

const PASSCODES: Record<string, Person> = {
  [process.env.EXTRA_FUN_CODE_STEPHEN || "5619"]: "stephen",
  [process.env.EXTRA_FUN_CODE_WHITNEY || "8315"]: "whitney",
};

const MAX_GENERATIONS_PER_DAY = 3; // initial + 2 regenerations

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Local calendar day for the household (regen limits + "new day" check-in).
function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

type ChallengeRow = {
  id: string;
  person: Person;
  challenge_text: string;
  challenge_date: string;
  status: string;
};

async function generateChallenge(
  person: Person,
  recentTexts: string[]
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const partner = person === "stephen" ? "Whitney (his wife)" : "Stephen (her husband)";
  const reader =
    person === "stephen"
      ? "Stephen, the husband"
      : "Whitney, the wife";

  const avoid =
    recentTexts.length > 0
      ? `\nRecent challenges (do NOT repeat these themes or activities):\n${recentTexts
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  const prompt = `Generate ONE spicy, playful "sexy challenge" for ${reader} in a loving, adventurous marriage. The other partner is ${partner}. They have 3 kids, so challenges must be realistic for busy parents (discreet, doable at home after bedtime, or quick moments during the day).

The challenge should be ONE of these flavors (pick one at random):
- Something they do themselves (a tease, a surprise, an outfit, a message)
- Something they do FOR their partner (an act of seduction or service)
- Something they try to GET their partner to do (a playful mission or dare)
- Something they must NOT do (a restraint/anticipation game)

Rules:
- Written in second person, addressed to ${reader.split(",")[0]}.
- Flirty, confident, a little kinky — push the boundaries for a married couple, but keep it consensual, safe, and loving. Suggestive and specific beats explicit and crude.
- Completable within one day.
- 1-3 sentences. No emojis, no hashtags, no preamble.
- Give it a short punchy title (3-6 words).${avoid}

Return ONLY valid JSON: {"title":"","challenge":""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You write playful, sexy dares for a consenting married couple. Bold but tasteful. Always return valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 1.0,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw) as { title?: string; challenge?: string };
  if (!parsed.challenge) throw new Error("empty challenge");
  return parsed.title ? `${parsed.title}|||${parsed.challenge}` : parsed.challenge;
}

// Shared state payload the client renders from.
async function buildState(person: Person) {
  const supabase = serviceClient();
  const today = todayLocal();

  const { data: rows } = await supabase
    .from("extra_fun_challenges")
    .select("id, person, challenge_text, challenge_date, status")
    .eq("person", person)
    .order("created_at", { ascending: false })
    .limit(20);

  const all = (rows ?? []) as ChallengeRow[];

  // Accepted challenge from a previous day → needs a completion check-in.
  const checkIn =
    all.find((r) => r.status === "accepted" && r.challenge_date < today) ?? null;

  // Today's live offer (generated but not yet accepted/declined).
  const offered =
    all.find((r) => r.status === "offered" && r.challenge_date === today) ?? null;

  // Today's already-accepted challenge (show it back instead of the button).
  const acceptedToday =
    all.find((r) => r.status === "accepted" && r.challenge_date === today) ?? null;

  const generatedToday = all.filter((r) => r.challenge_date === today).length;
  const regensLeft = Math.max(0, MAX_GENERATIONS_PER_DAY - generatedToday);

  return {
    person,
    checkIn: checkIn
      ? { id: checkIn.id, text: checkIn.challenge_text, date: checkIn.challenge_date }
      : null,
    offered: offered ? { id: offered.id, text: offered.challenge_text } : null,
    acceptedToday: acceptedToday
      ? { id: acceptedToday.id, text: acceptedToday.challenge_text }
      : null,
    regensLeft,
  };
}

export async function POST(req: Request) {
  let body: {
    action?: string;
    passcode?: string;
    id?: string;
    response?: string;
    completed?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const person = body.passcode ? PASSCODES[body.passcode] : undefined;
  if (!person) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const supabase = serviceClient();
  const today = todayLocal();

  try {
    switch (body.action) {
      case "unlock": {
        return NextResponse.json(await buildState(person));
      }

      case "generate": {
        const state = await buildState(person);
        if (state.checkIn) {
          return NextResponse.json(
            { error: "Answer your check-in first" },
            { status: 409 }
          );
        }
        if (state.acceptedToday) {
          return NextResponse.json(
            { error: "You already accepted a challenge today" },
            { status: 409 }
          );
        }
        if (state.regensLeft <= 0) {
          return NextResponse.json(
            { error: "No generations left today" },
            { status: 429 }
          );
        }

        // Replace any still-open offer from today.
        if (state.offered) {
          await supabase
            .from("extra_fun_challenges")
            .update({ status: "replaced" })
            .eq("id", state.offered.id);
        }

        const { data: recent } = await supabase
          .from("extra_fun_challenges")
          .select("challenge_text")
          .eq("person", person)
          .order("created_at", { ascending: false })
          .limit(8);
        const recentTexts = (recent ?? []).map((r) => r.challenge_text as string);

        const text = await generateChallenge(person, recentTexts);

        const { data: inserted, error } = await supabase
          .from("extra_fun_challenges")
          .insert({ person, challenge_text: text, challenge_date: today })
          .select("id")
          .single();
        if (error || !inserted) throw error ?? new Error("insert failed");

        return NextResponse.json(await buildState(person));
      }

      case "respond": {
        if (!body.id || !["accepted", "declined"].includes(body.response ?? "")) {
          return NextResponse.json({ error: "Bad request" }, { status: 400 });
        }
        await supabase
          .from("extra_fun_challenges")
          .update({ status: body.response, responded_at: new Date().toISOString() })
          .eq("id", body.id)
          .eq("person", person)
          .eq("status", "offered");
        return NextResponse.json(await buildState(person));
      }

      case "complete": {
        if (!body.id || typeof body.completed !== "boolean") {
          return NextResponse.json({ error: "Bad request" }, { status: 400 });
        }
        await supabase
          .from("extra_fun_challenges")
          .update({
            status: body.completed ? "completed" : "not_completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", body.id)
          .eq("person", person)
          .eq("status", "accepted");
        return NextResponse.json(await buildState(person));
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[extra-fun]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
