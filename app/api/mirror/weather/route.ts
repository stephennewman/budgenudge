import { NextRequest, NextResponse } from "next/server";

// Open-Meteo is free and keyless. We proxy it server-side so we can combine the
// forecast + air-quality calls, cache the response, and avoid CORS edge cases on
// the wall display.
export const revalidate = 300; // 5 minutes

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const tempUnit = searchParams.get("unit") === "celsius" ? "celsius" : "fahrenheit";
  const windUnit = tempUnit === "celsius" ? "kmh" : "mph";

  if (!lat || !lon || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lon" },
      { status: 400 }
    );
  }

  const forecastParams = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
    temperature_unit: tempUnit,
    wind_speed_unit: windUnit,
    timezone: "auto",
    forecast_days: "7",
  });

  const airParams = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "us_aqi",
    timezone: "auto",
  });

  try {
    const [forecastRes, airRes] = await Promise.all([
      fetch(`${FORECAST_URL}?${forecastParams.toString()}`, {
        next: { revalidate },
      }),
      fetch(`${AIR_QUALITY_URL}?${airParams.toString()}`, {
        next: { revalidate },
      }),
    ]);

    if (!forecastRes.ok) {
      return NextResponse.json(
        { error: "Weather provider error" },
        { status: 502 }
      );
    }

    const forecast = await forecastRes.json();
    const air = airRes.ok ? await airRes.json() : null;

    return NextResponse.json({
      tempUnit,
      windUnit,
      timezone: forecast.timezone,
      current: forecast.current,
      currentUnits: forecast.current_units,
      hourly: forecast.hourly,
      daily: forecast.daily,
      dailyUnits: forecast.daily_units,
      aqi: air?.current?.us_aqi ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
