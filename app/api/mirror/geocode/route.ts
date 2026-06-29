import { NextRequest, NextResponse } from "next/server";

// Open-Meteo geocoding (free, keyless). Lets the user search for a city to set
// the dashboard location without granting browser geolocation.
export const revalidate = 86400; // 1 day

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const params = new URLSearchParams({
    name: q,
    count: "5",
    language: "en",
    format: "json",
  });

  try {
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
      next: { revalidate },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding error" }, { status: 502 });
    }

    const data = await res.json();
    const results = (data.results ?? []).map(
      (r: {
        id: number;
        name: string;
        latitude: number;
        longitude: number;
        admin1?: string;
        country?: string;
        country_code?: string;
      }) => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        admin1: r.admin1 ?? null,
        country: r.country ?? null,
        countryCode: r.country_code ?? null,
      })
    );

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Failed to geocode" }, { status: 500 });
  }
}
