import { NextResponse } from "next/server";
import { getMirrorConditions } from "@/utils/mirror/conditions";

// Beach Day / Boat Day scores for today. Hits several external feeds (NWS,
// Open-Meteo, NOAA), so cache for 30 minutes.
export const revalidate = 1800;

export async function GET() {
  try {
    const conditions = await getMirrorConditions();
    return NextResponse.json(conditions);
  } catch {
    return NextResponse.json(
      { error: "Failed to compute conditions" },
      { status: 500 }
    );
  }
}
