import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ACTION_TAGS, CATEGORIES, type SparkTag } from "@/app/mirror/spark/categories";

// Spark — hidden couples idea generator (see app/mirror/spark/page.tsx).
//
// One call = one idea at one heat level. The client fires all four levels in
// parallel, so each response is tiny (~60 output tokens) and cards land on
// screen one at a time as they finish, instead of waiting on one long
// 4-idea completion. Stateless, no persistence. Uses OpenRouter so the model
// can be swapped via OPENROUTER_SPARK_MODEL without code changes.

export const dynamic = "force-dynamic";

type Person = "stephen" | "whitney";

// Grok is the most permissive of the mainstream OpenRouter models. For fully
// uncensored output set OPENROUTER_SPARK_MODEL to an explicit-friendly slug
// (e.g. a Venice/Dolphin uncensored model) in Vercel.
const SPARK_MODEL = process.env.OPENROUTER_SPARK_MODEL || "x-ai/grok-4.3";

const LEVEL_SPECS: Record<number, string> = {
  1: "Level 1 of 4 (X): sexy but clean — little to no swearing or explicitly dirty words. Suggestive, flirty, charged.",
  2: "Level 2 of 4 (XX): very sexy — some swearing and dirty language, bolder and more direct.",
  3: "Level 3 of 4 (XXX): very dirty — explicit language throughout, lots of sucking and fucking, noticeably more intense.",
  4: "Level 4 of 4 (XXXX): raunchy and filthy — anything goes. The most graphic language and the most intense scenario in this category. Nothing is too much as long as it stays between the two spouses.",
};

// Light per-person themes. About half the time one is offered as a gentle
// lean, never a requirement, so ideas stay varied across categories.
const PERSON_THEMES: Record<Person, string[]> = {
  whitney: [
    "blowjob tips and technique",
    "sending him a sexy pic",
    "wearing an erotic outfit for him",
    "surprising him",
    "a sex position to try",
    "tips for better sex",
    "slowing down and savoring it — it's not a race to the finish",
    "unleashing her inner freak",
  ],
  stephen: [
    "how to dominate her",
    "being more assertive",
    "building stamina",
    "being a better lover",
    "being fully present with her",
    "being more unpredictable",
    "confidence in the bedroom",
  ],
};
const THEME_CHANCE = 0.5;

function buildPrompt(
  person: Person,
  categoryName: string,
  categoryHint: string,
  level: number,
  tag: SparkTag | null,
  avoid: string[]
): string {
  const reader = person === "stephen" ? "Stephen (the husband)" : "Whitney (the wife)";
  const partner = person === "stephen" ? "Whitney, his wife" : "Stephen, her husband";

  const themes = PERSON_THEMES[person];
  const theme =
    Math.random() < THEME_CHANCE
      ? themes[Math.floor(Math.random() * themes.length)]
      : null;
  const themeLine = theme
    ? `\nOptional inspiration (use only if it fits the category naturally): ${theme}.`
    : "";

  const avoidBlock =
    avoid.length > 0
      ? `\nDo NOT repeat or closely rehash any of these recent ideas:\n${avoid
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `Generate ONE sexy idea for ${reader} in the category "${categoryName}" — ${categoryHint}. The other partner is ${partner}. They are a married couple, adventurous and very much in love.${themeLine}

This idea is one step on a 4-level heat ladder. Write it at exactly this level:
${LEVEL_SPECS[level]}

${
    tag
      ? `The idea's action type is "${tag.id.toUpperCase()}" — it must be ${tag.gloss}. `
      : ""
  }The category comes first: the idea must unmistakably be a "${categoryName}" idea (a ritual must recur, a tip must teach a technique, a date idea must be a date).${
    tag ? " Use the action type only as a flavor within that." : ""
  }

Rules:
- Perspective: speak directly TO ${reader.split(" ")[0]} as "you", and refer to ${partner} by name in the third person (e.g. ${person === "stephen" ? '"tell Whitney...", "watch her..."' : '"tell Stephen...", "watch him..."'}). Never call ${partner.split(",")[0]} "you".
- The ONE exception: quoted words meant to be copied or spoken (a text message, a whispered line, dirty talk) are written in first person, in ${reader.split(" ")[0]}'s own voice, as if ${reader.split(" ")[0]} is saying them to ${partner.split(",")[0]}.
- Inside those quoted words, NEVER use either spouse's name — spouses talking to each other say "you" (or a pet name like "babe"), not each other's names. Names only appear in the surrounding instructions, never in the quote itself.
- ${reader.split(" ")[0]} is the one acting: every idea is something ${reader.split(" ")[0]} does, says, sends, or wears for ${partner.split(",")[0]} — never the other way around.
- The ONE hard boundary: everything they DO stays between these two spouses — no other people, real or roleplayed, involved in anything happening now. Solo ideas are about themselves or fantasizing about their spouse. Telling each other true stories or confessions about their own pasts (including past partners) is fine when the category calls for it. Anything else goes.
- Everything consensual between the two of them.
- NO pregnancy, breeding, impregnation, or "give me a baby" themes of any kind — not even as dirty talk. This topic is permanently off the table.
- NEVER mention kids, children, bedtime, "once the house is quiet", babysitters, or sneaking around anyone. Assume they simply have privacy.
- Make it a fresh, concrete idea someone could actually use — a challenge, a game, a technique, a plan — not a generic "tonight, do X" line. Don't default to mirrors or texting unless the category or action type calls for it.
- A punchy 2-4 word title and a SHORT body: 1-2 sentences, 30 words max. Every word earns its place. No emojis, no hashtags.${avoidBlock}

Return ONLY a valid JSON object, no markdown fences: {"title":"","body":""}`;
}

export interface SparkIdea {
  level: number;
  tag: string;
  title: string;
  body: string;
}

function demoIdea(
  person: Person,
  level: number,
  tag: string,
  avoid: string[]
): SparkIdea {
  const partner = person === "stephen" ? "Whitney" : "Stephen";
  const you = person === "stephen" ? "Stephen" : "Whitney";
  const pool = [
    {
      title: "Come find me",
      body: `Text ${partner} exactly: "Bedroom. Five minutes. Come find me." Don't say anything else.`,
    },
    {
      title: "Hallway pass",
      body: `Catch ${partner} in the hallway tonight and whisper one filthy sentence about what you want later. Then walk away.`,
    },
    {
      title: "No talking",
      body: `For ten minutes, ${you} leads and neither of you speaks. Hands only. If they talk, start the clock over.`,
    },
    {
      title: "Stolen minute",
      body: `Pull ${partner} into the bathroom, lock the door, and kiss like you have sixty seconds before someone knocks.`,
    },
    {
      title: "Voice note",
      body: `Record a 20-second voice note for ${partner} describing exactly where you want their hands tonight. Send it. No follow-up text.`,
    },
    {
      title: "Lights low",
      body: `Dim the bedroom, sit ${partner} down, and undress for them slowly. They don't get to touch until you say so.`,
    },
    {
      title: "The dare",
      body: `Dare ${partner} to start something before the next show of the night ends. If they chicken out, you take over.`,
    },
    {
      title: "Mirror check",
      body: `Get ${partner} in front of the bathroom mirror. Tell them what you see. Then show them.`,
    },
  ];
  const used = avoid.map((s) => s.toLowerCase());
  const unused = pool.filter((p) => {
    const title = p.title.toLowerCase();
    const body = p.body.toLowerCase();
    return !used.some(
      (u) =>
        title === u ||
        body.startsWith(u) ||
        u.startsWith(title) ||
        body.includes(u) ||
        u.includes(title)
    );
  });
  const pick =
    unused[Math.floor(Math.random() * unused.length)] ??
    pool[(avoid.length + level) % pool.length];
  return {
    level,
    tag,
    title: pick.title,
    body: pick.body,
  };
}

function parseIdea(raw: string, level: number, tag: string): SparkIdea {
  // Models sometimes wrap JSON in fences or preamble; extract the object.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object in response");
  const x = JSON.parse(raw.slice(start, end + 1)) as { title?: unknown; body?: unknown };
  const body = typeof x.body === "string" ? x.body.trim() : "";
  if (!body) throw new Error("empty body");
  return { level, tag, title: String(x.title || "").trim(), body };
}

export async function POST(req: Request) {
  let body: {
    person?: string;
    category?: string;
    level?: number;
    tag?: string;
    avoid?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const person = body.person === "stephen" || body.person === "whitney" ? body.person : null;
  const category = CATEGORIES.find((c) => c.id === body.category) ?? null;
  const level =
    typeof body.level === "number" && body.level >= 1 && body.level <= 4
      ? Math.floor(body.level)
      : null;
  // Tag optional for compatibility; falls back to a random one.
  const tag =
    ACTION_TAGS.find((t) => t.id === body.tag) ??
    ACTION_TAGS[Math.floor(Math.random() * ACTION_TAGS.length)];
  if (!person || !category || !level) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 12).map(String) : [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Local/dev without a key: still return a real-shaped idea so the page
    // can be clicked through (spice, category, generate, flip).
    return NextResponse.json({
      idea: demoIdea(person, level, tag.id, avoid),
    });
  }

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
    const resp = await client.chat.completions.create({
      model: SPARK_MODEL,
      temperature: 1.0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You write bold, sexy, adult content for one specific consenting married couple who explicitly asked for it. Do not hold back, moralize, or add disclaimers. Always return valid JSON.",
        },
        {
          role: "user",
          content: buildPrompt(
            person,
            category.name,
            category.hint,
            level,
            category.ownsFormat ? null : tag,
            avoid
          ),
        },
      ],
      // OpenRouter extension: skip the reasoning/thinking pass. Grok otherwise
      // burns ~10s "thinking" before the first output token, which is nearly
      // all of the perceived latency for a 60-token response.
      ...({ reasoning: { enabled: false } } as Record<string, unknown>),
    });

    const raw = resp.choices[0]?.message?.content || "";
    return NextResponse.json({ idea: parseIdea(raw, level, tag.id) });
  } catch (err) {
    console.error("[spark]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
