import { createClient } from "@supabase/supabase-js";
import LaunchSubscribeForm from "@/components/launch-subscribe-form";
import {
  allDayDateStamp,
  formatLocalTime,
  humanDateFromStamp,
  launchSummary,
  type CalendarLaunch,
} from "@/utils/launches/ics";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Florida Launch Calendar | Krezzo",
  description:
    "Email calendar invites for rocket launches from Cape Canaveral and Kennedy Space Center.",
};

type Row = CalendarLaunch & { last_seen_at: string | null };

async function loadLaunches(): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("launch_schedule")
      .select("*")
      .gte("net", new Date(Date.now() - 86_400_000).toISOString())
      .order("net", { ascending: true })
      .limit(40);
    return (data ?? []) as Row[];
  } catch {
    return [];
  }
}

function statusTone(launch: Row): string {
  if (launch.cancelled) return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  if (launch.status === "Go") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

export default async function LaunchesPage() {
  const launches = await loadLaunches();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            Cape Canaveral &amp; Kennedy Space Center
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Florida Launch Calendar</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Enter your email and the upcoming Florida launches land on your calendar as invites.
            When a new one gets a date and time, that invite is emailed too.
          </p>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800">
          <h2 className="text-lg font-semibold">Subscribe</h2>
          <LaunchSubscribeForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">On the schedule</h2>
          {launches.length === 0 ? (
            <p className="rounded-2xl bg-slate-900/60 p-5 text-sm text-slate-400 ring-1 ring-slate-800">
              Nothing synced yet. The schedule refreshes hourly.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {launches.map((launch) => (
                <li
                  key={launch.launch_id}
                  className="flex flex-col gap-2 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-base font-medium leading-snug">
                      {launchSummary(launch).replace(/^Launch(?: \(time TBD\))?: /, "")}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone(launch)}`}
                    >
                      {launch.cancelled ? "Scrubbed" : (launch.status ?? "TBD")}
                    </span>
                  </div>
                  <p className="text-sm text-sky-300">
                    {launch.net_precision === "DAY"
                      ? `${humanDateFromStamp(allDayDateStamp(new Date(launch.net)))} — time TBD`
                      : formatLocalTime(launch.net)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {[launch.pad_name, launch.pad_location].filter(Boolean).join(", ")}
                  </p>
                  {launch.last_change && (
                    <p className="text-xs text-amber-300/80">{launch.last_change}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
