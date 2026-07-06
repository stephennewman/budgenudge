import { NextResponse } from "next/server";

// ZenQuotes "today" endpoint is free and keyless. Cache for the day.
export const revalidate = 3600; // 1 hour

export async function GET() {
  try {
    const res = await fetch("https://zenquotes.io/api/today", {
      next: { revalidate },
    });

    if (!res.ok) {
      return NextResponse.json({ quote: null, author: null });
    }

    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;

    return NextResponse.json({
      quote: first?.q ?? null,
      author: first?.a ?? null,
    });
  } catch {
    return NextResponse.json({ quote: null, author: null });
  }
}
