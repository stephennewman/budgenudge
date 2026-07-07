"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/utils/styles";
import { createSupabaseClient } from "@/utils/supabase/client";
import { CONNECTION_PROMPTS } from "@/utils/mirror/connection-prompts";
import { FAMILY_PROMPTS } from "@/utils/mirror/family-prompts";
import { LOVE_QUOTES, MARRIAGE_TIPS } from "@/utils/mirror/love-content";
import { PARENTING_TIPS } from "@/utils/mirror/parenting-content";
import { FAITH_FACTS, FAITH_TIPS } from "@/utils/mirror/faith-content";
import {
  FRIENDS_REACH,
  FRIENDS_HELLO,
  FRIENDS_KEEP,
  friendsReachForDate,
  friendsHelloForDate,
  friendsKeepForDate,
} from "@/utils/mirror/friends-content";
import { HoneyDoCard } from "./honeydo-card";
import { TodayChannel } from "./today-channel";
import { STEPHEN_GROWTH, STEPHEN_CONNECT } from "@/utils/mirror/stephen-content";
import { WHITNEY_GROWTH, WHITNEY_CONNECT } from "@/utils/mirror/whitney-content";
import {
  Baby,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Church,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Cloudy,
  Droplets,
  Eye,
  EyeOff,
  Flame,
  Flower2,
  Gauge,
  GripVertical,
  Handshake,
  Heart,
  HeartHandshake,
  MessageCircle,
  Mountain,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Maximize,
  Minimize,
  MapPin,
  Moon,
  MoreVertical,
  CalendarClock,
  Pause,
  Pencil,
  Play,
  PieChart,
  Quote,
  Smile,
  Sparkles,
  Star,
  Users,
  RotateCcw,
  Sailboat,
  TrendingDown,
  TrendingUp,
  Search,
  Film,
  Snowflake,
  Sun,
  Tag,
  Ticket,
  UtensilsCrossed,
  Sunrise,
  Sunset,
  Umbrella,
  Wallet,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";

type Location = { lat: number; lon: number; label: string };

type WeatherData = {
  tempUnit: "fahrenheit" | "celsius";
  windUnit: string;
  timezone: string;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    uv_index?: number;
    time: string;
  };
  currentUnits: Record<string, string>;
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_probability_max: number[];
  };
  dailyUnits: Record<string, string>;
  aqi: number | null;
};

type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1: string | null;
  country: string | null;
  countryCode: string | null;
};

type ConditionScore = { score: number; label: string; reason: string };
type Conditions = {
  date: string;
  day?: "Today" | "Tomorrow";
  location: string;
  beach: ConditionScore;
  boat: ConditionScore;
};
type Together = {
  verse: { text: string; reference: string } | null;
  funFact: string | null;
  challenge: string | null;
  joke: string | null;
  family: string | null;
  loveQuote: { text: string; author: string } | null;
  marriageTip: string | null;
  parentingTip: string | null;
  faithFact: string | null;
  faithTip: string | null;
  stephenGrowth: string | null;
  stephenConnect: string | null;
  whitneyGrowth: string | null;
  whitneyConnect: string | null;
};
type MirrorEvent = {
  name: string;
  localDate: string;
  localTime: string | null;
  venue: string | null;
  city: string | null;
  distanceMiles: number | null;
  category: string | null;
  genre: string | null;
  priceMin: number | null;
  url: string | null;
};
type LocalItem = {
  title: string;
  date: string | null;
  schedule: string | null;
  time: string | null;
  venue: string | null;
  town: string | null;
  kind: "event" | "special";
  source: string | null;
};
type MediaItem = {
  type: "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  tmdbScore: number | null;
  rtScore: string | null;
  url: string | null;
};
type MediaSection = {
  id: string;
  label: string;
  items: MediaItem[];
};
type BogoData = {
  weekLabel: string | null;
  deals: {
    id: number;
    title: string;
    price: string | null;
    category?: string;
    starred?: boolean;
  }[];
};
type DinnerData = {
  weekLabel?: string;
  meals: {
    title: string;
    cuisine: string | null;
    bogoItems: string[];
    estCost: string | null;
  }[];
};
type PaceRow = {
  name: string;
  avgMonthly: number;
  actual: number;
  expected: number;
  pct: number | null;
  // Bills only: typical due-day window + the day paid in the viewed month.
  dayMin?: number;
  dayMax?: number;
  paidDay?: number | null;
};
type PacingData = {
  month?: string;
  monthKey?: string;
  isCurrentMonth?: boolean;
  dayOfMonth?: number;
  categories: PaceRow[];
  vendors: PaceRow[];
  bills?: PaceRow[];
};
type Breakdown = {
  label: string;
  total: number;
  categories: { name: string; amount: number }[];
  vendors: { name: string; amount: number }[];
};
type SpendData = {
  total: number;
  count: number;
  date: string;
  top?: { name: string; amount: number }[];
  recent?: { date: string; name: string; amount: number }[];
  trend?: {
    days: {
      date: string;
      total: number;
      txns?: { name: string; amount: number }[];
    }[];
    thisWeek: number;
    lastWeek: number;
    changePct: number | null;
    avgDaily?: number;
    streak?: number;
  };
  bills?: {
    items: { name: string; amount: number; date: string }[];
    total: number;
    count: number;
  };
  breakdown?: {
    period: string;
    total: number;
    categories: { name: string; amount: number }[];
    vendors: { name: string; amount: number }[];
  };
  week?: Breakdown;
  month?: Breakdown;
};

type Size = "small" | "medium" | "large" | "xlarge";

const STORAGE_KEY = "mirror.location";
const PROVIDERS_KEY = "mirror.movieProviders.v1";
const ORDER_KEY = "mirror.order.v3";
const SIZES_KEY = "mirror.sizes.v3";
const HIDDEN_KEY = "mirror.hidden.v3";

// Column span per size — width only; every tile is the same (1-row) height.
// Small = 1 col, Medium = 2, Large = 3, X-Large = 4 (full width on desktop).
// Statically listed so Tailwind keeps the classes.
const SIZE_SPAN: Record<Size, string> = {
  small: "col-span-1",
  medium: "col-span-1 sm:col-span-2",
  large: "col-span-1 sm:col-span-2 lg:col-span-3",
  xlarge: "col-span-1 sm:col-span-2 lg:col-span-4",
};

const SIZE_ORDER: Size[] = ["small", "medium", "large", "xlarge"];

// Short label for the size toggle (small→S, medium→M, large→L, xlarge→XL).
const SIZE_LABEL: Record<Size, string> = {
  small: "S",
  medium: "M",
  large: "L",
  xlarge: "XL",
};

// Every widget tile is this tall, so resizing only changes width, never height.
// Content taller than this scrolls within the tile.
const TILE_HEIGHT = 280;

// Exception: list-heavy widgets that span two grid rows, rendering as
// full-height columns so more of the list is visible without scrolling.
const TALL_WIDGETS = new Set(["events", "movies", "bogos", "dinner", "pacing", "honeydo"]);

// Widgets are grouped into auto-rotating channels. Order here is the channel order.
const CATEGORIES: { id: string; label: string; ids: string[] }[] = [
  { id: "faith", label: "Faith", ids: ["verse", "faithfact", "faithtip"] },
  { id: "love", label: "Love", ids: ["together", "marriage", "lovequote"] },
  {
    id: "stephen",
    label: "For Stephen",
    ids: ["stephengrowth", "stephenconnect"],
  },
  {
    id: "whitney",
    label: "For Whitney",
    ids: ["whitneygrowth", "whitneyconnect"],
  },
  { id: "family", label: "Family", ids: ["family", "parenting", "joke", "funfact"] },
  {
    id: "friends",
    label: "Friends",
    ids: ["friendsreach", "friendshello", "friendskeep"],
  },
  { id: "honeydo", label: "HoneyDo", ids: ["honeydo"] },
  { id: "money", label: "Money", ids: ["pacing", "spend", "bills", "budget"] },
  { id: "deals", label: "BOGO Deals", ids: ["bogos", "dinner"] },
  { id: "movies", label: "Now Showing", ids: ["movies"] },
  {
    id: "weather",
    label: "Weather",
    ids: ["current", "forecast", "hourly", "glance", "beach", "boat", "sun"],
  },
  { id: "events", label: "Out & About", ids: ["events"] },
];

// Flattened default widget order, derived from the channel layout above.
const DEFAULT_ORDER = CATEGORIES.flatMap((c) => c.ids);

// Sidebar icon per channel.
const NAV_ICONS: Record<string, LucideIcon> = {
  today: CalendarClock,
  weather: Sun,
  events: Ticket,
  movies: Film,
  deals: Tag,
  money: Wallet,
  honeydo: ListChecks,
  love: Heart,
  family: Users,
  friends: Handshake,
  faith: Church,
  stephen: Mountain,
  whitney: Flower2,
};

// How long each channel stays on screen before auto-advancing.
const ROTATE_MS = 30000;

// Sensible default width for each widget based on how much it shows.
const DEFAULT_SIZE: Record<string, Size> = {
  // Weather
  current: "medium",
  forecast: "large",
  hourly: "xlarge",
  glance: "medium",
  beach: "small",
  boat: "small",
  sun: "medium",
  // Out & About (full-width weekly calendar: ticketed + hyperlocal merged)
  events: "xlarge",
  // Now Showing / BOGO Deals
  movies: "xlarge",
  bogos: "medium",
  dinner: "medium",
  // HoneyDo
  honeydo: "xlarge",
  // Money
  pacing: "large",
  budget: "xlarge",
  spend: "small",
  bills: "medium",
  // Love / Family / Faith text cards (2-up, readable)
  together: "medium",
  marriage: "medium",
  lovequote: "medium",
  family: "medium",
  parenting: "medium",
  joke: "medium",
  funfact: "medium",
  // Friends & Connections
  friendsreach: "medium",
  friendshello: "medium",
  friendskeep: "medium",
  verse: "medium",
  faithfact: "medium",
  faithtip: "medium",
  // For Stephen / For Whitney
  stephengrowth: "medium",
  stephenconnect: "medium",
  whitneygrowth: "medium",
  whitneyconnect: "medium",
};

// Map WMO weather codes to a label + icon. Day/night aware where it matters.
function weatherInfo(code: number, isDay: boolean): { label: string; Icon: LucideIcon } {
  const clearIcon = isDay ? Sun : Moon;
  const partlyIcon = isDay ? CloudSun : CloudMoon;
  switch (code) {
    case 0:
      return { label: "Clear", Icon: clearIcon };
    case 1:
      return { label: "Mostly clear", Icon: partlyIcon };
    case 2:
      return { label: "Partly cloudy", Icon: partlyIcon };
    case 3:
      return { label: "Overcast", Icon: Cloudy };
    case 45:
    case 48:
      return { label: "Fog", Icon: CloudFog };
    case 51:
    case 53:
    case 55:
      return { label: "Drizzle", Icon: CloudDrizzle };
    case 56:
    case 57:
      return { label: "Freezing drizzle", Icon: CloudDrizzle };
    case 61:
    case 63:
    case 65:
      return { label: "Rain", Icon: CloudRain };
    case 66:
    case 67:
      return { label: "Freezing rain", Icon: CloudRain };
    case 71:
    case 73:
    case 75:
      return { label: "Snow", Icon: CloudSnow };
    case 77:
      return { label: "Snow grains", Icon: Snowflake };
    case 80:
    case 81:
    case 82:
      return { label: "Rain showers", Icon: CloudRain };
    case 85:
    case 86:
      return { label: "Snow showers", Icon: CloudSnow };
    case 95:
      return { label: "Thunderstorm", Icon: CloudLightning };
    case 96:
    case 99:
      return { label: "Thunderstorm + hail", Icon: CloudLightning };
    default:
      return { label: "—", Icon: Cloud };
  }
}

// Color for a weather icon based on its WMO code (adds life vs all-white).
function weatherColor(code: number, isDay: boolean): string {
  if (code <= 1) return isDay ? "text-amber-300" : "text-indigo-200";
  if (code === 2) return isDay ? "text-amber-200" : "text-indigo-200";
  if (code === 3) return "text-slate-200";
  if (code === 45 || code === 48) return "text-slate-300";
  if (code >= 95) return "text-yellow-300";
  if (code >= 71 && code <= 86) return "text-cyan-100";
  if (code >= 51) return "text-sky-300";
  return "text-white";
}

type DayPart = "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night";

function dayPart(hour: number): DayPart {
  if (hour < 5) return "night";
  if (hour < 8) return "dawn";
  if (hour < 11) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

// Background gradient that shifts through the day.
// Every stop keeps >=4.5:1 contrast for white text, even under the
// rgba(255,255,255,0.12) card overlays, while preserving each day part's hue.
const GRADIENTS: Record<DayPart, string> = {
  dawn: "linear-gradient(160deg, #1c0a3e 0%, #31417f 70%, #8a4a2e 100%)",
  morning: "linear-gradient(160deg, #16305e 0%, #20416f 55%, #2f5f95 100%)",
  midday: "linear-gradient(160deg, #02485e 0%, #005b7a 60%, #0f7396 100%)",
  afternoon: "linear-gradient(160deg, #0f3e70 0%, #1b4f82 55%, #7e5420 100%)",
  evening: "linear-gradient(160deg, #20002c 0%, #8c2449 60%, #a34a1e 100%)",
  night: "linear-gradient(160deg, #020111 0%, #0a1a3f 55%, #20305f 100%)",
};

function aqiInfo(aqi: number): { label: string; color: string } {
  if (aqi <= 50) return { label: "Good", color: "#9be89b" };
  if (aqi <= 100) return { label: "Moderate", color: "#f7e479" };
  if (aqi <= 150) return { label: "Unhealthy (sensitive)", color: "#f7b267" };
  if (aqi <= 200) return { label: "Unhealthy", color: "#f4796b" };
  if (aqi <= 300) return { label: "Very unhealthy", color: "#c780e8" };
  return { label: "Hazardous", color: "#e87a7a" };
}

type WidgetDef = {
  id: string;
  title: string;
  available: boolean;
  node: React.ReactNode;
};

// 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd" …
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// "YYYY-MM" for the month `monthsBack` months before the current one.
function monthKeyFromOffset(monthsBack: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsBack);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export default function MirrorPage() {
  const [now, setNow] = useState<Date>(new Date());
  const [location, setLocation] = useState<Location | null>(null);
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [events, setEvents] = useState<MirrorEvent[] | null>(null);
  const [localItems, setLocalItems] = useState<LocalItem[] | null>(null);
  const [movies, setMovies] = useState<MediaSection[] | null>(null);
  // Extra streaming-service tabs (TMDB provider IDs) added on this device.
  const [extraProviders, setExtraProviders] = useState<number[]>([]);
  const [bogos, setBogos] = useState<BogoData | null>(null);
  const [dinner, setDinner] = useState<DinnerData | null>(null);
  const [together, setTogether] = useState<Together | null>(null);
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [pacing, setPacing] = useState<PacingData | null>(null);
  // How many months back the pacing card is showing (0 = current month).
  const [pacingMonthsBack, setPacingMonthsBack] = useState(0);
  const [moneyRefresh, setMoneyRefresh] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasInit = useRef(false);

  // Dashboard customization state.
  const [editMode, setEditMode] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Channel navigation state.
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  // Load saved customization once on mount.
  useEffect(() => {
    const savedOrder = readJSON<string[]>(ORDER_KEY);
    if (savedOrder) setOrder(savedOrder);
    const savedSizes = readJSON<Record<string, Size>>(SIZES_KEY);
    if (savedSizes) setSizes(savedSizes);
    const savedHidden = readJSON<string[]>(HIDDEN_KEY);
    if (savedHidden) setHidden(new Set(savedHidden));
    const savedProviders = readJSON<number[]>(PROVIDERS_KEY);
    if (savedProviders) setExtraProviders(savedProviders);
  }, []);

  const save = useCallback((key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, []);

  const saveProviders = useCallback(
    (next: number[]) => {
      setExtraProviders(next);
      save(PROVIDERS_KEY, next);
    },
    [save]
  );

  const toggleWidget = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        save(HIDDEN_KEY, [...next]);
        return next;
      });
    },
    [save]
  );

  const setWidgetSize = useCallback(
    (id: string, size: Size) => {
      setSizes((prev) => {
        const next = { ...prev, [id]: size };
        save(SIZES_KEY, next);
        return next;
      });
    },
    [save]
  );

  const autoArrange = useCallback(() => {
    setOrder([]);
    setSizes({});
    try {
      localStorage.removeItem(ORDER_KEY);
      localStorage.removeItem(SIZES_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const resetAll = useCallback(() => {
    setOrder([]);
    setSizes({});
    setHidden(new Set());
    try {
      localStorage.removeItem(ORDER_KEY);
      localStorage.removeItem(SIZES_KEY);
      localStorage.removeItem(HIDDEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // Ticking clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const saveLocation = useCallback((loc: Location) => {
    setLocation(loc);
    setNeedsLocation(false);
    setShowSearch(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } catch {
      /* ignore */
    }
  }, []);

  // Resolve a location: URL params -> saved -> browser geolocation.
  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    const params = new URLSearchParams(window.location.search);

    // Finance access token: from URL (then persisted) or previously saved.
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
      try {
        localStorage.setItem("mirror.token", urlToken);
      } catch {
        /* ignore */
      }
    } else {
      try {
        const savedToken = localStorage.getItem("mirror.token");
        if (savedToken) setToken(savedToken);
      } catch {
        /* ignore */
      }
    }

    const lat = params.get("lat");
    const lon = params.get("lon");
    if (lat && lon && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon))) {
      saveLocation({
        lat: Number(lat),
        lon: Number(lon),
        label: params.get("place") || "Your location",
      });
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setLocation(JSON.parse(saved));
        return;
      }
    } catch {
      /* ignore */
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          saveLocation({
            lat: Number(pos.coords.latitude.toFixed(4)),
            lon: Number(pos.coords.longitude.toFixed(4)),
            label: "Your location",
          }),
        () => setNeedsLocation(true),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    } else {
      setNeedsLocation(true);
    }
  }, [saveLocation]);

  // Fetch weather when location is known, then refresh every 5 minutes.
  useEffect(() => {
    if (!location) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/mirror/weather?lat=${location.lat}&lon=${location.lon}`
        );
        if (!res.ok) throw new Error("weather");
        const json = (await res.json()) as WeatherData;
        if (active) {
          setData(json);
          setError(null);
        }
      } catch {
        if (active) setError("Couldn't load weather");
      }
    };

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [location]);

  // City search (debounced).
  useEffect(() => {
    if (!showSearch || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mirror/geocode?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (active) setResults(json.results ?? []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [query, showSearch]);

  // Beach Day / Boat Day scores (Palm Harbor). Refresh every 30 minutes.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/mirror/conditions");
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.beach && json.boat) setConditions(json);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Nearby events (Ticketmaster). Server falls back to Palm Harbor when no
  // location is set. Refresh hourly.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // 28 days so the Out & About card can cycle through future weeks.
        let qs = "?days=28";
        if (location) qs += `&lat=${location.lat}&lon=${location.lon}`;
        const res = await fetch(`/api/mirror/events${qs}`);
        if (!res.ok) return;
        const json = await res.json();
        if (active) setEvents(json.items ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [location]);

  // "Around Town" hyperlocal happenings (weekly cron snapshot). Refresh hourly.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/mirror/local");
        if (!res.ok) return;
        const json = await res.json();
        if (active) setLocalItems(json.items ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Now Showing channel. Refetches when extra provider tabs change; server
  // caches heavily, so refresh every 6 hours on the client.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const qs =
          extraProviders.length > 0 ? `?extra=${extraProviders.join(",")}` : "";
        const res = await fetch(`/api/mirror/movies${qs}`);
        if (!active || !res.ok) return;
        const json = await res.json();
        setMovies((json.sections ?? []) as MediaSection[]);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 6 * 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [extraProviders]);

  // BOGO Deals channel. Server routes cache heavily; refresh every 6 hours.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [bogoRes, dinRes] = await Promise.all([
          fetch("/api/mirror/bogos"),
          fetch("/api/mirror/dinner"),
        ]);
        if (!active) return;
        if (bogoRes.ok) setBogos(await bogoRes.json());
        if (dinRes.ok) setDinner(await dinRes.json());
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 6 * 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // "For us" widgets: verse, fun fact, daily connection challenge. Refresh hourly.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/mirror/together");
        if (!res.ok) return;
        const json = await res.json();
        if (active) setTogether(json);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Fullscreen toggle (with webkit fallback for older Safari). Kiosk mode for
  // the bathroom mirror.
  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => void;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    try {
      if (!isFs) {
        if (el.requestFullscreen) el.requestFullscreen();
        else el.webkitRequestFullscreen?.();
      } else {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const onChange = () =>
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // Detect standalone (added to home screen) mode: already chrome-free there,
  // so the fullscreen toggle is pointless and hidden.
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        nav.standalone === true
    );
  }, []);

  // Detect a logged-in Supabase session so finance data can load without a token.
  useEffect(() => {
    let active = true;
    const supabase = createSupabaseClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setAuthed(!!data.user);
      })
      .catch(() => {
        if (active) setAuthed(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Yesterday's spend. The server authorizes via the logged-in session (the
  // user's own data) or the shared finance token, so we always attempt the
  // fetch and let a 401 simply hide the Money channel. Refetches on login and
  // refreshes every 30 min. `authed` is a dependency so logging in re-triggers.
  useEffect(() => {
    let active = true;
    const tz = data?.timezone;
    const load = async () => {
      try {
        const qs = new URLSearchParams();
        if (token) qs.set("token", token);
        if (tz) qs.set("tz", tz);
        const suffix = qs.toString() ? `?${qs}` : "";
        const paceQs = new URLSearchParams(qs);
        if (pacingMonthsBack > 0) {
          paceQs.set("month", monthKeyFromOffset(pacingMonthsBack));
        }
        const paceSuffix = paceQs.toString() ? `?${paceQs}` : "";
        const [res, paceRes] = await Promise.all([
          fetch(`/api/mirror/spend${suffix}`),
          fetch(`/api/mirror/pacing${paceSuffix}`),
        ]);
        if (!res.ok) {
          if (active) setSpend(null);
        } else {
          const json = await res.json();
          if (active) setSpend(json);
        }
        if (paceRes.ok) {
          const json = await paceRes.json();
          if (active) setPacing(json);
        } else if (active) {
          setPacing(null);
        }
      } catch {
        if (active) {
          setSpend(null);
          setPacing(null);
        }
      }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, authed, data?.timezone, moneyRefresh, pacingMonthsBack]);

  // Tag a burn transaction's merchant as a recurring bill, then refresh the
  // money widgets so it moves from burn/pacing into the bills group.
  const tagAsBill = useCallback(
    async (name: string, amount: number) => {
      const qs = new URLSearchParams();
      if (token) qs.set("token", token);
      const suffix = qs.toString() ? `?${qs}` : "";
      const res = await fetch(`/api/mirror/tag-bill${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_name: name, expected_amount: amount }),
      });
      if (!res.ok) throw new Error("Failed to tag as bill");
      setMoneyRefresh((n) => n + 1);
    },
    [token]
  );

  // Star/unstar a BOGO deal (shared across all mirrors). Optimistic: flip
  // locally first, then persist; revert on failure.
  const toggleStar = useCallback(
    async (id: number, starred: boolean) => {
      const flip = (value: boolean) =>
        setBogos((prev) =>
          prev
            ? {
                ...prev,
                deals: prev.deals.map((d) =>
                  d.id === id ? { ...d, starred: value } : d
                ),
              }
            : prev
        );
      flip(starred);
      try {
        const qs = new URLSearchParams();
        if (token) qs.set("token", token);
        const suffix = qs.toString() ? `?${qs}` : "";
        const res = await fetch(`/api/mirror/star-deal${suffix}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, starred }),
        });
        if (!res.ok) flip(!starred);
      } catch {
        flip(!starred);
      }
    },
    [token]
  );

  // Remove a bill tag from the mirror; the merchant returns to burn/pacing.
  const untagBill = useCallback(
    async (name: string) => {
      const qs = new URLSearchParams();
      if (token) qs.set("token", token);
      const suffix = qs.toString() ? `?${qs}` : "";
      const res = await fetch(`/api/mirror/tag-bill${suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_name: name, action: "remove" }),
      });
      if (!res.ok) throw new Error("Failed to remove bill");
      setMoneyRefresh((n) => n + 1);
    },
    [token]
  );

  const part = dayPart(now.getHours());
  const gradient = GRADIENTS[part];

  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  // "09:55 AM" -> digits for the big flip-style clock + meridiem shown small.
  // Some browsers use a narrow no-break space before AM/PM, hence \s.
  const [clockDigits, meridiem] = timeStr.split(/\s+/);
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  // "Monday, July 6" -> weekday on the left, "July 6" on the right.
  const [dateWeekday, dateRest = ""] = dateStr.split(/,\s*/);

  const unitLabel = data?.tempUnit === "celsius" ? "°C" : "°F";

  const current = data?.current;
  const currentInfo = current
    ? weatherInfo(current.weather_code, current.is_day === 1)
    : null;

  // Next 8 hours starting from the current hour.
  const hours = useMemo(() => {
    if (!data) return [];
    const nowMs = Date.now();
    const out: { time: string; temp: number; pop: number; code: number; isDay: boolean }[] =
      [];
    for (let i = 0; i < data.hourly.time.length && out.length < 8; i++) {
      const t = new Date(data.hourly.time[i]).getTime();
      if (t < nowMs - 60 * 60 * 1000) continue;
      out.push({
        time: data.hourly.time[i],
        temp: data.hourly.temperature_2m[i],
        pop: data.hourly.precipitation_probability[i],
        code: data.hourly.weather_code[i],
        isDay: data.hourly.is_day[i] === 1,
      });
    }
    return out;
  }, [data]);

  const todaySun = useMemo(
    () =>
      data ? { sunrise: data.daily.sunrise[0], sunset: data.daily.sunset[0] } : null,
    [data]
  );

  // Registry of every dashboard widget with its content.
  const widgets = useMemo<WidgetDef[]>(() => {
    return [
      {
        id: "current",
        title: "Current weather",
        available: !!(current && currentInfo),
        node:
          current && currentInfo ? (
            <CurrentWeatherCard
              current={current}
              currentInfo={currentInfo}
              data={data}
              unitLabel={unitLabel}
            />
          ) : null,
      },
      {
        id: "glance",
        title: "At a glance",
        available: !!current,
        node: current ? <GlanceCard current={current} data={data} /> : null,
      },
      {
        id: "hourly",
        title: "Next hours",
        available: hours.length > 0,
        node: hours.length > 0 ? <HourlyCard hours={hours} /> : null,
      },
      {
        id: "beach",
        title: "Beach Day",
        available: !!conditions,
        node: conditions ? (
          <ScoreCard
            icon={Umbrella}
            emoji="🏖️"
            title="Beach Day"
            day={conditions.day}
            score={conditions.beach.score}
            label={conditions.beach.label}
            reason={conditions.beach.reason}
          />
        ) : null,
      },
      {
        id: "boat",
        title: "Boat Day",
        available: !!conditions,
        node: conditions ? (
          <ScoreCard
            icon={Sailboat}
            emoji="⛵"
            title="Boat Day"
            day={conditions.day}
            score={conditions.boat.score}
            label={conditions.boat.label}
            reason={conditions.boat.reason}
          />
        ) : null,
      },
      {
        id: "forecast",
        title: "7-day forecast",
        available: !!data,
        node: data ? <ForecastCard data={data} /> : null,
      },
      {
        id: "sun",
        title: "Sunrise & sunset",
        available: !!todaySun,
        node: todaySun ? <SunCard sun={todaySun} /> : null,
      },
      {
        id: "events",
        title: "Out & About",
        available:
          (!!events && events.length > 0) ||
          (!!localItems && localItems.length > 0),
        node:
          (events && events.length > 0) ||
          (localItems && localItems.length > 0) ? (
            <WeekCalendarCard events={events ?? []} localItems={localItems ?? []} />
          ) : null,
      },
      {
        id: "movies",
        title: "Now Showing",
        available: !!movies && movies.length > 0,
        node:
          movies && movies.length > 0 ? (
            <MoviesCard
              sections={movies}
              extraProviders={extraProviders}
              onChangeProviders={saveProviders}
            />
          ) : null,
      },
      {
        id: "bogos",
        title: "Publix BOGOs",
        available: !!bogos && bogos.deals.length > 0,
        node:
          bogos && bogos.deals.length > 0 ? (
            <BogosCard bogos={bogos} onToggleStar={toggleStar} />
          ) : null,
      },
      {
        id: "dinner",
        title: "This week's meals",
        available: !!dinner && dinner.meals.length > 0,
        node:
          dinner && dinner.meals.length > 0 ? (
            <MealsCard dinner={dinner} />
          ) : null,
      },
      {
        id: "honeydo",
        title: "HoneyDo list",
        // Voice capture writes through the mirror token or a session, so the
        // widget only appears when one of those is present.
        available: authed || !!token,
        node: authed || token ? <HoneyDoCard token={token} /> : null,
      },
      {
        id: "pacing",
        title: "Budget pacing",
        available: !!(
          pacing &&
          (pacing.categories.length > 0 ||
            pacing.vendors.length > 0 ||
            (pacing.bills?.length ?? 0) > 0)
        ),
        node:
          pacing &&
          (pacing.categories.length > 0 ||
            pacing.vendors.length > 0 ||
            (pacing.bills?.length ?? 0) > 0) ? (
            <PacingCard
              pacing={pacing}
              token={token}
              tz={data?.timezone}
              onUntagBill={untagBill}
              monthsBack={pacingMonthsBack}
              onMonthsBackChange={setPacingMonthsBack}
            />
          ) : null,
      },
      {
        id: "spend",
        title: "Daily burn",
        available: !!spend,
        node: spend ? <SpendCard spend={spend} onTagAsBill={tagAsBill} /> : null,
      },
      {
        id: "bills",
        title: "Upcoming bills",
        available: !!spend,
        node: spend ? <BillsCard spend={spend} /> : null,
      },
      {
        id: "budget",
        title: "Spending breakdown",
        available: !!(
          (spend?.week && spend.week.total > 0) ||
          (spend?.month && spend.month.total > 0) ||
          (spend?.breakdown && spend.breakdown.total > 0)
        ),
        node:
          spend?.week || spend?.month || spend?.breakdown ? (
            <BudgetCard
              week={spend.week}
              month={
                spend.month ??
                (spend.breakdown
                  ? {
                      label: spend.breakdown.period,
                      total: spend.breakdown.total,
                      categories: spend.breakdown.categories,
                      vendors: spend.breakdown.vendors,
                    }
                  : undefined)
              }
            />
          ) : null,
      },
      // --- Love ---
      {
        id: "together",
        title: "Together today",
        available: !!together?.challenge,
        node: together?.challenge ? (
          <PromptCard
            icon={Heart}
            title="Together today"
            chip="bg-rose-400/25 text-rose-200"
            tint="rgba(244,114,182,0.18)"
            text={together.challenge}
          />
        ) : null,
      },
      {
        id: "marriage",
        title: "Marriage tip",
        available: !!together?.marriageTip,
        node: together?.marriageTip ? (
          <PromptCard
            icon={Heart}
            title="Marriage tip"
            chip="bg-pink-400/25 text-pink-200"
            tint="rgba(244,114,182,0.14)"
            text={together.marriageTip}
          />
        ) : null,
      },
      {
        id: "lovequote",
        title: "Love note",
        available: !!together?.loveQuote,
        node: together?.loveQuote ? (
          <PromptCard
            icon={Quote}
            title="Love note"
            chip="bg-rose-400/25 text-rose-200"
            tint="rgba(251,113,133,0.14)"
            text={`“${together.loveQuote.text}”`}
            footnote={`— ${together.loveQuote.author}`}
          />
        ) : null,
      },
      // --- Family ---
      {
        id: "family",
        title: "Family today",
        available: !!together?.family,
        node: together?.family ? (
          <PromptCard
            icon={Users}
            title="Family today"
            chip="bg-sky-400/25 text-sky-200"
            tint="rgba(56,189,248,0.16)"
            text={together.family}
          />
        ) : null,
      },
      {
        id: "parenting",
        title: "Parenting tip",
        available: !!together?.parentingTip,
        node: together?.parentingTip ? (
          <PromptCard
            icon={Baby}
            title="Parenting tip"
            chip="bg-teal-400/25 text-teal-200"
            tint="rgba(45,212,191,0.16)"
            text={together.parentingTip}
          />
        ) : null,
      },
      {
        id: "joke",
        title: "Daily laugh",
        available: !!together?.joke,
        node: together?.joke ? (
          <PromptCard
            icon={Smile}
            title="Daily laugh"
            chip="bg-emerald-400/25 text-emerald-200"
            tint="rgba(52,211,153,0.16)"
            text={together.joke}
          />
        ) : null,
      },
      {
        id: "funfact",
        title: "Fun fact",
        available: !!together?.funFact,
        node: together?.funFact ? (
          <PromptCard
            icon={Lightbulb}
            title="Fun fact"
            chip="bg-amber-400/25 text-amber-200"
            tint="rgba(251,191,36,0.16)"
            text={together.funFact}
          />
        ) : null,
      },
      // --- Friends & Connections (authored pools, no API dependency) ---
      {
        id: "friendsreach",
        title: "Reach out",
        available: true,
        node: (
          <PromptCard
            icon={MessageCircle}
            title="Reach out"
            chip="bg-cyan-400/25 text-cyan-200"
            tint="rgba(34,211,238,0.16)"
            text={friendsReachForDate()}
          />
        ),
      },
      {
        id: "friendshello",
        title: "Say hello",
        available: true,
        node: (
          <PromptCard
            icon={Smile}
            title="Say hello"
            chip="bg-amber-400/25 text-amber-200"
            tint="rgba(251,191,36,0.16)"
            text={friendsHelloForDate()}
          />
        ),
      },
      {
        id: "friendskeep",
        title: "Stay connected",
        available: true,
        node: (
          <PromptCard
            icon={Handshake}
            title="Stay connected"
            chip="bg-lime-400/25 text-lime-200"
            tint="rgba(163,230,53,0.14)"
            text={friendsKeepForDate()}
          />
        ),
      },
      // --- Faith ---
      {
        id: "verse",
        title: "Verse of the day",
        available: !!together?.verse,
        node: together?.verse ? (
          <PromptCard
            icon={BookOpen}
            title="Verse of the day"
            chip="bg-violet-400/25 text-violet-200"
            tint="rgba(167,139,250,0.18)"
            text={together.verse.text}
            footnote={together.verse.reference || undefined}
          />
        ) : null,
      },
      {
        id: "faithfact",
        title: "Faith fact",
        available: !!together?.faithFact,
        node: together?.faithFact ? (
          <PromptCard
            icon={Sparkles}
            title="Faith fact"
            chip="bg-indigo-400/25 text-indigo-200"
            tint="rgba(129,140,248,0.16)"
            text={together.faithFact}
          />
        ) : null,
      },
      {
        id: "faithtip",
        title: "Faith for today",
        available: !!together?.faithTip,
        node: together?.faithTip ? (
          <PromptCard
            icon={Church}
            title="Faith for today"
            chip="bg-purple-400/25 text-purple-200"
            tint="rgba(192,132,252,0.16)"
            text={together.faithTip}
          />
        ) : null,
      },
      {
        id: "stephengrowth",
        title: "Sharpen",
        available: !!together?.stephenGrowth,
        node: together?.stephenGrowth ? (
          <PromptCard
            icon={Mountain}
            title="Sharpen"
            chip="bg-slate-400/25 text-slate-100"
            tint="rgba(100,116,139,0.18)"
            text={together.stephenGrowth}
          />
        ) : null,
      },
      {
        id: "stephenconnect",
        title: "For her",
        available: !!together?.stephenConnect,
        node: together?.stephenConnect ? (
          <PromptCard
            icon={HeartHandshake}
            title="For her"
            chip="bg-rose-400/25 text-rose-200"
            tint="rgba(244,114,182,0.16)"
            text={together.stephenConnect}
          />
        ) : null,
      },
      {
        id: "whitneygrowth",
        title: "Bloom",
        available: !!together?.whitneyGrowth,
        node: together?.whitneyGrowth ? (
          <PromptCard
            icon={Flower2}
            title="Bloom"
            chip="bg-pink-400/25 text-pink-200"
            tint="rgba(244,114,182,0.16)"
            text={together.whitneyGrowth}
          />
        ) : null,
      },
      {
        id: "whitneyconnect",
        title: "For him",
        available: !!together?.whitneyConnect,
        node: together?.whitneyConnect ? (
          <PromptCard
            icon={Heart}
            title="For him"
            chip="bg-amber-400/25 text-amber-100"
            tint="rgba(251,191,36,0.16)"
            text={together.whitneyConnect}
          />
        ) : null,
      },
    ];
  }, [current, currentInfo, data, unitLabel, conditions, hours, todaySun, spend, together, events, localItems, movies, extraProviders, saveProviders, bogos, dinner, pacing, tagAsBill, untagBill, toggleStar, token, authed, pacingMonthsBack]);

  // Apply saved order; any widget without a saved position falls back to the
  // default channel order (CATEGORIES), so a fresh layout matches the design.
  const orderedWidgets = useMemo(() => {
    const ids = widgets.map((w) => w.id);
    const known = order.filter((id) => ids.includes(id));
    const missing = ids
      .filter((id) => !known.includes(id))
      .sort((a, b) => {
        const ia = DEFAULT_ORDER.indexOf(a);
        const ib = DEFAULT_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    const finalOrder = [...known, ...missing];
    const byId = new Map(widgets.map((w) => [w.id, w]));
    return finalOrder.map((id) => byId.get(id)!);
  }, [widgets, order]);

  const visibleWidgets = orderedWidgets.filter((w) => w.available && !hidden.has(w.id));
  const sizeOf = (id: string): Size => sizes[id] ?? DEFAULT_SIZE[id] ?? "medium";

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = orderedWidgets.map((w) => w.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(ids, oldIndex, newIndex);
      setOrder(next);
      save(ORDER_KEY, next);
    },
    [orderedWidgets, save]
  );

  // Group visible widgets into channels, dropping any empty channel. The
  // "Today" channel is synthetic (no widgets) and always first — the clock
  // card jumps to it.
  const sections = useMemo(() => {
    return [
      { id: "today", label: "Today", widgets: [] as WidgetDef[] },
      ...CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        widgets: visibleWidgets.filter((w) => c.ids.includes(w.id)),
      })).filter((s) => s.widgets.length > 0),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedWidgets, hidden]);

  const sectionCount = sections.length;

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  // Keep the active index valid as channels appear/disappear.
  useEffect(() => {
    if (activeIndex > sectionCount - 1) setActiveIndex(Math.max(0, sectionCount - 1));
  }, [sectionCount, activeIndex]);

  // Any tap/click anywhere means the viewer is engaged — restart the rotation
  // countdown so the channel doesn't swipe away mid-interaction.
  const [interactionTick, setInteractionTick] = useState(0);
  useEffect(() => {
    const bump = () => setInteractionTick((t) => t + 1);
    window.addEventListener("pointerdown", bump);
    return () => window.removeEventListener("pointerdown", bump);
  }, []);

  // The Today channel holds rotation while its article reader is open.
  const [holdRotation, setHoldRotation] = useState(false);

  // Auto-advance to the next channel. Resets whenever the index changes (so a
  // manual selection gives you a fresh 30s) or the screen is touched, and
  // pauses while editing or reading an article.
  useEffect(() => {
    if (!autoRotate || editMode || holdRotation || sectionCount <= 1) return;
    const t = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % sectionCount);
    }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [autoRotate, editMode, holdRotation, sectionCount, activeIndex, interactionTick]);

  const activeSection = sections[activeIndex] ?? sections[0] ?? null;

  return (
    <div
      className="h-screen w-full overflow-hidden text-white antialiased transition-[background] duration-1000"
      style={{ background: gradient }}
    >
      <div className="flex h-full">
        {/* Left rail: persistent clock + channel nav + controls */}
        <aside className="flex w-44 shrink-0 flex-col border-r border-white/10 bg-black/25 p-3 backdrop-blur-md md:w-52">
          {/* In fullscreen, Safari/iPadOS overlays a system exit (X) control in
              the top-left corner; push the clock down so it stays readable. */}
          {/* Clock card jumps to the Today channel. */}
          <button
            onClick={() => {
              const i = sections.findIndex((s) => s.id === "today");
              if (i >= 0) goTo(i);
            }}
            className={cn(
              "block w-full rounded-2xl bg-white/10 p-3.5 text-left transition hover:bg-white/20",
              isFullscreen && "mt-16"
            )}
          >
            <div className="flex items-stretch gap-2">
              {/* Digits scale with the card width (cqw units) but keep the
                  font's natural proportions, so they match the product UI. */}
              <div className="min-w-0 flex-1 [container-type:inline-size]">
                <div className="whitespace-nowrap text-[35cqw] font-semibold leading-none tracking-tight tabular-nums">
                  {clockDigits}
                </div>
              </div>
              {/* AM/PM stacked over the temperature, right of the digits. */}
              <div className="flex w-9 shrink-0 flex-col gap-1">
                <span className="flex flex-1 items-center justify-center rounded-md bg-white/10 text-[11px] font-semibold leading-none text-white/80">
                  {meridiem}
                </span>
                <span className="flex flex-1 items-center justify-center rounded-md bg-white/10 text-[11px] font-semibold leading-none text-white/80">
                  {current ? `${Math.round(current.temperature_2m)}${unitLabel}` : "--"}
                </span>
              </div>
            </div>
            {/* Date spans the card: weekday left, month + day right. */}
            <div className="mt-2 flex items-baseline justify-between gap-2 [container-type:inline-size]">
              <span className="text-[8cqw] font-medium leading-none text-white/85">
                {dateWeekday}
              </span>
              <span className="text-[8cqw] font-medium leading-none text-white/60">
                {dateRest}
              </span>
            </div>
          </button>

          <nav className="mt-3 flex-1 space-y-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((s, i) => {
              const Icon = NAV_ICONS[s.id] ?? LayoutGrid;
              return (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                    i === activeIndex
                      ? "bg-white/25 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white/90"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="relative mt-3 flex items-center gap-2">
            <button
              onClick={() => setAutoRotate((a) => !a)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2 py-2 text-xs font-medium transition hover:bg-white/20"
              aria-label={autoRotate ? "Pause auto-rotate" : "Resume auto-rotate"}
            >
              {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRotate ? "Auto" : "Paused"}
            </button>
            {editMode && (
              <button
                onClick={() => setEditMode(false)}
                aria-label="Done editing"
                className="rounded-xl bg-emerald-400/30 p-2 transition hover:bg-emerald-400/40"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setShowMenu((m) => !m)}
              aria-label="Menu"
              className={cn(
                "rounded-xl p-2 transition",
                showMenu
                  ? "bg-white/30 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <>
                {/* Click-away backdrop */}
                <button
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute bottom-12 left-0 z-40 w-56 overflow-hidden rounded-2xl border border-white/15 bg-slate-900/90 py-1.5 shadow-2xl backdrop-blur-xl">
                  {!isStandalone && (
                    <MenuItem
                      icon={isFullscreen ? Minimize : Maximize}
                      label={isFullscreen ? "Exit full screen" : "Full screen"}
                      onClick={() => {
                        toggleFullscreen();
                        setShowMenu(false);
                      }}
                    />
                  )}
                  <MenuItem
                    icon={MapPin}
                    label={location ? location.label : "Set location"}
                    onClick={() => {
                      setShowSearch((s) => !s);
                      setShowWidgets(false);
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={LayoutGrid}
                    label="Show / hide widgets"
                    onClick={() => {
                      setShowWidgets((s) => !s);
                      setShowSearch(false);
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={editMode ? Check : Pencil}
                    label={editMode ? "Done editing" : "Edit layout"}
                    onClick={() => {
                      setEditMode((e) => !e);
                      setShowMenu(false);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Location search panel */}
        {showSearch && (
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2">
              <Search className="h-4 w-4 text-white/70" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city…"
                className="w-full bg-transparent text-white placeholder-white/60 outline-none"
              />
            </div>
            {searching && <div className="mt-3 text-sm text-white/70">Searching…</div>}
            {results.length > 0 && (
              <ul className="mt-3 space-y-1">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() =>
                        saveLocation({
                          lat: r.latitude,
                          lon: r.longitude,
                          label: [r.name, r.admin1, r.countryCode]
                            .filter(Boolean)
                            .join(", "),
                        })
                      }
                      className="w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/20"
                    >
                      {[r.name, r.admin1, r.country].filter(Boolean).join(", ")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Widget visibility panel */}
        {showWidgets && (
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/85">Show / hide widgets</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={autoArrange}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium transition hover:bg-white/25"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Auto arrange
                </button>
                <button
                  onClick={resetAll}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium transition hover:bg-white/25"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset all
                </button>
                <button
                  onClick={() => setShowWidgets(false)}
                  className="rounded-full bg-white/15 p-1.5 transition hover:bg-white/25"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {orderedWidgets.map((w) => {
                const isHidden = hidden.has(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    disabled={!w.available}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                      !w.available
                        ? "cursor-not-allowed bg-white/5 text-white/35"
                        : isHidden
                          ? "bg-white/10 text-white/55 hover:bg-white/15"
                          : "bg-white/20 text-white hover:bg-white/25"
                    )}
                  >
                    <span className="truncate">{w.title}</span>
                    {!w.available ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/55">
                        No data
                      </span>
                    ) : isHidden ? (
                      <EyeOff className="h-4 w-4 shrink-0" />
                    ) : (
                      <Eye className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {needsLocation && !location && (
          <div className="rounded-2xl bg-white/15 p-6 text-center backdrop-blur-md">
            <p className="text-lg">Set a location to see the weather.</p>
            <button
              onClick={() => setShowSearch(true)}
              className="mt-3 rounded-full bg-white/25 px-5 py-2 font-medium transition hover:bg-white/35"
            >
              Search for a city
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-white/15 p-4 text-center backdrop-blur-md">
            {error}
          </div>
        )}

        {editMode && (
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-center text-xs text-white/70 backdrop-blur-md">
            Drag the title bar to move · use S / M / L to resize · tap the eye to hide ·
            auto-rotate is paused while editing
          </div>
        )}

        {/* Active channel */}
        {activeSection &&
          (activeSection.id === "today" ? (
            <section key="today" className="flex flex-1 flex-col gap-2">
              <SectionHeader title="Today" icon={CalendarClock} items={[]} />
              <TodayChannel onHoldRotation={setHoldRotation} />
            </section>
          ) : ["love", "family", "friends", "faith", "stephen", "whitney"].includes(
            activeSection.id
          ) ? (
            <ChecklistChannel
              channel={activeSection.id}
              label={activeSection.label}
              together={together}
            />
          ) : (
            <section key={activeSection.id} className="flex flex-1 flex-col gap-2">
              <SectionHeader
                title={activeSection.label}
                icon={NAV_ICONS[activeSection.id] ?? LayoutGrid}
                items={[
                  ...(activeSection.id === "events"
                    ? [
                        {
                          icon: Maximize,
                          label: "Open full view",
                          onClick: () => {
                            window.location.href = "/mirror/events";
                          },
                        },
                      ]
                    : []),
                  {
                    icon: editMode ? Check : Pencil,
                    label: editMode ? "Done editing" : "Edit layout",
                    onClick: () => setEditMode((e) => !e),
                  },
                  {
                    icon: LayoutGrid,
                    label: "Show / hide widgets",
                    onClick: () => {
                      setShowWidgets((s) => !s);
                      setShowSearch(false);
                    },
                  },
                ]}
              />
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                {/* SortableContext renders no wrapper, so the grid is the
                    section's direct flex child and can stretch with flex-1. */}
                <SortableContext
                  items={activeSection.widgets.map((w) => w.id)}
                  strategy={rectSortingStrategy}
                >
                  <div
                    className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    style={{ gridAutoRows: `minmax(${TILE_HEIGHT}px, 1fr)` }}
                  >
                    {activeSection.widgets.map((w) => (
                      <SortableWidget
                        key={w.id}
                        id={w.id}
                        title={w.title}
                        size={sizeOf(w.id)}
                        editMode={editMode}
                        onSize={(sz) => setWidgetSize(w.id, sz)}
                        onHide={() => toggleWidget(w.id)}
                      >
                        {w.node}
                      </SortableWidget>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

// --- Full-screen card channels (Love / Family / Faith / For Stephen / For
// Whitney) -----------------------------------------------------------------
//
// A few large cards fill the channel. Tapping a card's icon opens a small
// menu: hide the card, or swap in different content from the same authored
// pool. The channel's three-dot menu restores hidden cards or refreshes every
// card at once. Hidden state and content offsets persist per-day in
// localStorage, so everything resets tomorrow.

const CARDS_HIDDEN_PREFIX = "mirror.cards.hidden.";
const CARDS_OFFSET_PREFIX = "mirror.cards.offsets.";

type CardVariant = { text: string; footnote?: string | null };

type ChecklistItem = {
  id: string;
  title: string;
  chip: string;
  tint: string;
  icon: LucideIcon;
  // Everything this card can show. Index rotates daily; "show something
  // else" and "refresh cards" advance it. Single-variant cards (content from
  // external APIs) can't be swapped, only hidden.
  variants: CardVariant[];
};

function cardDayIndex(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

const asVariants = (pool: string[]): CardVariant[] =>
  pool.map((text) => ({ text }));

// Card definitions per channel. Pool-backed cards rotate daily through the
// same authored lists the `together` API uses; API-backed cards (verse, joke,
// fun fact) show whatever today's fetch returned.
function channelCards(
  channel: string,
  together: Together | null
): (ChecklistItem | null)[] {
  switch (channel) {
    case "stephen":
      return [
        {
          id: "stephen-growth",
          title: "Sharpen",
          chip: "bg-slate-400/25 text-slate-100",
          tint: "rgba(100,116,139,0.18)",
          icon: Mountain,
          variants: asVariants(STEPHEN_GROWTH),
        },
        {
          id: "stephen-connect",
          title: "For her",
          chip: "bg-rose-400/25 text-rose-200",
          tint: "rgba(244,114,182,0.16)",
          icon: HeartHandshake,
          variants: asVariants(STEPHEN_CONNECT),
        },
        {
          id: "stephen-girls",
          title: "With the girls",
          chip: "bg-teal-400/25 text-teal-200",
          tint: "rgba(45,212,191,0.16)",
          icon: Baby,
          variants: asVariants(PARENTING_TIPS),
        },
      ];
    case "whitney":
      return [
        {
          id: "whitney-growth",
          title: "Bloom",
          chip: "bg-pink-400/25 text-pink-200",
          tint: "rgba(244,114,182,0.16)",
          icon: Flower2,
          variants: asVariants(WHITNEY_GROWTH),
        },
        {
          id: "whitney-connect",
          title: "For him",
          chip: "bg-amber-400/25 text-amber-100",
          tint: "rgba(251,191,36,0.16)",
          icon: Heart,
          variants: asVariants(WHITNEY_CONNECT),
        },
        {
          id: "whitney-family",
          title: "Family moment",
          chip: "bg-sky-400/25 text-sky-200",
          tint: "rgba(56,189,248,0.16)",
          icon: Users,
          variants: asVariants(FAMILY_PROMPTS),
        },
      ];
    case "love":
      return [
        {
          id: "love-together",
          title: "Together today",
          chip: "bg-rose-400/25 text-rose-200",
          tint: "rgba(244,114,182,0.18)",
          icon: Heart,
          variants: asVariants(CONNECTION_PROMPTS),
        },
        {
          id: "love-marriage",
          title: "Marriage tip",
          chip: "bg-pink-400/25 text-pink-200",
          tint: "rgba(244,114,182,0.14)",
          icon: HeartHandshake,
          variants: asVariants(MARRIAGE_TIPS),
        },
        {
          id: "love-quote",
          title: "Love note",
          chip: "bg-rose-400/25 text-rose-200",
          tint: "rgba(251,113,133,0.14)",
          icon: Quote,
          variants: LOVE_QUOTES.map((q) => ({
            text: `\u201C${q.text}\u201D`,
            footnote: `— ${q.author}`,
          })),
        },
      ];
    case "family":
      return [
        {
          id: "family-today",
          title: "Family today",
          chip: "bg-sky-400/25 text-sky-200",
          tint: "rgba(56,189,248,0.16)",
          icon: Users,
          variants: asVariants(FAMILY_PROMPTS),
        },
        {
          id: "family-parenting",
          title: "Parenting tip",
          chip: "bg-teal-400/25 text-teal-200",
          tint: "rgba(45,212,191,0.16)",
          icon: Baby,
          variants: asVariants(PARENTING_TIPS),
        },
        // Third card: today's joke and fun fact share one slot, so the
        // channel stays at three vertical cards; swapping toggles between them.
        together?.joke || together?.funFact
          ? {
              id: "family-laugh",
              title: "Just for fun",
              chip: "bg-emerald-400/25 text-emerald-200",
              tint: "rgba(52,211,153,0.16)",
              icon: Smile,
              variants: [
                together.joke ? { text: together.joke } : null,
                together.funFact ? { text: together.funFact } : null,
              ].filter((v): v is CardVariant => v !== null),
            }
          : null,
      ];
    case "friends":
      return [
        {
          id: "friends-reach",
          title: "Reach out",
          chip: "bg-cyan-400/25 text-cyan-200",
          tint: "rgba(34,211,238,0.16)",
          icon: MessageCircle,
          variants: asVariants(FRIENDS_REACH),
        },
        {
          id: "friends-hello",
          title: "Say hello",
          chip: "bg-amber-400/25 text-amber-200",
          tint: "rgba(251,191,36,0.16)",
          icon: Smile,
          variants: asVariants(FRIENDS_HELLO),
        },
        {
          id: "friends-keep",
          title: "Stay connected",
          chip: "bg-lime-400/25 text-lime-200",
          tint: "rgba(163,230,53,0.14)",
          icon: Handshake,
          variants: asVariants(FRIENDS_KEEP),
        },
      ];
    case "faith":
      return [
        together?.verse
          ? {
              id: "faith-verse",
              title: "Verse of the day",
              chip: "bg-violet-400/25 text-violet-200",
              tint: "rgba(167,139,250,0.18)",
              icon: BookOpen,
              variants: [
                {
                  text: together.verse.text,
                  footnote: together.verse.reference || undefined,
                },
              ],
            }
          : null,
        {
          id: "faith-tip",
          title: "Faith for today",
          chip: "bg-purple-400/25 text-purple-200",
          tint: "rgba(192,132,252,0.16)",
          icon: Church,
          variants: asVariants(FAITH_TIPS),
        },
        {
          id: "faith-fact",
          title: "Faith fact",
          chip: "bg-indigo-400/25 text-indigo-200",
          tint: "rgba(129,140,248,0.16)",
          icon: Sparkles,
          variants: asVariants(FAITH_FACTS),
        },
      ];
    default:
      return [];
  }
}

function ChecklistChannel({
  channel,
  label,
  together,
}: {
  channel: string;
  label: string;
  together: Together | null;
}) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const hiddenKey = `${CARDS_HIDDEN_PREFIX}${dayKey}`;
  const offsetsKey = `${CARDS_OFFSET_PREFIX}${dayKey}`;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  // Which card's menu is open, or null. The section-level menu lives in
  // SectionHeader and manages its own state.
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    setHidden(new Set(readJSON<string[]>(hiddenKey) ?? []));
    setOffsets(readJSON<Record<string, number>>(offsetsKey) ?? {});
  }, [hiddenKey, offsetsKey]);

  useEffect(() => {
    setOpenMenu(null);
  }, [channel]);

  const items: ChecklistItem[] = useMemo(() => {
    // Friends cards come from authored pools with no API dependency, so that
    // channel renders even before `together` loads; the rest wait for data.
    if (!together && channel !== "friends") return [];
    return channelCards(channel, together).filter(
      (d): d is ChecklistItem => d !== null
    );
  }, [channel, together]);

  const saveHidden = (next: Set<string>) => {
    setHidden(next);
    writeJSON(hiddenKey, [...next]);
  };
  const saveOffsets = (next: Record<string, number>) => {
    setOffsets(next);
    writeJSON(offsetsKey, next);
  };

  const hideCard = (id: string) => {
    saveHidden(new Set(hidden).add(id));
    setOpenMenu(null);
  };
  const swapCard = (id: string) => {
    saveOffsets({ ...offsets, [id]: (offsets[id] ?? 0) + 1 });
    setOpenMenu(null);
  };
  const showHiddenCards = () => {
    const next = new Set(hidden);
    for (const it of items) next.delete(it.id);
    saveHidden(next);
    setOpenMenu(null);
  };
  const regenerateAll = () => {
    const next = { ...offsets };
    for (const it of items) {
      if (it.variants.length > 1) next[it.id] = (next[it.id] ?? 0) + 1;
    }
    saveOffsets(next);
    setOpenMenu(null);
  };

  if (items.length === 0) return null;

  const dayIdx = cardDayIndex();
  const variantFor = (item: ChecklistItem): CardVariant => {
    const len = item.variants.length;
    return item.variants[((dayIdx % len) + (offsets[item.id] ?? 0)) % len];
  };

  const visibleItems = items.filter((it) => !hidden.has(it.id));
  const hiddenCount = items.length - visibleItems.length;
  const canRegenerate = items.some((it) => it.variants.length > 1);

  // 3 cards sit in one row; 4 (Family) go 2x2 so each stays large.
  const gridCols =
    visibleItems.length >= 4 ? "md:grid-cols-2" : "md:grid-cols-3";

  // The personal channels carry a quiet doorway to /mirror/extra-fun.
  const hasExtraFun = channel === "stephen" || channel === "whitney";

  // Section menu: restore hidden cards / refresh every card's content.
  const menuItems: SectionMenuItem[] = [
    ...(hiddenCount > 0
      ? [
          {
            icon: Eye,
            label: `Show ${hiddenCount} hidden card${hiddenCount === 1 ? "" : "s"}`,
            onClick: showHiddenCards,
          },
        ]
      : []),
    ...(canRegenerate
      ? [{ icon: RotateCcw, label: "Regenerate new cards", onClick: regenerateAll }]
      : []),
    ...(hasExtraFun
      ? [
          {
            icon: Flame,
            label: "Today's challenge",
            onClick: () => {
              window.location.href = "/mirror/extra-fun";
            },
          },
        ]
      : []),
  ];

  return (
    <div className="relative flex flex-1 flex-col gap-2">
    <SectionHeader
      title={label}
      icon={NAV_ICONS[channel] ?? LayoutGrid}
      items={menuItems}
    />
    {visibleItems.length === 0 ? (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-white/50">
          All cards hidden — use the menu to bring them back.
        </p>
      </div>
    ) : (
    <div className={cn("grid flex-1 grid-cols-1 gap-3", gridCols)}>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const variant = variantFor(item);
        const menuOpen = openMenu === item.id;
        return (
          <div
            key={item.id}
            className="relative flex flex-col rounded-3xl border border-white/10 p-6 backdrop-blur-md md:p-8"
            style={{
              background: `linear-gradient(135deg, ${item.tint} 0%, rgba(255,255,255,0.08) 70%)`,
            }}
          >
            <div className="relative flex items-center gap-2.5">
              <button
                onClick={() => setOpenMenu(menuOpen ? null : item.id)}
                aria-label={`Options for "${item.title}"`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition hover:brightness-125",
                  item.chip,
                  menuOpen && "ring-2 ring-white/50"
                )}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
              <span className="text-sm font-semibold uppercase tracking-wider text-white/75">
                {item.title}
              </span>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setOpenMenu(null)}
                  />
                  <div className="absolute left-0 top-11 z-40 w-56 overflow-hidden rounded-2xl border border-white/15 bg-slate-900/90 py-1.5 shadow-2xl backdrop-blur-xl">
                    <MenuItem
                      icon={EyeOff}
                      label="Hide card"
                      onClick={() => hideCard(item.id)}
                    />
                    {item.variants.length > 1 && (
                      <MenuItem
                        icon={RotateCcw}
                        label="Show a different card"
                        onClick={() => swapCard(item.id)}
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-center">
              <p className="text-2xl font-light leading-relaxed text-white md:text-3xl lg:text-4xl">
                {variant.text}
              </p>
              {variant.footnote && (
                <p className="mt-4 text-base font-medium text-white/60">
                  {variant.footnote}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
    )}
    {hasExtraFun && (
      <a
        href="/mirror/extra-fun"
        aria-label="Unlock today's challenge"
        className="absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full text-orange-300/80 transition hover:bg-white/10 hover:text-orange-300"
      >
        <Flame className="h-5 w-5" />
      </a>
    )}
    </div>
  );
}

// Consistent section header: title on the left, a three-dot menu on the
// right with whatever options apply to that section. Hides the menu button
// when there are no options.
type SectionMenuItem = { icon: LucideIcon; label: string; onClick: () => void };

function SectionHeader({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: LucideIcon;
  items: SectionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-8 items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/75">
        <Icon className="h-4 w-4 shrink-0" />
        {title}
      </span>
      {items.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={`Options for ${title}`}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/15 hover:text-white",
              open && "bg-white/15 text-white"
            )}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-60 overflow-hidden rounded-2xl border border-white/15 bg-slate-900/90 py-1.5 shadow-2xl backdrop-blur-xl">
                {items.map((it) => (
                  <MenuItem
                    key={it.label}
                    icon={it.icon}
                    label={it.label}
                    onClick={() => {
                      setOpen(false);
                      it.onClick();
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// A row in the top-right dropdown menu.
function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
    >
      <Icon className="h-4 w-4 shrink-0 text-white/60" />
      <span className="truncate">{label}</span>
    </button>
  );
}

// A sortable, fixed-height grid cell wrapping a single widget. Every tile is
// the same height (one grid row); the size control only changes column width.
function SortableWidget({
  id,
  title,
  size,
  editMode,
  onSize,
  onHide,
  children,
}: {
  id: string;
  title: string;
  size: Size;
  editMode: boolean;
  onSize: (size: Size) => void;
  onHide: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        SIZE_SPAN[size],
        TALL_WIDGETS.has(id) ? "row-span-2" : "row-span-1",
        "min-w-0",
        isDragging && "z-50 opacity-80"
      )}
    >
      <div
        className={cn(
          "relative h-full",
          editMode && "rounded-3xl ring-2 ring-white/40"
        )}
      >
        {editMode && (
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 rounded-t-3xl bg-black/55 px-2 py-1.5 backdrop-blur-md">
            <button
              type="button"
              className="flex min-w-0 cursor-grab touch-none items-center gap-1 text-white/90 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 shrink-0" />
              <span className="truncate text-xs font-medium">{title}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex overflow-hidden rounded-full bg-white/15">
                {SIZE_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSize(s)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-semibold transition",
                      size === s
                        ? "bg-white/45 text-white"
                        : "text-white/70 hover:bg-white/20"
                    )}
                    aria-label={`${s} size`}
                  >
                    {SIZE_LABEL[s]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onHide}
                className="rounded-full p-1 text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label={`Hide ${title}`}
              >
                <EyeOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <div
          className={cn(
            "h-full overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            editMode && "pt-10"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function CurrentWeatherCard({
  current,
  currentInfo,
  data,
  unitLabel,
}: {
  current: NonNullable<WeatherData["current"]>;
  currentInfo: { label: string; Icon: LucideIcon };
  data: WeatherData | null;
  unitLabel: string;
}) {
  return (
    <div className="flex h-full items-center gap-5 rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <currentInfo.Icon
        className={cn(
          "h-20 w-20 shrink-0 drop-shadow-[0_0_25px_rgba(255,255,255,0.25)] md:h-24 md:w-24",
          weatherColor(current.weather_code, current.is_day === 1)
        )}
        strokeWidth={1.2}
      />
      <div className="min-w-0">
        <div className="text-6xl font-light md:text-7xl">
          {Math.round(current.temperature_2m)}
          {unitLabel}
        </div>
        <div className="mt-1 text-xl font-light text-white/85">{currentInfo.label}</div>
        <div className="mt-1 text-base text-white/70">
          Feels like {Math.round(current.apparent_temperature)}
          {unitLabel}
          {data && (
            <>
              {" · "}H {Math.round(data.daily.temperature_2m_max[0])}° L{" "}
              {Math.round(data.daily.temperature_2m_min[0])}°
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GlanceCard({
  current,
  data,
}: {
  current: NonNullable<WeatherData["current"]>;
  data: WeatherData | null;
}) {
  return (
    <div className="grid h-full grid-cols-2 content-center gap-4 rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <Detail
        icon={Droplets}
        label="Humidity"
        value={`${current.relative_humidity_2m}%`}
        tint="bg-sky-400/25 text-sky-200"
      />
      <Detail
        icon={Wind}
        label="Wind"
        value={`${Math.round(current.wind_speed_10m)} ${data?.windUnit ?? ""}`}
        tint="bg-teal-400/25 text-teal-200"
      />
      <Detail
        icon={Sun}
        label="UV now"
        value={
          current.uv_index != null
            ? `${Math.round(current.uv_index)}`
            : data
              ? `${Math.round(data.daily.uv_index_max[0])}`
              : "—"
        }
        sub={
          data ? `Max ${Math.round(data.daily.uv_index_max[0])} today` : undefined
        }
        tint="bg-amber-400/25 text-amber-200"
      />
      <Detail
        icon={Gauge}
        label="Air quality"
        value={data?.aqi != null ? `${Math.round(data.aqi)}` : "—"}
        valueColor={data?.aqi != null ? aqiInfo(data.aqi).color : undefined}
        sub={data?.aqi != null ? aqiInfo(data.aqi).label : undefined}
        tint="bg-emerald-400/25 text-emerald-200"
      />
    </div>
  );
}

function HourlyCard({
  hours,
}: {
  hours: { time: string; temp: number; pop: number; code: number; isDay: boolean }[];
}) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
        Next hours
      </h2>
      <div className="flex flex-1 items-center justify-between gap-2 overflow-x-auto">
        {hours.map((h, i) => {
          const info = weatherInfo(h.code, h.isDay);
          return (
            <div
              key={h.time}
              className={cn(
                "flex min-w-[64px] flex-1 flex-col items-center gap-2 rounded-2xl py-3",
                i === 0 ? "bg-white/15" : ""
              )}
            >
              <span className="text-sm text-white/70">
                {i === 0
                  ? "Now"
                  : new Date(h.time).toLocaleTimeString(undefined, { hour: "numeric" })}
              </span>
              <info.Icon
                className={cn("h-8 w-8", weatherColor(h.code, h.isDay))}
                strokeWidth={1.4}
              />
              <span className="text-lg font-semibold">{Math.round(h.temp)}°</span>
              <div className="flex items-center gap-1">
                <Droplets
                  className={cn("h-3 w-3", h.pop >= 20 ? "text-sky-300" : "text-white/30")}
                />
                <span
                  className={cn("text-xs", h.pop >= 20 ? "text-sky-200" : "text-white/35")}
                >
                  {h.pop}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForecastCard({ data }: { data: WeatherData }) {
  const lows = data.daily.temperature_2m_min;
  const highs = data.daily.temperature_2m_max;
  const weekMin = Math.min(...lows);
  const weekMax = Math.max(...highs);
  const span = Math.max(1, weekMax - weekMin);
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-5 backdrop-blur-md">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/60">
        7-day forecast
      </h2>
      <div className="flex flex-1 flex-col justify-between">
        {data.daily.time.map((day, i) => {
          const info = weatherInfo(data.daily.weather_code[i], true);
          const left = ((lows[i] - weekMin) / span) * 100;
          const width = ((highs[i] - lows[i]) / span) * 100;
          const pop = data.daily.precipitation_probability_max[i];
          return (
            <div
              key={day}
              className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-white/10"
            >
              <span className="w-11 text-sm text-white/85">
                {i === 0
                  ? "Today"
                  : new Date(day).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <info.Icon
                className={cn(
                  "h-6 w-6 shrink-0",
                  weatherColor(data.daily.weather_code[i], true)
                )}
                strokeWidth={1.5}
              />
              <span className="flex w-9 items-center gap-0.5 text-xs text-sky-200">
                {pop >= 20 ? (
                  <>
                    <Droplets className="h-3 w-3" />
                    {pop}
                  </>
                ) : null}
              </span>
              <span className="w-8 text-right text-sm text-white/55">
                {Math.round(lows[i])}°
              </span>
              <div className="relative h-1.5 flex-1 rounded-full bg-white/10">
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-sky-300 via-amber-200 to-orange-300"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <span className="w-8 text-sm font-semibold">{Math.round(highs[i])}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SunCard({ sun }: { sun: { sunrise: string; sunset: string } }) {
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <div
      className="flex h-full flex-col justify-center gap-5 rounded-3xl border border-white/10 p-6 backdrop-blur-md"
      style={{
        background:
          "linear-gradient(160deg, rgba(251,191,36,0.20) 0%, rgba(249,115,22,0.16) 100%)",
      }}
    >
      <div className="flex items-center gap-4">
        <Sunrise className="h-10 w-10 text-amber-200" strokeWidth={1.3} />
        <div>
          <div className="text-sm uppercase tracking-wider text-white/60">Sunrise</div>
          <div className="text-2xl font-light">{fmtTime(sun.sunrise)}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Sunset className="h-10 w-10 text-orange-200" strokeWidth={1.3} />
        <div>
          <div className="text-sm uppercase tracking-wider text-white/60">Sunset</div>
          <div className="text-2xl font-light">{fmtTime(sun.sunset)}</div>
        </div>
      </div>
    </div>
  );
}

function SpendCard({
  spend,
  onTagAsBill,
}: {
  spend: SpendData;
  onTagAsBill?: (name: string, amount: number) => Promise<void>;
}) {
  // Merchant currently being tagged as a bill (disables its button).
  const [taggingBill, setTaggingBill] = useState<string | null>(null);
  const handleTagAsBill = async (name: string, amount: number) => {
    if (!onTagAsBill || taggingBill) return;
    setTaggingBill(name);
    try {
      await onTagAsBill(name, amount);
    } catch {
      /* refresh simply won't happen; button re-enables */
    } finally {
      setTaggingBill(null);
    }
  };
  const dateLabel = spend.date
    ? new Date(spend.date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/25 text-emerald-200">
            <Wallet className="h-4 w-4" />
          </span>
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-white/70">
            Daily burn
          </span>
        </div>
        {spend.trend?.changePct != null && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 text-[11px]",
              spend.trend.changePct > 0 ? "text-rose-300" : "text-emerald-300"
            )}
          >
            {spend.trend.changePct > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(spend.trend.changePct)}% vs prior wk
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-light leading-none">
              $
              {spend.total.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
            <span className="pb-0.5 text-xs text-white/55">
              {spend.count} {spend.count === 1 ? "txn" : "txns"}
            </span>
          </div>
          <div className="mt-1 text-xs text-white/55">
            Yesterday{dateLabel ? ` · ${dateLabel}` : ""}
          </div>
        </div>
        {spend.trend && (
          <div className="flex shrink-0 items-end gap-4 text-right">
            <div>
              <div className="text-lg font-light leading-none">
                ${Math.round(spend.trend.thisWeek).toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/60">
                Last 7 days
              </div>
            </div>
            {spend.trend.avgDaily != null && (
              <div>
                <div className="text-lg font-light leading-none">
                  ${spend.trend.avgDaily.toLocaleString()}
                  <span className="text-xs text-white/55">/day</span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-white/60">
                  90-day avg
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Streak of consecutive days at/under the rolling average. */}
      {spend.trend?.streak != null && spend.trend.streak > 0 && (
        <div className="mt-2 text-xs font-medium text-emerald-300">
          🔥 {spend.trend.streak === 30 ? "30+" : spend.trend.streak}-day streak
          under average
        </div>
      )}

      {spend.trend && (
        <div className="mt-3 h-[112px] shrink-0">
          <SpendTrend days={spend.trend.days} avgDaily={spend.trend.avgDaily} />
        </div>
      )}

      {/* Last 30 days of burn transactions, newest first. */}
      {spend.recent && spend.recent.length > 0 && (
        <ul className="mt-3 flex-1 space-y-1 overflow-y-auto border-t border-white/10 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {spend.recent.map((t, i) => (
            <li
              key={`${t.date}-${t.name}-${i}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-8 shrink-0 text-[10px] text-white/55">
                  {new Date(t.date + "T12:00:00").toLocaleDateString(undefined, {
                    month: "numeric",
                    day: "numeric",
                  })}
                </span>
                <span className="min-w-0 truncate text-white/70">{t.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="tabular-nums text-white/85">
                  ${Math.round(t.amount).toLocaleString()}
                </span>
                {onTagAsBill && (
                  <button
                    onClick={() => handleTagAsBill(t.name, t.amount)}
                    disabled={taggingBill !== null}
                    title="Add as bill — removes from daily burn"
                    className="flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] leading-none text-white/50 transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
                  >
                    {taggingBill === t.name ? "…" : "+"}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BillsCard({ spend }: { spend: SpendData }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-400/25 text-orange-200">
          <CalendarClock className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Upcoming bills
        </span>
      </div>
      {spend.bills && spend.bills.items.length > 0 ? (
        <>
          <div className="text-3xl font-light">
            ${Math.round(spend.bills.total).toLocaleString()}
            <span className="ml-2 text-sm text-white/55">next 31 days</span>
          </div>
          <ul className="mt-4 space-y-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {spend.bills.items.map((b, i) => (
              <li
                key={`${b.name}-${i}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-orange-200/80">
                    {new Date(b.date + "T12:00:00").toLocaleDateString(undefined, {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                  <span className="truncate text-white/80">{b.name}</span>
                </span>
                <span className="shrink-0 font-medium text-white/90">
                  ${b.amount.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-white/60">No bills due soon.</p>
      )}
    </div>
  );
}

// "Out & About" weekly calendar: 7 days as full-height vertical columns,
// merging ticketed events with hyperlocal dated happenings. Cycles through
// future weeks and filters by category with one tap (iPad-friendly).
const EVENT_CATEGORY_STYLE: Record<
  string,
  { bg: string; time: string; dot: string }
> = {
  Music: { bg: "bg-violet-400/20", time: "text-violet-200/90", dot: "bg-violet-300" },
  Sports: { bg: "bg-emerald-400/20", time: "text-emerald-200/90", dot: "bg-emerald-300" },
  "Arts & Theatre": { bg: "bg-rose-400/20", time: "text-rose-200/90", dot: "bg-rose-300" },
  Family: { bg: "bg-amber-400/20", time: "text-amber-200/90", dot: "bg-amber-300" },
  Film: { bg: "bg-sky-400/20", time: "text-sky-200/90", dot: "bg-sky-300" },
  Local: { bg: "bg-cyan-400/20", time: "text-cyan-200/90", dot: "bg-cyan-300" },
  Other: { bg: "bg-white/10", time: "text-white/60", dot: "bg-slate-300" },
};

function eventCategoryStyle(category: string) {
  return EVENT_CATEGORY_STYLE[category] ?? EVENT_CATEGORY_STYLE.Other;
}

function WeekCalendarCard({
  events,
  localItems,
}: {
  events: MirrorEvent[];
  localItems: LocalItem[];
}) {
  type DayItem = {
    title: string;
    time: string | null;
    minutes: number;
    detail: string | null;
    category: string;
  };
  const UNKNOWN_TIME = 24 * 60;
  const MAX_WEEK_OFFSET = 3; // events API fetches ~28 days

  const [weekOffset, setWeekOffset] = useState(0);
  const [category, setCategory] = useState<string | null>(null);

  // "HH:MM(:SS)" from the events API → display label + sortable minutes.
  const fmtTime = (
    localTime: string | null
  ): { label: string | null; minutes: number } => {
    if (!localTime) return { label: null, minutes: UNKNOWN_TIME };
    const [h, m] = localTime.split(":").map(Number);
    if (Number.isNaN(h)) return { label: localTime, minutes: UNKNOWN_TIME };
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return {
      label: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      minutes: h * 60 + (m || 0),
    };
  };

  // Free-text times from the local snapshot ("7 PM", "6:30pm", ...).
  const parseLooseTime = (t: string | null): number => {
    if (!t) return UNKNOWN_TIME;
    const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(a|p)?/i);
    if (!m) return UNKNOWN_TIME;
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = m[3]?.toLowerCase();
    if (ap === "p" && h < 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
    return h * 60 + min;
  };

  // The 7-day window being shown, keyed by local YYYY-MM-DD.
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + weekOffset * 7 + i
    );
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, date };
  });

  const byDay = new Map<string, DayItem[]>(days.map((d) => [d.key, []]));
  const present = new Set<string>();
  for (const ev of events) {
    const bucket = byDay.get(ev.localDate);
    if (!bucket) continue;
    const cat =
      ev.category && EVENT_CATEGORY_STYLE[ev.category] ? ev.category : "Other";
    present.add(cat);
    if (category && cat !== category) continue;
    const { label, minutes } = fmtTime(ev.localTime);
    bucket.push({
      title: ev.name,
      time: label,
      minutes,
      detail: [ev.venue, ev.city].filter(Boolean).join(" · ") || null,
      category: cat,
    });
  }
  for (const it of localItems) {
    if (it.kind !== "event" || !it.date) continue;
    const bucket = byDay.get(it.date);
    if (!bucket) continue;
    present.add("Local");
    if (category && category !== "Local") continue;
    bucket.push({
      title: it.title,
      time: it.time,
      minutes: parseLooseTime(it.time),
      detail: [it.venue, it.town].filter(Boolean).join(" · ") || null,
      category: "Local",
    });
  }
  for (const list of byDay.values()) list.sort((a, b) => a.minutes - b.minutes);

  // Stable pill order: the style map's order, only categories with events.
  const categories = Object.keys(EVENT_CATEGORY_STYLE).filter((c) =>
    present.has(c)
  );

  const rangeLabel = `${days[0].date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${days[6].date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      {/* Single top row: category filter pills left, week nav right.
          (The section header above the card carries the title.) */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {categories.length > 1 && (
          <>
            <button
              onClick={() => setCategory(null)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                !category
                  ? "bg-white/30 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? null : c)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition",
                  category === c
                    ? "bg-white/30 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    eventCategoryStyle(c).dot
                  )}
                />
                {c === "Local" ? "Around town" : c}
              </button>
            ))}
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
            className="rounded-full p-1.5 text-white/70 transition hover:bg-white/15 disabled:opacity-30"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() =>
              setWeekOffset((w) => (w >= MAX_WEEK_OFFSET ? 0 : w + 1))
            }
            className="min-w-[110px] rounded-full bg-white/10 px-3 py-1 text-center text-xs text-white/70 transition hover:bg-white/20"
            aria-label="Next week"
          >
            {weekOffset === 0 ? `This week · ${rangeLabel}` : rangeLabel}
          </button>
          <button
            onClick={() =>
              setWeekOffset((w) => Math.min(MAX_WEEK_OFFSET, w + 1))
            }
            disabled={weekOffset >= MAX_WEEK_OFFSET}
            className="rounded-full p-1.5 text-white/70 transition hover:bg-white/15 disabled:opacity-30"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-2">
        {days.map(({ key, date }, i) => {
          const items = byDay.get(key) ?? [];
          const isToday = weekOffset === 0 && i === 0;
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-0 flex-col rounded-2xl border p-2",
                isToday
                  ? "border-lime-300/40 bg-lime-400/10"
                  : "border-white/10 bg-white/5"
              )}
            >
              <div className="mb-2 shrink-0 text-center">
                <div
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    isToday ? "text-lime-200" : "text-white/55"
                  )}
                >
                  {isToday
                    ? "Today"
                    : date.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="text-lg font-light text-white/90">
                  {date.getDate()}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.length === 0 ? (
                  <div className="pt-2 text-center text-[11px] text-white/50">—</div>
                ) : (
                  items.map((it, j) => (
                    <div
                      key={`${it.title}-${j}`}
                      className={cn(
                        "rounded-lg p-1.5",
                        eventCategoryStyle(it.category).bg
                      )}
                    >
                      {it.time && (
                        <div
                          className={cn(
                            "text-[10px] font-medium",
                            eventCategoryStyle(it.category).time
                          )}
                        >
                          {it.time}
                        </div>
                      )}
                      <div className="overflow-hidden text-xs leading-snug text-white/90 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                        {it.title}
                      </div>
                      {it.detail && (
                        <div className="truncate text-[10px] text-white/50">
                          {it.detail}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Which tab the Now Showing channel opens on. Advances each time the channel
// comes on screen, so successive rotations step through In Theatres, then
// Netflix, then HBO Max, and so on.
let moviesTabCursor = 0;

type ProviderOption = { tmdbId: number; label: string };

// Poster wall for the "Now Showing" channel: tabs for theaters + each
// streaming service (Netflix, HBO Max, Peacock, Prime, Paramount+, Disney+),
// plus any extra services added via the "+" picker.
function MoviesCard({
  sections,
  extraProviders,
  onChangeProviders,
}: {
  sections: MediaSection[];
  extraProviders: number[];
  onChangeProviders: (next: number[]) => void;
}) {
  const [activeId, setActiveId] = useState(() => {
    const idx = sections.length > 0 ? moviesTabCursor % sections.length : 0;
    moviesTabCursor = idx + 1;
    return sections[idx]?.id ?? "";
  });
  const [showPicker, setShowPicker] = useState(false);
  const [catalog, setCatalog] = useState<ProviderOption[] | null>(null);
  const [filter, setFilter] = useState("");

  // Load the catalog of addable streaming services the first time the picker
  // opens.
  useEffect(() => {
    if (!showPicker || catalog) return;
    let active = true;
    fetch("/api/mirror/movies?list=providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (active && json) {
          setCatalog((json.providers ?? []) as ProviderOption[]);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      active = false;
    };
  }, [showPicker, catalog]);

  const active =
    sections.find((s) => s.id === activeId) ?? sections[0] ?? null;

  const grid = (list: MediaItem[]) => (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {list.map((m) => {
        const inner = (
          <>
            {m.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.poster}
                alt={m.title}
                className="aspect-[2/3] w-full rounded-xl object-cover transition group-hover:opacity-85"
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-white/10 p-1 text-center text-xs text-white/60">
                {m.title}
              </div>
            )}
            <div className="mt-1.5 truncate text-xs text-white/90">{m.title}</div>
            <div className="text-[11px] text-white/55">
              {m.rtScore
                ? `🍅 ${m.rtScore}`
                : m.tmdbScore !== null
                  ? `★ ${m.tmdbScore}%`
                  : ""}
            </div>
          </>
        );
        return m.url ? (
          <a
            key={`${m.type}-${m.title}`}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group min-w-0"
          >
            {inner}
          </a>
        ) : (
          <div key={`${m.type}-${m.title}`} className="min-w-0">
            {inner}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      {/* Section header carries the title; the card starts with the tabs. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              setActiveId(s.id);
              setShowPicker(false);
              // Manual picks keep the rotation cycle in sync.
              moviesTabCursor = i + 1;
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
              s.id === active?.id && !showPicker
                ? "bg-fuchsia-400/30 text-fuchsia-100"
                : "bg-white/10 text-white/55 hover:bg-white/15 hover:text-white/75"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setShowPicker((p) => !p)}
          aria-label="Add streaming service"
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
            showPicker
              ? "bg-fuchsia-400/30 text-fuchsia-100"
              : "bg-white/10 text-white/55 hover:bg-white/15 hover:text-white/75"
          }`}
        >
          +
        </button>
      </div>
      {showPicker ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search streaming services…"
            className="mb-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
          <div className="flex-1 space-y-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {catalog === null ? (
              <div className="text-sm text-white/50">Loading services…</div>
            ) : (
              catalog
                .filter((p) =>
                  p.label.toLowerCase().includes(filter.trim().toLowerCase())
                )
                .map((p) => {
                  const added = extraProviders.includes(p.tmdbId);
                  return (
                    <button
                      key={p.tmdbId}
                      onClick={() =>
                        onChangeProviders(
                          added
                            ? extraProviders.filter((id) => id !== p.tmdbId)
                            : [...extraProviders, p.tmdbId]
                        )
                      }
                      className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm transition hover:bg-white/10"
                    >
                      <span className="min-w-0 truncate text-white/85">
                        {p.label}
                      </span>
                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          added ? "text-fuchsia-200" : "text-white/45"
                        }`}
                      >
                        {added ? "Added ✓" : "Add"}
                      </span>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {active && grid(active.items)}
        </div>
      )}
    </div>
  );
}

// One row in the BOGO list: tappable star + title + savings.
function BogoRow({
  deal,
  onToggleStar,
}: {
  deal: BogoData["deals"][number];
  onToggleStar: (id: number, starred: boolean) => void;
}) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <button
        onClick={() => onToggleStar(deal.id, !deal.starred)}
        aria-label={deal.starred ? "Unstar deal" : "Star deal"}
        className="shrink-0 self-center p-0.5"
      >
        <Star
          className={cn(
            "h-3.5 w-3.5 transition-colors",
            deal.starred
              ? "fill-amber-300 text-amber-300"
              : "text-white/25 hover:text-white/50"
          )}
        />
      </button>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          deal.starred ? "font-medium text-amber-100" : "text-white/85"
        )}
      >
        {deal.title}
      </span>
      {deal.price && (
        <span
          className={cn(
            "shrink-0 text-xs",
            deal.starred ? "text-amber-200/90" : "text-emerald-200/90"
          )}
        >
          {deal.price}
        </span>
      )}
    </li>
  );
}

// This week's Publix BOGO list as one continuous feed, grouped by food type
// (AI-categorized at ingest) with biggest savings first within each group.
// Starred deals (shared across mirrors) are pinned to the top in amber.
function BogosCard({
  bogos,
  onToggleStar,
}: {
  bogos: BogoData;
  onToggleStar: (id: number, starred: boolean) => void;
}) {
  const { starred, groups } = useMemo(() => {
    const starred = bogos.deals.filter((d) => d.starred);
    const map = new Map<string, BogoData["deals"]>();
    for (const d of bogos.deals) {
      if (d.starred) continue;
      const cat = d.category ?? "All";
      const list = map.get(cat) ?? [];
      list.push(d);
      map.set(cat, list);
    }
    return {
      starred,
      groups: Array.from(map.entries()).map(([category, deals]) => ({
        category,
        deals,
      })),
    };
  }, [bogos.deals]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      {/* Section header carries the title; keep only the week label. */}
      {bogos.weekLabel && (
        <div className="mb-3 flex justify-end text-xs text-white/50">
          {bogos.weekLabel}
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {starred.length > 0 && (
          <div className="rounded-2xl bg-amber-400/10 p-3 ring-1 ring-amber-300/25">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
              <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
              This week&apos;s picks
            </div>
            <ul className="space-y-1.5">
              {starred.map((d) => (
                <BogoRow key={d.id} deal={d} onToggleStar={onToggleStar} />
              ))}
            </ul>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.category}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
              {g.category}
            </div>
            <ul className="space-y-1.5">
              {g.deals.map((d) => (
                <BogoRow key={d.id} deal={d} onToggleStar={onToggleStar} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// This week's dinner ideas built from the BOGO deals, as a simple numbered list.
function MealsCard({ dinner }: { dinner: DinnerData }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/25 text-amber-200">
          <UtensilsCrossed className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          This week&apos;s meals
        </span>
        {dinner.weekLabel && (
          <span className="ml-auto text-xs text-white/50">{dinner.weekLabel}</span>
        )}
      </div>
      <ul className="flex-1 space-y-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dinner.meals.map((m, i) => (
          <li key={`${m.title}-${i}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">
              Meal #{i + 1}
            </div>
            <div className="text-lg font-light leading-snug">{m.title}</div>
            {(m.cuisine || m.estCost) && (
              <div className="mt-0.5 text-xs text-white/50">
                {[m.cuisine, m.estCost].filter(Boolean).join(" · ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Month-to-date pacing vs the user's usual spend. The bar track represents a
// full usual month; a light fill marks where spend "should" be by today
// (% of month elapsed), and the colored fill is actual month-to-date spend.
// Fill color: green under pace, yellow within ±10%, red over pace.
const PACING_HIDDEN_KEY = "mirror.pacing.hidden.v1";

type PaceGroup = "category" | "vendor" | "bill";

type PaceDetail = {
  group: PaceGroup;
  name: string;
  window?: string;
  total?: number;
  transactions?: { date: string; name: string; amount: number }[];
  error?: boolean;
};

function PacingCard({
  pacing,
  token,
  tz,
  onUntagBill,
  monthsBack,
  onMonthsBackChange,
}: {
  pacing: PacingData;
  token: string | null;
  tz?: string;
  onUntagBill?: (name: string) => Promise<void>;
  monthsBack: number;
  onMonthsBackChange: (n: number) => void;
}) {
  const bills = pacing.bills ?? [];

  // Manually hidden category/vendor rows (device-local preference).
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());
  useEffect(() => {
    setHiddenRows(new Set(readJSON<string[]>(PACING_HIDDEN_KEY) ?? []));
  }, []);
  const hideRow = (group: PaceGroup, name: string) => {
    setHiddenRows((prev) => {
      const next = new Set(prev);
      next.add(`${group}:${name}`);
      try {
        localStorage.setItem(PACING_HIDDEN_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const restoreHidden = () => {
    setHiddenRows(new Set());
    try {
      localStorage.removeItem(PACING_HIDDEN_KEY);
    } catch {
      /* ignore */
    }
  };

  // Bill being removed (disables its button while the API call runs).
  const [removingBill, setRemovingBill] = useState<string | null>(null);
  const removeBill = async (name: string) => {
    if (!onUntagBill || removingBill) return;
    setRemovingBill(name);
    try {
      await onUntagBill(name);
    } catch {
      /* refresh simply won't happen */
    } finally {
      setRemovingBill(null);
    }
  };

  // Transaction drill-down popup for a clicked row.
  const [detail, setDetail] = useState<PaceDetail | null>(null);
  const openDetail = async (group: PaceGroup, name: string) => {
    setDetail({ group, name });
    try {
      const qs = new URLSearchParams({ group, name });
      if (token) qs.set("token", token);
      if (tz) qs.set("tz", tz);
      if (monthsBack > 0 && pacing.monthKey) qs.set("month", pacing.monthKey);
      const res = await fetch(`/api/mirror/pacing/transactions?${qs}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDetail((d) =>
        d && d.group === group && d.name === name ? { ...d, ...json } : d
      );
    } catch {
      setDetail((d) =>
        d && d.group === group && d.name === name ? { ...d, error: true } : d
      );
    }
  };

  const paceColor = (pct: number | null): { bar: string; text: string } => {
    if (pct === null) return { bar: "#94a3b8", text: "text-slate-300" };
    if (pct > 10) return { bar: "#f87171", text: "text-red-300" };
    if (pct >= -10) return { bar: "#fbbf24", text: "text-amber-300" };
    return { bar: "#4ade80", text: "text-emerald-300" };
  };

  // Bills column sort: biggest first, or by typical due day.
  const [billSort, setBillSort] = useState<"amount" | "date">("amount");

  // Bills aren't paced — they're one-shot hits. Show the typical due-day
  // window on a mini month strip plus paid / due / overdue status.
  const billsSection = (rows: PaceRow[]) => {
    const visible = rows.filter((r) => !hiddenRows.has(`bill:${r.name}`));
    if (visible.length === 0) return null;
    const sorted =
      billSort === "date"
        ? [...visible].sort(
            (a, b) => (a.dayMin ?? 32) - (b.dayMin ?? 32) || (a.dayMax ?? 32) - (b.dayMax ?? 32)
          )
        : visible; // API order = amount desc
    const isCurrent = pacing.isCurrentMonth !== false;
    const today = pacing.dayOfMonth ?? 1;

    return (
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Bills
          </span>
          <span className="flex overflow-hidden rounded-full border border-white/15 text-[10px]">
            {(["amount", "date"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setBillSort(s)}
                className={cn(
                  "px-2 py-0.5 transition-colors",
                  billSort === s
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {s === "amount" ? "$" : "Date"}
              </button>
            ))}
          </span>
        </div>
        <div className="space-y-3">
          {sorted.map((r) => {
            const dayMin = r.dayMin ?? null;
            const dayMax = r.dayMax ?? dayMin;
            const paid = r.paidDay != null;
            // Status vs today (current month only; past months are final).
            let status: { label: string; cls: string; bar: string };
            if (paid) {
              status = {
                label: `✓ paid on the ${ordinal(r.paidDay!)}`,
                cls: "text-emerald-300",
                bar: "#4ade80",
              };
            } else if (!isCurrent) {
              status = { label: "not paid", cls: "text-red-300", bar: "#f87171" };
            } else if (dayMax != null && today > dayMax) {
              status = {
                label: `expected by the ${ordinal(dayMax)}`,
                cls: "text-red-300",
                bar: "#f87171",
              };
            } else if (dayMin != null && today >= dayMin) {
              status = { label: "due now", cls: "text-amber-300", bar: "#fbbf24" };
            } else {
              status = {
                label:
                  dayMin != null
                    ? `due ${
                        dayMin === dayMax
                          ? `on the ${ordinal(dayMin)}`
                          : `the ${ordinal(dayMin)}–${ordinal(dayMax!)}`
                      }`
                    : "—",
                cls: "text-white/60",
                bar: "#94a3b8",
              };
            }
            return (
              <div
                key={r.name}
                role="button"
                tabIndex={0}
                onClick={() => openDetail("bill", r.name)}
                onKeyDown={(e) => e.key === "Enter" && openDetail("bill", r.name)}
                className="group cursor-pointer rounded-lg p-1 -m-1 transition-colors hover:bg-white/5"
                title="Tap to see this bill's payment history"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate capitalize text-white/90">
                    {r.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("text-xs font-semibold", status.cls)}>
                      {status.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBill(r.name);
                      }}
                      disabled={removingBill !== null}
                      title="Remove as bill — returns to normal spending"
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] leading-none text-white/50 transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
                    >
                      {removingBill === r.name ? "…" : "×"}
                    </button>
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-white/50">
                  <span>
                    {dayMin != null
                      ? dayMin === dayMax
                        ? `usually the ${ordinal(dayMin)}`
                        : `usually the ${ordinal(dayMin)}–${ordinal(dayMax!)}`
                      : "no history"}
                  </span>
                  <span>
                    {paid
                      ? `$${r.actual.toLocaleString()}`
                      : `~$${r.avgMonthly.toLocaleString()}`}
                  </span>
                </div>
                {/* Payment progress: how much of the usual bill has been paid
                    this month. Full bar = fully paid. */}
                <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: `${
                        r.avgMonthly > 0
                          ? Math.min(Math.max(r.actual / r.avgMonthly, paid ? 1 : 0), 1) * 100
                          : 0
                      }%`,
                      background: status.bar,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const section = (heading: string, rows: PaceRow[], group: PaceGroup) => {
    const visible = rows.filter((r) => !hiddenRows.has(`${group}:${r.name}`));
    if (visible.length === 0) return null;
    return (
      <div className="min-w-0">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {heading}
        </div>
        <div className="space-y-3">
          {visible.map((r) => {
            const color = paceColor(r.pct);
            // Bar scale: the full track = the usual monthly spend. A light fill
            // marks today's pace point (% of month elapsed × monthly avg); the
            // colored fill is actual month-to-date spend on the same scale.
            const paceFrac =
              r.avgMonthly > 0 ? Math.min(r.expected / r.avgMonthly, 1) : 0;
            const actualFrac =
              r.avgMonthly > 0 ? Math.min(r.actual / r.avgMonthly, 1) : 0;
            return (
              <div
                key={r.name}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(group, r.name)}
                onKeyDown={(e) => e.key === "Enter" && openDetail(group, r.name)}
                className="group cursor-pointer rounded-lg p-1 -m-1 transition-colors hover:bg-white/5"
                title="Tap to see the transactions behind this"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate capitalize text-white/90">
                    {r.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("text-xs font-semibold", color.text)}>
                      {r.pct === null
                        ? "—"
                        : r.pct > 0
                          ? `${r.pct}% over`
                          : r.pct < 0
                            ? `${Math.abs(r.pct)}% under`
                            : "on pace"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (group === "bill") removeBill(r.name);
                        else hideRow(group, r.name);
                      }}
                      disabled={group === "bill" && removingBill !== null}
                      title={
                        group === "bill"
                          ? "Remove as bill — returns to normal spending"
                          : "Hide this row"
                      }
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] leading-none text-white/50 transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
                    >
                      {group === "bill" && removingBill === r.name ? "…" : "×"}
                    </button>
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-white/50">
                  <span>
                    ${r.actual.toLocaleString()} of ~${r.expected.toLocaleString()}{" "}
                    expected
                  </span>
                  <span>avg ${r.avgMonthly.toLocaleString()}/mo</span>
                </div>
                <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  {/* Light fill up to today's expected pace point. */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/25 transition-all duration-700"
                    style={{ width: `${paceFrac * 100}%` }}
                  />
                  {/* Actual month-to-date spend, on the monthly-average scale. */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: `${actualFrac * 100}%`, background: color.bar }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/25 text-cyan-200">
          <Gauge className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Budget pacing
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs text-white/50">
          {hiddenRows.size > 0 && (
            <button
              onClick={restoreHidden}
              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/60 transition-colors hover:border-white/50 hover:text-white"
            >
              Show {hiddenRows.size} hidden
            </button>
          )}
          {/* Month switcher: review how a past month ended up. */}
          <span className="flex items-center gap-1.5">
            <button
              onClick={() => onMonthsBackChange(Math.min(11, monthsBack + 1))}
              disabled={monthsBack >= 11}
              aria-label="Previous month"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30"
            >
              ‹
            </button>
            <span className="min-w-[7.5rem] text-center">
              {pacing.month}
              {pacing.isCurrentMonth === false
                ? " · full month"
                : ` · day ${pacing.dayOfMonth}`}
            </span>
            <button
              onClick={() => onMonthsBackChange(Math.max(0, monthsBack - 1))}
              disabled={monthsBack <= 0}
              aria-label="Next month"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30"
            >
              ›
            </button>
          </span>
        </span>
      </div>
      <div
        className={cn(
          "grid flex-1 gap-x-8 gap-y-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          bills.length > 0 ? "lg:grid-cols-3" : "lg:grid-cols-2"
        )}
      >
        {pacing.categories.length > 0 &&
          section("By category", pacing.categories, "category")}
        {pacing.vendors.length > 0 && section("By vendor", pacing.vendors, "vendor")}
        {bills.length > 0 && billsSection(bills)}
      </div>

      {/* Transaction drill-down: right-side slide-out. Rendered in a portal —
          ancestors carry CSS transforms (dnd-kit), which would otherwise trap
          position:fixed inside the card. */}
      {detail && <PaceDetailDrawer detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function PaceDetailDrawer({
  detail,
  onClose,
}: {
  detail: PaceDetail;
  onClose: () => void;
}) {
  // Slide-in on mount: start off-screen, then transition to open.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/15 bg-slate-900/95 p-6 text-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xl font-medium capitalize">{detail.name}</div>
            <div className="mt-0.5 text-xs text-white/50">
              {detail.group === "bill" ? "Payment history" : "Transactions"}
              {detail.window ? ` · ${detail.window}` : ""}
              {detail.total != null ? ` · $${detail.total.toLocaleString()} total` : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {detail.error ? (
            <p className="text-sm text-white/60">Couldn&apos;t load transactions.</p>
          ) : !detail.transactions ? (
            <p className="text-sm text-white/60">Loading…</p>
          ) : detail.transactions.length === 0 ? (
            <p className="text-sm text-white/60">No transactions in this window.</p>
          ) : (
            <ul className="space-y-2.5">
              {detail.transactions.map((t, i) => (
                <li
                  key={`${t.date}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="w-10 shrink-0 text-xs text-white/45">
                      {new Date(t.date + "T12:00:00").toLocaleDateString(undefined, {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </span>
                    <span className="min-w-0 truncate text-white/80">{t.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-white/90">
                    ${t.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function BudgetCard({ week, month }: { week?: Breakdown; month?: Breakdown }) {
  const sections = [week, month].filter(
    (b): b is Breakdown => !!b && b.total > 0
  );
  if (sections.length === 0) return null;
  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-400/25 text-fuchsia-200">
          <PieChart className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Spending breakdown
        </span>
      </div>
      <div className="grid flex-1 gap-x-10 gap-y-6 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid-cols-2">
        {sections.map((b) => (
          <div key={b.label}>
            <div className="mb-3 flex items-baseline justify-between border-b border-white/10 pb-2">
              <span className="text-sm font-semibold text-white/85">{b.label}</span>
              <span className="text-lg font-light">
                ${Math.round(b.total).toLocaleString()}
              </span>
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <BreakdownList
                heading="By category"
                items={b.categories}
                from="#c084fc"
                to="#f0abfc"
              />
              <BreakdownList
                heading="By vendor"
                items={b.vendors}
                from="#5eead4"
                to="#7dd3fc"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Large, easy-to-read card for a single line of daily content (Love / Family /
// Faith channels). Optional footnote for an author or scripture reference.
function PromptCard({
  icon: Icon,
  title,
  chip,
  tint,
  text,
  footnote,
}: {
  icon: LucideIcon;
  title: string;
  chip?: string;
  tint?: string;
  text: string;
  footnote?: string;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-3xl border border-white/10 p-6 backdrop-blur-md"
      style={{
        background: tint
          ? `linear-gradient(135deg, ${tint} 0%, rgba(255,255,255,0.08) 70%)`
          : "rgba(255,255,255,0.12)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            chip ?? "bg-white/15 text-white/70"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {title}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xl font-light leading-relaxed text-white md:text-2xl">
          {text}
        </p>
        {footnote && (
          <p className="mt-3 text-sm font-medium text-white/60">{footnote}</p>
        )}
      </div>
    </div>
  );
}

function BreakdownList({
  heading,
  items,
  from,
  to,
}: {
  heading: string;
  items: { name: string; amount: number }[];
  from: string;
  to: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
        {heading}
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate capitalize text-white/85">{it.name}</span>
              <span className="shrink-0 text-white/90">
                ${Math.round(it.amount).toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(it.amount / max) * 100}%`,
                  background: `linear-gradient(90deg, ${from}, ${to})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 30 days of daily burn as slim bars with a dashed average line. Hovering a
// bar shows that day's transactions; sparse date ticks keep it clean.
function SpendTrend({
  days,
  avgDaily,
}: {
  days: { date: string; total: number; txns?: { name: string; amount: number }[] }[];
  avgDaily?: number;
}) {
  const max = Math.max(1, ...days.map((d) => d.total), avgDaily ?? 0);
  // Bars use 85% of the track height so the avg label has headroom.
  const SCALE = 0.85;
  return (
    <div className="flex h-full min-h-[88px] flex-col">
      <div className="relative flex-1">
        {/* Dashed 30-day average line. */}
        {avgDaily != null && avgDaily > 0 && (
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed border-white/50"
            style={{ bottom: `${(avgDaily / max) * SCALE * 100}%` }}
          >
            <span className="absolute right-0 -top-3.5 text-[10px] leading-none text-white/60">
              avg ${avgDaily.toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex h-full items-end gap-[3px]">
          {days.map((d, i) => {
            const isYesterday = i === days.length - 1;
            const txns = d.txns ?? [];
            const dateLabel = new Date(d.date + "T12:00:00").toLocaleDateString(
              undefined,
              { month: "numeric", day: "numeric" }
            );
            const tooltip = [
              `${dateLabel} — $${Math.round(d.total)}`,
              ...txns.map((t) => `${t.name} — $${Math.round(t.amount)}`),
            ].join("\n");
            // Green = at/under the rolling average, red = over.
            const under = avgDaily == null || d.total <= avgDaily;
            return (
              <div
                key={d.date}
                title={tooltip}
                className={cn(
                  "flex-1 rounded-t-sm transition-all duration-700",
                  under
                    ? isYesterday
                      ? "bg-gradient-to-t from-emerald-400 to-emerald-200"
                      : "bg-gradient-to-t from-emerald-400/55 to-emerald-200/70"
                    : isYesterday
                      ? "bg-gradient-to-t from-rose-400 to-rose-200"
                      : "bg-gradient-to-t from-rose-400/55 to-rose-200/70"
                )}
                style={{
                  height: `${Math.max(d.total > 0 ? 3 : 1.5, (d.total / max) * SCALE * 100)}%`,
                }}
              />
            );
          })}
        </div>
      </div>
      {/* Date ticks every ~5 days, aligned with the bars. */}
      <div className="mt-1 flex gap-[3px]">
        {days.map((d, i) => (
          <span
            key={d.date}
            className="flex-1 text-center text-[9px] leading-none text-white/50"
          >
            {(days.length - 1 - i) % 5 === 0
              ? new Date(d.date + "T12:00:00").toLocaleDateString(undefined, {
                  month: "numeric",
                  day: "numeric",
                })
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "#7ee787";
  if (score >= 60) return "#b9e86a";
  if (score >= 40) return "#f7e479";
  if (score >= 20) return "#f7b267";
  return "#f4796b";
}

function ScoreCard({
  icon: Icon,
  emoji,
  title,
  day,
  score,
  label,
  reason,
}: {
  icon: LucideIcon;
  emoji: string;
  title: string;
  day?: string;
  score: number;
  label: string;
  reason: string;
}) {
  const color = scoreColor(score);
  return (
    <div
      className="relative flex h-full flex-col justify-center overflow-hidden rounded-3xl border border-white/10 p-6 backdrop-blur-md"
      style={{
        background: `linear-gradient(135deg, ${color}26 0%, rgba(255,255,255,0.10) 60%)`,
      }}
    >
      <span className="pointer-events-none absolute -right-2 -top-3 text-7xl opacity-25">
        {emoji}
      </span>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/85">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
          <span className="text-sm font-semibold uppercase tracking-wider">{title}</span>
          {day && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              {day}
            </span>
          )}
        </div>
        <span
          className="rounded-full px-3 py-0.5 text-sm font-semibold"
          style={{ backgroundColor: `${color}33`, color }}
        >
          {label}
        </span>
      </div>
      <div className="relative mt-2 flex items-end gap-1">
        <span
          className="text-5xl font-semibold leading-none drop-shadow-[0_0_18px_rgba(0,0,0,0.15)]"
          style={{ color }}
        >
          {score}
        </span>
        <span className="mb-1 text-xl font-light text-white/60">%</span>
      </div>
      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <p className="relative mt-2 text-xs text-white/75">{reason}</p>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  sub,
  valueColor,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  tint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          tint ?? "bg-white/15 text-white/80"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-white/55">{label}</div>
        <div
          className="text-xl font-light leading-tight"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </div>
        {sub && <div className="text-[11px] text-white/55">{sub}</div>}
      </div>
    </div>
  );
}
