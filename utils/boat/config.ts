// Boat Outlook — location + data-source configuration.
// Single-location personal project; these are fixed config constants.
// Recipient phone lives in the BOAT_OUTLOOK_PHONE env var.

export const BOAT_CONFIG = {
  locationName: 'Palm Harbor',
  waterName: 'St. Joseph Sound',
  timezone: 'America/New_York',
  lat: 28.085,
  lon: -82.764,

  // NOAA CO-OPS tide predictions (Dunedin, St. Joseph Sound).
  // Note: api.tidesandcurrents.gov can have DNS issues; the .noaa.gov host is canonical.
  tide: {
    host: 'https://api.tidesandcurrents.noaa.gov',
    station: '8726761', // Dunedin, St. Joseph Sound (8726833 Sutherland Bayou is datum-only)
    waterTempStation: '8726724', // Clearwater Beach — has a real water-temperature sensor
  },

  // NWS api.weather.gov
  nws: {
    grid: 'TBW/59,102', // land gridpoint for Palm Harbor (rain, temp, sustained wind, gusts)
    office: 'TBW',
    marineZone: 'GMZ853', // Coastal waters Englewood -> Tarpon Springs out 20 NM (winds in kt + seas)
  },

  userAgent: 'BudgeNudge Boat Outlook (stephen@contextmemo.com)',
} as const;
