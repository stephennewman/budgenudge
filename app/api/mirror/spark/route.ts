import OpenAI from "openai";
import { NextResponse } from "next/server";
import { CATEGORIES } from "@/app/mirror/spark/categories";

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

function buildPrompt(
  person: Person,
  categoryName: string,
  categoryHint: string,
  level: number,
  avoid: string[]
): string {
  const reader = person === "stephen" ? "Stephen (the husband)" : "Whitney (the wife)";
  const partner = person === "stephen" ? "Whitney, his wife" : "Stephen, her husband";

  const avoidBlock =
    avoid.length > 0
      ? `\nDo NOT repeat or closely rehash any of these recent ideas:\n${avoid
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `Generate ONE sexy idea for ${reader} in the category "${categoryName}" — ${categoryHint}. The other partner is ${partner}. They are a married couple with 3 kids, adventurous and very much in love.

This idea is one step on a 4-level heat ladder. Write it at exactly this level:
${LEVEL_SPECS[level]}

Rules:
- Perspective: speak directly TO ${reader.split(" ")[0]} as "you", and refer to ${partner} by name in the third person (e.g. ${person === "stephen" ? '"tell Whitney...", "watch her..."' : '"tell Stephen...", "watch him..."'}). Never call ${partner.split(",")[0]} "you".
- The ONE exception: quoted words meant to be copied or spoken (a text message, a whispered line, dirty talk) are written in first person, in ${reader.split(" ")[0]}'s own voice, as if ${reader.split(" ")[0]} is saying them to ${partner.split(",")[0]}.
- Inside those quoted words, NEVER use either spouse's name — spouses talking to each other say "you" (or a pet name like "babe"), not each other's names. Names only appear in the surrounding instructions, never in the quote itself.
- ${reader.split(" ")[0]} is the one acting: every idea is something ${reader.split(" ")[0]} does, says, sends, or wears for ${partner.split(",")[0]} — never the other way around.
- The ONE hard boundary: everything stays between these two spouses — no other people, real or roleplayed as present. Solo ideas are about themselves or fantasizing about their spouse. Anything else goes.
- Everything consensual between the two of them.
- NO pregnancy, breeding, impregnation, or "give me a baby" themes of any kind — not even as dirty talk. This topic is permanently off the table.
- Realistic for busy parents: discreet, after bedtime, stolen moments.
- A punchy 2-4 word title and a SHORT body: 1-2 sentences, 30 words max. Every word earns its place. No emojis, no hashtags.${avoidBlock}

Return ONLY a valid JSON object, no markdown fences: {"title":"","body":""}`;
}

export interface SparkIdea {
  level: number;
  title: string;
  body: string;
}

function parseIdea(raw: string, level: number): SparkIdea {
  // Models sometimes wrap JSON in fences or preamble; extract the object.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object in response");
  const x = JSON.parse(raw.slice(start, end + 1)) as { title?: unknown; body?: unknown };
  const body = typeof x.body === "string" ? x.body.trim() : "";
  if (!body) throw new Error("empty body");
  return { level, title: String(x.title || "").trim(), body };
}

export async function POST(req: Request) {
  let body: { person?: string; category?: string; level?: number; avoid?: string[] };
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
  if (!person || !category || !level) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Generator not configured" }, { status: 503 });
  }

  const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 12).map(String) : [];

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
          content: buildPrompt(person, category.name, category.hint, level, avoid),
        },
      ],
      // OpenRouter extension: skip the reasoning/thinking pass. Grok otherwise
      // burns ~10s "thinking" before the first output token, which is nearly
      // all of the perceived latency for a 60-token response.
      ...({ reasoning: { enabled: false } } as Record<string, unknown>),
    });

    const raw = resp.choices[0]?.message?.content || "";
    return NextResponse.json({ idea: parseIdea(raw, level) });
  } catch (err) {
    console.error("[spark]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
