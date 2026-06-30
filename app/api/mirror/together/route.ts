import { NextResponse } from "next/server";
import { challengeForDate } from "@/utils/mirror/connection-prompts";
import { familyForDate } from "@/utils/mirror/family-prompts";
import { loveQuoteForDate, marriageTipForDate } from "@/utils/mirror/love-content";
import { parentingTipForDate } from "@/utils/mirror/parenting-content";
import { faithFactForDate, faithTipForDate } from "@/utils/mirror/faith-content";

// "For us" widgets: verse of the day, fun fact, dad joke, plus a daily couple
// connection challenge and a family/parenting prompt. Verse, fun fact, and joke
// come from free, keyless APIs; the challenge + family prompt are authored
// content that rotates daily. Cached for 6 hours.
export const revalidate = 21600;

async function getVerse(): Promise<{ text: string; reference: string } | null> {
  try {
    const res = await fetch(
      "https://beta.ourmanna.com/api/v1/get/?format=json&order=daily",
      { next: { revalidate } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const details = data?.verse?.details;
    if (!details?.text) return null;
    return {
      text: String(details.text).trim(),
      reference: String(details.reference ?? "").trim(),
    };
  } catch {
    return null;
  }
}

async function getFunFact(): Promise<string | null> {
  try {
    const res = await fetch(
      "https://uselessfacts.jsph.pl/api/v2/facts/today",
      { next: { revalidate }, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.text ? String(data.text).trim() : null;
  } catch {
    return null;
  }
}

async function getJoke(): Promise<string | null> {
  try {
    const res = await fetch("https://icanhazdadjoke.com/", {
      next: { revalidate },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.joke ? String(data.joke).trim() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [verse, funFact, joke] = await Promise.all([
    getVerse(),
    getFunFact(),
    getJoke(),
  ]);
  return NextResponse.json({
    verse,
    funFact,
    joke,
    challenge: challengeForDate(),
    family: familyForDate(),
    loveQuote: loveQuoteForDate(),
    marriageTip: marriageTipForDate(),
    parentingTip: parentingTipForDate(),
    faithFact: faithFactForDate(),
    faithTip: faithTipForDate(),
  });
}
