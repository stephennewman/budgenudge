"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  BookOpen,
  Check,
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
  Gauge,
  GripVertical,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  MapPin,
  Moon,
  CalendarClock,
  Pause,
  Pencil,
  Play,
  PieChart,
  Smile,
  Users,
  RotateCcw,
  Sailboat,
  TrendingDown,
  TrendingUp,
  Search,
  Snowflake,
  Sun,
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
};
type SpendData = {
  total: number;
  count: number;
  date: string;
  top?: { name: string; amount: number }[];
  trend?: {
    days: { date: string; total: number }[];
    thisWeek: number;
    lastWeek: number;
    changePct: number | null;
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
};

type Size = "small" | "medium" | "large";

const STORAGE_KEY = "mirror.location";
const ORDER_KEY = "mirror.order.v1";
const SIZES_KEY = "mirror.sizes.v1";
const HIDDEN_KEY = "mirror.hidden.v1";

// Column span per size. Statically listed so Tailwind keeps the classes.
const SIZE_SPAN: Record<Size, string> = {
  small: "col-span-1",
  medium: "col-span-1 sm:col-span-2",
  large: "col-span-1 sm:col-span-2 lg:col-span-4",
};

const SIZE_ORDER: Size[] = ["small", "medium", "large"];

// Widgets are grouped into auto-rotating channels. Order here is the channel order.
const CATEGORIES: { id: string; label: string; ids: string[] }[] = [
  {
    id: "weather",
    label: "Weather",
    ids: ["current", "glance", "hourly", "beach", "boat", "forecast", "sun"],
  },
  { id: "money", label: "Money", ids: ["spend", "bills", "budget"] },
  { id: "life", label: "Life", ids: ["together", "verse", "funfact"] },
  { id: "family", label: "Family", ids: ["family", "joke"] },
];

// How long each channel stays on screen before auto-advancing.
const ROTATE_MS = 30000;

// Sensible default width for each widget based on how much it shows.
const DEFAULT_SIZE: Record<string, Size> = {
  current: "medium",
  glance: "medium",
  hourly: "large",
  beach: "small",
  boat: "small",
  forecast: "medium",
  sun: "small",
  spend: "large",
  bills: "medium",
  budget: "large",
  together: "medium",
  verse: "medium",
  funfact: "large",
  family: "medium",
  joke: "medium",
};

// Masonry tuning: tiny base row so item heights snap close to their content.
const ROW_UNIT = 4;
const GRID_GAP = 16;

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

const GREETINGS: Record<DayPart, string> = {
  dawn: "Good early morning",
  morning: "Good morning",
  midday: "Hello",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good night",
};

// Background gradient that shifts through the day.
const GRADIENTS: Record<DayPart, string> = {
  dawn: "linear-gradient(160deg, #2b1055 0%, #7597de 70%, #ffb88c 100%)",
  morning: "linear-gradient(160deg, #1e3c72 0%, #2a5298 55%, #74b9ff 100%)",
  midday: "linear-gradient(160deg, #0083b0 0%, #00b4db 60%, #8ed1fc 100%)",
  afternoon: "linear-gradient(160deg, #144e8c 0%, #2a6db0 55%, #ffd194 100%)",
  evening: "linear-gradient(160deg, #20002c 0%, #cb356b 60%, #ff8c42 100%)",
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

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
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
  const [together, setTogether] = useState<Together | null>(null);
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const hasInit = useRef(false);

  // Dashboard customization state.
  const [editMode, setEditMode] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Channel carousel state.
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load saved customization once on mount.
  useEffect(() => {
    const savedOrder = readJSON<string[]>(ORDER_KEY);
    if (savedOrder) setOrder(savedOrder);
    const savedSizes = readJSON<Record<string, Size>>(SIZES_KEY);
    if (savedSizes) setSizes(savedSizes);
    const savedHidden = readJSON<string[]>(HIDDEN_KEY);
    if (savedHidden) setHidden(new Set(savedHidden));
  }, []);

  const save = useCallback((key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, []);

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

  // Yesterday's spend (only when a finance token is present). Refresh every 30 min.
  useEffect(() => {
    if (!token) {
      setSpend(null);
      return;
    }
    let active = true;
    const tz = data?.timezone;
    const load = async () => {
      try {
        const url = `/api/mirror/spend?token=${encodeURIComponent(token)}${
          tz ? `&tz=${encodeURIComponent(tz)}` : ""
        }`;
        const res = await fetch(url);
        if (!res.ok) {
          if (active) setSpend(null);
          return;
        }
        const json = await res.json();
        if (active) setSpend(json);
      } catch {
        if (active) setSpend(null);
      }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, data?.timezone]);

  const part = dayPart(now.getHours());
  const gradient = GRADIENTS[part];

  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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

  const todaySun = data
    ? { sunrise: data.daily.sunrise[0], sunset: data.daily.sunset[0] }
    : null;

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
        id: "spend",
        title: "Spending",
        available: !!spend,
        node: spend ? <SpendCard spend={spend} /> : null,
      },
      {
        id: "bills",
        title: "Upcoming bills",
        available: !!spend,
        node: spend ? <BillsCard spend={spend} /> : null,
      },
      {
        id: "budget",
        title: "Budget breakdown",
        available: !!(spend?.breakdown && spend.breakdown.total > 0),
        node:
          spend?.breakdown && spend.breakdown.total > 0 ? (
            <BudgetCard breakdown={spend.breakdown} />
          ) : null,
      },
      {
        id: "together",
        title: "Together today",
        available: !!together?.challenge,
        node: together?.challenge ? (
          <MiniCard
            icon={Heart}
            title="Together today"
            chip="bg-rose-400/25 text-rose-200"
            tint="rgba(244,114,182,0.18)"
          >
            <p className="text-sm leading-snug text-white/90">{together.challenge}</p>
          </MiniCard>
        ) : null,
      },
      {
        id: "verse",
        title: "Verse of the day",
        available: !!together?.verse,
        node: together?.verse ? (
          <MiniCard
            icon={BookOpen}
            title="Verse of the day"
            chip="bg-violet-400/25 text-violet-200"
            tint="rgba(167,139,250,0.18)"
          >
            <p className="text-sm leading-snug text-white/90">{together.verse.text}</p>
            {together.verse.reference && (
              <p className="mt-1.5 text-xs font-medium text-violet-200/80">
                {together.verse.reference}
              </p>
            )}
          </MiniCard>
        ) : null,
      },
      {
        id: "funfact",
        title: "Fun fact",
        available: !!together?.funFact,
        node: together?.funFact ? (
          <MiniCard
            icon={Lightbulb}
            title="Fun fact"
            chip="bg-amber-400/25 text-amber-200"
            tint="rgba(251,191,36,0.16)"
          >
            <p className="text-sm leading-snug text-white/90">{together.funFact}</p>
          </MiniCard>
        ) : null,
      },
      {
        id: "family",
        title: "Family today",
        available: !!together?.family,
        node: together?.family ? (
          <MiniCard
            icon={Users}
            title="Family today"
            chip="bg-sky-400/25 text-sky-200"
            tint="rgba(56,189,248,0.16)"
          >
            <p className="text-sm leading-snug text-white/90">{together.family}</p>
          </MiniCard>
        ) : null,
      },
      {
        id: "joke",
        title: "Daily laugh",
        available: !!together?.joke,
        node: together?.joke ? (
          <MiniCard
            icon={Smile}
            title="Daily laugh"
            chip="bg-emerald-400/25 text-emerald-200"
            tint="rgba(52,211,153,0.16)"
          >
            <p className="text-sm leading-snug text-white/90">{together.joke}</p>
          </MiniCard>
        ) : null,
      },
    ];
  }, [current, currentInfo, data, unitLabel, conditions, hours, todaySun, spend, together]);

  // Apply saved order, appending any new widgets at the end.
  const orderedWidgets = useMemo(() => {
    const ids = widgets.map((w) => w.id);
    const known = order.filter((id) => ids.includes(id));
    const missing = ids.filter((id) => !known.includes(id));
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

  // Group visible widgets into channels, dropping any empty channel.
  const sections = useMemo(() => {
    return CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      widgets: visibleWidgets.filter((w) => c.ids.includes(w.id)),
    })).filter((s) => s.widgets.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedWidgets, hidden]);

  const sectionCount = sections.length;

  const goTo = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActiveIndex(index);
  }, []);

  const handleCarouselScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  }, []);

  // Keep the active index valid as channels appear/disappear.
  useEffect(() => {
    if (activeIndex > sectionCount - 1) setActiveIndex(Math.max(0, sectionCount - 1));
  }, [sectionCount, activeIndex]);

  // Auto-advance to the next channel. Resets whenever the index changes (so a
  // manual swipe gives you a fresh 30s), and pauses while editing.
  useEffect(() => {
    if (!autoRotate || editMode || sectionCount <= 1) return;
    const t = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const next = (activeIndex + 1) % sectionCount;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [autoRotate, editMode, sectionCount, activeIndex]);

  return (
    <div
      className="min-h-screen w-full text-white antialiased transition-[background] duration-1000"
      style={{ background: gradient }}
    >
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-5 md:gap-5 md:p-8">
        {/* Top bar: clock + controls */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-6xl font-light leading-none tracking-tight md:text-7xl">
              {timeStr}
            </div>
            <div className="mt-2 text-lg font-light text-white/80 md:text-xl">
              {GREETINGS[part]} · {dateStr}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/25"
            >
              <MapPin className="h-4 w-4" />
              {location ? location.label : "Set location"}
            </button>
            <button
              onClick={() => {
                setShowWidgets((s) => !s);
                setShowSearch(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md transition",
                showWidgets ? "bg-white/30" : "bg-white/15 hover:bg-white/25"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Widgets
            </button>
            <button
              onClick={() => setEditMode((e) => !e)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md transition",
                editMode
                  ? "bg-emerald-400/30 hover:bg-emerald-400/40"
                  : "bg-white/15 hover:bg-white/25"
              )}
            >
              {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {editMode ? "Done" : "Edit layout"}
            </button>
          </div>
        </header>

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
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/35">
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

        {/* Channel tabs */}
        {sectionCount > 1 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition",
                    i === activeIndex
                      ? "bg-white/35 text-white"
                      : "bg-white/12 text-white/70 hover:bg-white/20"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAutoRotate((a) => !a)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-md transition hover:bg-white/25"
              aria-label={autoRotate ? "Pause auto-rotate" : "Resume auto-rotate"}
            >
              {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRotate ? "Auto" : "Paused"}
            </button>
          </div>
        )}

        {/* Channel carousel */}
        {sectionCount > 0 && (
          <div
            ref={scrollRef}
            onScroll={handleCarouselScroll}
            className="flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((s) => (
              <section
                key={s.id}
                className="w-full shrink-0 snap-center overflow-y-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={s.widgets.map((w) => w.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                      style={{ gridAutoRows: `${ROW_UNIT}px`, gridAutoFlow: "row dense" }}
                    >
                      {s.widgets.map((w) => (
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
          </div>
        )}

        {location && (
          <footer className="mt-auto pt-4 text-center text-xs text-white/40">
            {location.label} · Weather by Open-Meteo · Updates every 5 min
          </footer>
        )}
      </div>
    </div>
  );
}

// Measures content height and returns the number of base rows to span so the
// grid cell hugs the content (CSS-grid masonry technique).
function useRowSpan(deps: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [span, setSpan] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      setSpan(Math.max(1, Math.ceil((h + GRID_GAP) / (ROW_UNIT + GRID_GAP))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
  return { ref, span };
}

// A sortable, content-sized grid cell wrapping a single widget.
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
  const { ref: measureRef, span } = useRowSpan(`${size}-${editMode}`);

  const style: React.CSSProperties = {
    gridRowEnd: `span ${span}`,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        SIZE_SPAN[size],
        "min-w-0",
        isDragging && "z-50 opacity-80"
      )}
    >
      <div ref={measureRef}>
        <div
          className={cn(
            "relative",
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
                      {s.charAt(0).toUpperCase()}
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
          <div className={cn(editMode && "pt-10")}>{children}</div>
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
    <div className="flex items-center gap-5 rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
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
    <div className="grid grid-cols-2 gap-4 rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
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
        label="UV index"
        value={data ? `${Math.round(data.daily.uv_index_max[0])}` : "—"}
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
    <div className="rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
        Next hours
      </h2>
      <div className="flex justify-between gap-2 overflow-x-auto">
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
    <div className="rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
        7-day forecast
      </h2>
      <div className="space-y-1.5">
        {data.daily.time.map((day, i) => {
          const info = weatherInfo(data.daily.weather_code[i], true);
          const left = ((lows[i] - weekMin) / span) * 100;
          const width = ((highs[i] - lows[i]) / span) * 100;
          const pop = data.daily.precipitation_probability_max[i];
          return (
            <div
              key={day}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
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
      className="flex flex-col justify-center gap-5 rounded-3xl border border-white/10 p-6 backdrop-blur-md"
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

function SpendCard({ spend }: { spend: SpendData }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/25 text-emerald-200">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Spent yesterday
            </span>
          </div>
          <div className="text-5xl font-light">
            $
            {spend.total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1 text-sm text-white/60">
            {spend.count} {spend.count === 1 ? "transaction" : "transactions"}
          </div>
        </div>
        {spend.trend && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/55">
              Last 7 days
            </div>
            <div className="text-2xl font-light">
              ${Math.round(spend.trend.thisWeek).toLocaleString()}
            </div>
            {spend.trend.changePct != null && (
              <div
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 text-sm",
                  spend.trend.changePct > 0 ? "text-rose-300" : "text-emerald-300"
                )}
              >
                {spend.trend.changePct > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {Math.abs(spend.trend.changePct)}% vs prior wk
              </div>
            )}
          </div>
        )}
      </div>

      {spend.trend && <SpendTrend days={spend.trend.days} />}

      {spend.top && spend.top.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {spend.top.map((t, i) => (
            <li
              key={`${t.name}-${i}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate text-white/75">{t.name}</span>
              <span className="shrink-0 text-white/90">${t.amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BillsCard({ spend }: { spend: SpendData }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
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
          <ul className="mt-4 space-y-2">
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

function BudgetCard({
  breakdown,
}: {
  breakdown: NonNullable<SpendData["breakdown"]>;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-400/25 text-fuchsia-200">
            <PieChart className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {breakdown.period} budget
          </span>
        </div>
        <span className="text-lg font-light">
          ${Math.round(breakdown.total).toLocaleString()}
        </span>
      </div>
      <div className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
        <BreakdownList
          heading="By category"
          items={breakdown.categories}
          from="#c084fc"
          to="#f0abfc"
        />
        <BreakdownList
          heading="By vendor"
          items={breakdown.vendors}
          from="#5eead4"
          to="#7dd3fc"
        />
      </div>
    </div>
  );
}

function MiniCard({
  icon: Icon,
  title,
  chip,
  tint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  chip?: string;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl border border-white/10 p-4 backdrop-blur-md"
      style={{
        background: tint
          ? `linear-gradient(135deg, ${tint} 0%, rgba(255,255,255,0.08) 70%)`
          : "rgba(255,255,255,0.12)",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg",
            chip ?? "bg-white/15 text-white/70"
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          {title}
        </span>
      </div>
      {children}
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
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
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

function SpendTrend({ days }: { days: { date: string; total: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="mt-5 flex h-24 items-end gap-2">
      {days.map((d, i) => {
        const pct = (d.total / max) * 100;
        const isYesterday = i === days.length - 1;
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-white/55">
              {d.total > 0 ? `$${Math.round(d.total)}` : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-md transition-all duration-700",
                  isYesterday
                    ? "bg-gradient-to-t from-emerald-400/70 to-emerald-200"
                    : "bg-gradient-to-t from-sky-400/50 to-sky-200/80"
                )}
                style={{ height: `${Math.max(4, pct)}%` }}
              />
            </div>
            <span className="text-[10px] text-white/55">
              {new Date(d.date + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "narrow",
              })}
            </span>
          </div>
        );
      })}
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
  score,
  label,
  reason,
}: {
  icon: LucideIcon;
  emoji: string;
  title: string;
  score: number;
  label: string;
  reason: string;
}) {
  const color = scoreColor(score);
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/10 p-6 backdrop-blur-md"
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
