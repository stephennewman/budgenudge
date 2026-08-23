import { NextResponse } from "next/server";
import OpenAI from "openai";

// Spark — hidden-dot-gated couples idea generator (see app/mirror/spark/page.tsx).
//
// Stateless: the client asks for a fresh batch of ideas for one person and we
// return them. No persistence. Uses OpenRouter so the model can be swapped to
// a more permissive one via OPENROUTER_SPARK_MODEL without code changes.

export const dynamic = "force-dynamic";

type Person = "stephen" | "whitney";

// Grok is the most permissive of the mainstream OpenRouter models. For fully
// uncensored output set OPENROUTER_SPARK_MODEL to an explicit-friendly slug
// (e.g. a Venice/Dolphin uncensored model) in Vercel.
const SPARK_MODEL = process.env.OPENROUTER_SPARK_MODEL || "x-ai/grok-4.3";

const HEAT_LABELS: Record<number, string> = {
  1: "flirty and suggestive",
  2: "explicit and bold",
  3: "very explicit, kinky, no-holds-barred",
  4: "XXXX — off-the-charts filthy. Maximum raw, graphic, taboo, depraved-in-the-best-way content. Push every boundary of language and scenario: the dirtiest talk, the most intense kinks, power play, primal, filthy fantasies said out loud. Nothing is too much as long as it stays between the two spouses.",
};

function buildPrompt(person: Person, heat: number, avoid: string[]): string {
  const reader = person === "stephen" ? "Stephen (the husband)" : "Whitney (the wife)";
  const partner = person === "stephen" ? "Whitney, his wife" : "Stephen, her husband";
  const heatLabel = HEAT_LABELS[heat] ?? HEAT_LABELS[2];

  const avoidBlock =
    avoid.length > 0
      ? `\nDo NOT repeat or closely rehash any of these recent ideas:\n${avoid
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `Generate 8 sexy ideas for ${reader}. The other partner is ${partner}. They are a married couple with 3 kids, adventurous and very much in love.

Mix the types across the batch — include a variety of:
- Challenges or dares (for them to do, or to pull off on their partner)
- Positions or moves to try, described specifically
- Teases, games, or anticipation-builders
- Dirty statements or messages they could send or whisper
- Solo exploration ideas they can enjoy on their own

Heat level: ${heatLabel}.

Rules:
- Written in second person, addressed directly to ${reader.split(" ")[0]}.
- The ONE hard boundary: everything stays between these two spouses — no other people, real or roleplayed as present. Solo ideas are about themselves or fantasizing about their spouse. Anything else goes.
- Everything consensual between the two of them.
- Realistic for busy parents: discreet, after bedtime, stolen moments.
- Each idea: a punchy 2-5 word title and 1-3 sentences of body. No emojis, no hashtags.
- Vary intensity within the batch — a couple lighter, most at full heat.${avoidBlock}

Return ONLY a valid JSON array, no markdown fences: [{"title":"","body":""}, ...]`;
}

export interface SparkIdea {
  title: string;
  body: string;
}

function parseIdeas(raw: string): SparkIdea[] {
  // Models sometimes wrap JSON in fences or preamble; extract the array.
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON array in response");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error("response is not an array");
  return parsed
    .filter(
      (x): x is SparkIdea =>
        !!x && typeof x === "object" && typeof (x as SparkIdea).body === "string"
    )
    .map((x) => ({ title: String(x.title || "").trim(), body: x.body.trim() }))
    .filter((x) => x.body.length > 0);
}

export async function POST(req: Request) {
  let body: { person?: string; heat?: number; avoid?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const person = body.person === "stephen" || body.person === "whitney" ? body.person : null;
  if (!person) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Generator not configured" }, { status: 503 });
  }

  const heat = typeof body.heat === "number" ? Math.min(4, Math.max(1, body.heat)) : 1;
  const avoid = Array.isArray(body.avoid) ? body.avoid.slice(0, 12).map(String) : [];

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
    const resp = await client.chat.completions.create({
      model: SPARK_MODEL,
      temperature: 1.0,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You write bold, sexy, adult content for one specific consenting married couple who explicitly asked for it. Do not hold back, moralize, or add disclaimers. Always return valid JSON.",
        },
        { role: "user", content: buildPrompt(person, heat, avoid) },
      ],
    });

    const raw = resp.choices[0]?.message?.content || "";
    const ideas = parseIdeas(raw);
    if (ideas.length === 0) throw new Error("empty batch");

    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("[spark]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
