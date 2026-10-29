"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUp, Mic, SlidersHorizontal, Square } from "lucide-react";
import { cn } from "@/utils/styles";
import { intentionScore } from "@/utils/intentional/score";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Kind = "action" | "thought" | "idea" | "reminder" | "note" | "habit" | "principle" | "lesson";

type Card = {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  est_minutes: number | null;
  stars: number;
  prioritized: boolean;
  status: string;
  due_date: string | null;
  related_ids: string[];
  last_done_on: string | null;
  created_at: string;
  boost: number;
  area_id: string | null;
  completed_at?: string | null;
};

type Log = { card_id: string | null; area_id: string | null; seconds: number; ended_at: string };

type Area = {
  id: string;
  name: string;
  emoji: string;
  statement: string | null;
  weekly_minutes: number | null;
  focus: "work" | "personal" | "any";
  sort: number;
  minutes_week: number;
};

type Job = { id: string; status: "processing" | "done" | "failed"; progress: number; log: string[]; created_at: string };
type State = {
  cards: Card[];
  done: Card[];
  history: Log[];
  jobs: Job[];
  areas: Area[];
  today: string;
  minutesToday: number;
};
type Filter = "all" | "prioritized" | Kind;
type Timer = { id: string; startedAt: string };

const KIND_META: Record<Kind, { label: string; emoji: string; tone: string }> = {
  action: { label: "Action", emoji: "✅", tone: "bg-sky-50 text-sky-700" },
  thought: { label: "Thought", emoji: "💭", tone: "bg-violet-50 text-violet-700" },
  idea: { label: "Idea", emoji: "💡", tone: "bg-amber-50 text-amber-700" },
  reminder: { label: "Reminder", emoji: "⏰", tone: "bg-rose-50 text-rose-700" },
  note: { label: "Note", emoji: "📝", tone: "bg-stone-100 text-stone-700" },
  habit: { label: "Daily", emoji: "🔁", tone: "bg-emerald-50 text-emerald-700" },
  principle: { label: "Mindset", emoji: "🧭", tone: "bg-indigo-50 text-indigo-700" },
  lesson: { label: "Lesson", emoji: "⚠️", tone: "bg-amber-50 text-amber-800" },
};
const KINDS = Object.keys(KIND_META) as Kind[];
const TIMER_KEY = "intentional.timer";

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function dueLabel(due: string, today: string) {
  if (due < today) return "Overdue";
  if (due === today) return "Today";
  if (due === addDays(today, 1)) return "Tomorrow";
  return new Date(`${due}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ageLabel(createdAt: string): string | null {
  const days = (Date.now() - Date.parse(createdAt)) / 86400000;
  if (days < 1) return null;
  if (days < 14) return `${Math.floor(days)}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

function fmtClock(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

async function api(body?: object): Promise<State & { addedId?: string; addedSince?: string; transcriptId?: string | null; error?: string }> {
  const res = await fetch("/api/intentional", body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || "Something went wrong"), { status: res.status });
  return json;
}

export default function IntentionalPage() {
  const [state, setState] = useState<State | null>(null);
  const [authError, setAuthError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [areasOpen, setAreasOpen] = useState(false);
  const [view, setView] = useState<"plan" | "reflect">("plan");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = (c: Card) => !q || `${c.title} ${c.body ?? ""}`.toLowerCase().includes(q);
  const [now, setNow] = useState(() => new Date());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [mindsetIdx, setMindsetIdx] = useState(0);
  const [pending, setPending] = useState<Card[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [dismissedJobs, setDismissedJobs] = useState<string[]>([]);
  useEffect(() => {
    setDismissedJobs(JSON.parse(localStorage.getItem("intentional.dismissedJobs") || "[]"));
  }, []);
  useEffect(() => {
    if (dismissedJobs.length) localStorage.setItem("intentional.dismissedJobs", JSON.stringify(dismissedJobs.slice(-20)));
  }, [dismissedJobs]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const run = useCallback(async (body?: object) => {
    try {
      const next = await api(body);
      setState(next);
      return next;
    } catch (err) {
      if ((err as { status?: number }).status === 401) setAuthError(true);
      else setToast({ text: (err as Error).message });
      throw err;
    }
  }, []);

  useEffect(() => {
    run().catch(() => {});
    const saved = localStorage.getItem(TIMER_KEY);
    if (saved) setTimer(JSON.parse(saved));
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [run]);

  useEffect(() => {
    if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(TIMER_KEY);
  }, [timer]);

  const processing = !!state?.jobs.some((j) => j.status === "processing");

  useEffect(() => {
    if (!since || processing) return;
    const t = setTimeout(() => setSince(null), 60000);
    return () => clearTimeout(t);
  }, [since, processing]);

  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => run().catch(() => {}), 1200);
    return () => clearInterval(t);
  }, [processing, run]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const cards = useMemo(() => state?.cards ?? [], [state]);
  const today = state?.today ?? now.toISOString().slice(0, 10);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const areas = useMemo(() => state?.areas ?? [], [state]);
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const areaOf = (c: Card) => (c.area_id ? areaById.get(c.area_id) ?? null : null);
  const principles = cards.filter((c) => c.kind === "principle");
  const hourKey = `${today}-${now.getHours()}`;
  const scores = useMemo(() => {
    const at = new Date();
    return new Map(cards.map((c) => [c.id, intentionScore(c, at, today, c.area_id ? areaById.get(c.area_id) : null)]));
    // re-rank on the hour, not every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, today, hourKey, areaById]);
  const total = (c: Card) => (scores.get(c.id)?.score ?? 0) + (c.boost ?? 0);
  const counts = new Map<Filter, number>();
  const areaCounts = new Map<string, number>();
  for (const c of cards) {
    if (c.area_id) areaCounts.set(c.area_id, (areaCounts.get(c.area_id) ?? 0) + 1);
    counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
    if (c.prioritized) counts.set("prioritized", (counts.get("prioritized") ?? 0) + 1);
  }
  const filterOptions = (["prioritized", ...KINDS] as Filter[])
    .filter((f) => counts.get(f))
    .sort((x, y) => (counts.get(y) ?? 0) - (counts.get(x) ?? 0));
  const kindOrder = [...KINDS].sort((x, y) => (counts.get(y) ?? 0) - (counts.get(x) ?? 0));
  const areaOrder = [...areas].sort((x, y) => (areaCounts.get(y.id) ?? 0) - (areaCounts.get(x.id) ?? 0) || x.sort - y.sort);
  const activeArea = areaFilter !== "all" ? areaById.get(areaFilter) ?? null : null;
  const list = cards
    .filter((c) => !activeArea || c.area_id === activeArea.id)
    .filter(matches)
    .filter((c) =>
      filter === "all" ? c.kind !== "principle" : filter === "prioritized" ? c.prioritized : c.kind === filter
    )
    .sort((x, y) => total(y) - total(x));
  const mindset = principles.length ? principles[mindsetIdx % principles.length] : null;
  const fresh = [
    ...pending,
    ...(since ? cards.filter((c) => c.created_at >= since) : []).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    ),
  ];
  const freshIds = new Set(fresh.map((c) => c.id));
  const show = (list: Card[]) => list.filter((c) => !freshIds.has(c.id));

  const patchLocal = (id: string, patch: Partial<Card> | null) =>
    setState((s) =>
      s && {
        ...s,
        cards: patch
          ? s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c))
          : s.cards.filter((c) => c.id !== id),
      }
    );

  const archive = (card: Card) => {
    if (card.id.startsWith("tmp-")) return;
    patchLocal(card.id, null);
    run({ action: "archive", id: card.id }).catch(() => {});
    setToast({ text: `Deleted “${card.title}”`, undo: () => run({ action: "restore", id: card.id }).catch(() => {}) });
  };

  const markDone = (card: Card) => {
    if (card.id.startsWith("tmp-")) return;
    if (card.kind === "habit" && card.last_done_on === today) return;
    complete(card);
  };

  const play = (card: Card) => {
    if (card.id.startsWith("tmp-")) return;
    setTimer({ id: card.id, startedAt: new Date().toISOString() });
  };

  const shown = show(list);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = shown.findIndex((c) => c.id === active.id);
    const to = shown.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    const rest = shown.filter((c) => c.id !== active.id);
    const above = rest[to - 1];
    const below = rest[to];
    const target =
      above && below ? (total(above) + total(below)) / 2 : above ? total(above) - 5 : total(below) + 5;
    const card = shown[from];
    const boost = target - (scores.get(card.id)?.score ?? 0);
    patchLocal(card.id, { boost });
    run({ action: "update", id: card.id, fields: { boost } }).catch(() => {});
  };

  const complete = (card: Card, startedAt?: string) => {
    if (card.kind === "habit") patchLocal(card.id, { last_done_on: today });
    else patchLocal(card.id, null);
    run({ action: "complete", id: card.id, started_at: startedAt }).catch(() => {});
    setToast({
      text: startedAt ? "Done — time logged" : "Done 🎉",
      undo: card.kind === "habit" ? undefined : () => run({ action: "restore", id: card.id }).catch(() => {}),
    });
  };

  const tempCard = (title: string, kind: Kind, areaId: string | null): Card => ({
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    title,
    body: null,
    est_minutes: null,
    stars: 3,
    prioritized: false,
    status: "open",
    due_date: null,
    related_ids: [],
    last_done_on: null,
    created_at: new Date().toISOString(),
    boost: 0,
    area_id: areaId,
  });

  const submitText = async (text: string) => {
    const single = text.length <= 200 && !text.includes("\n");
    const areaId = activeArea?.id ?? null;
    const temp = tempCard((text.split("\n")[0] || text).slice(0, 120), single ? "action" : "note", areaId);
    setPending((p) => [temp, ...p]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await run({ action: "capture", text, mode: "auto", area_id: areaId });
      const at = res.addedSince!;
      setSince((s) => (s && s < at ? s : at));
      // single cards: pick up the background AI sorting (transcripts poll their job)
      if (single) [4000, 10000].forEach((ms) => setTimeout(() => run().catch(() => {}), ms));
    } catch {
      /* toast shown */
    } finally {
      setPending((p) => p.filter((c) => c.id !== temp.id));
    }
  };

  const sendAudio = async (audio: Blob, prefix: string) => {
    const temp = tempCard("🎙 Transcribing voice memo…", "note", activeArea?.id ?? null);
    setPending((p) => [temp, ...p]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const transcript = await transcribeBlob(audio);
      setPending((p) => p.filter((c) => c.id !== temp.id));
      await submitText(prefix ? `${prefix}\n${transcript}` : transcript);
    } catch (err) {
      setPending((p) => p.filter((c) => c.id !== temp.id));
      setToast({ text: (err as Error).message });
    }
  };

  if (authError) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-stone-900">Intentional</h1>
        <p className="text-stone-600">Sign in to see your cards.</p>
        <Link href="/sign-in" className="min-h-11 px-6 inline-flex items-center rounded-full bg-stone-900 text-white font-medium">
          Sign in
        </Link>
      </main>
    );
  }

  const job = state?.jobs.find((j) => !dismissedJobs.includes(j.id)) ?? null;
  const openCard = openId ? byId.get(openId) ?? null : null;
  const timerCard = timer ? byId.get(timer.id) ?? null : null;

  return (
    <main className="min-h-dvh max-w-xl mx-auto pb-32 text-stone-900">
      <nav className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur px-3 pb-2 border-b border-stone-200 space-y-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}>
        <div className="flex items-center gap-2">
        <Image src="/favicon.png" alt="Krezzo" width={32} height={32} className="size-8 shrink-0" priority />
        <div className="relative flex-1 min-w-0">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === "reflect" ? "Search what you’ve done" : "Search cards"}
            className="w-full min-h-11 rounded-full bg-white border border-stone-200 pl-4 pr-12 text-base outline-none focus:border-stone-400"
          />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Filters and settings"
            aria-expanded={menuOpen}
            className={cn("absolute right-0 top-0 size-11 flex items-center justify-center rounded-full",
              menuOpen || view === "reflect" || filter !== "all" || areaFilter !== "all" ? "text-stone-900" : "text-stone-400")}
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
        </div>

        {menuOpen && (
          <div className="rounded-2xl bg-white border border-stone-200 p-3 space-y-3">
            <div>
              <Label>Intention</Label>
              <ChipRow
                max={5}
                active={areaFilter}
                onSelect={(id) => { setAreaFilter(id); setMenuOpen(false); }}
                items={[
                  { id: "all", label: "All" },
                  ...areaOrder.map((a) => ({
                    id: a.id,
                    label: `${a.emoji} ${a.name}${areaCounts.get(a.id) ? ` ${areaCounts.get(a.id)}` : ""}`,
                  })),
                ]}
              />
            </div>
            <div>
              <Label>Show</Label>
              <div className="flex gap-2">
                <Chip active={view === "plan"} onClick={() => { setView("plan"); setMenuOpen(false); }}>Upcoming</Chip>
                <Chip active={view === "reflect"} onClick={() => { setView("reflect"); setMenuOpen(false); }}>✓ Done & reflections</Chip>
              </div>
            </div>
            {view === "plan" && (
              <div>
                <Label>Type</Label>
                <ChipRow
                  max={5}
                  active={filter}
                  onSelect={(f) => { setFilter(f); setMenuOpen(false); }}
                  items={[
                    { id: "all" as Filter, label: "Any type" },
                    ...filterOptions.map((f) => ({
                      id: f,
                      label: f === "prioritized"
                        ? `★ Prioritized ${counts.get(f)}`
                        : `${KIND_META[f as Kind].emoji} ${KIND_META[f as Kind].label} ${counts.get(f)}`,
                    })),
                  ]}
                />
              </div>
            )}
            <button onClick={() => { setAreasOpen(true); setMenuOpen(false); }}
              className="min-h-11 text-sm font-medium text-stone-700">
              Edit intentions →
            </button>
          </div>
        )}

        {(activeArea || view === "reflect" || filter !== "all") && (
          <div className="flex flex-wrap gap-2">
            {activeArea && <Chip active onClick={() => setAreaFilter("all")}>{activeArea.emoji} {activeArea.name} ✕</Chip>}
            {view === "reflect" && <Chip active onClick={() => setView("plan")}>✓ Done ✕</Chip>}
            {view === "plan" && filter !== "all" && (
              <Chip active onClick={() => setFilter("all")}>
                {filter === "prioritized" ? "★ Prioritized" : `${KIND_META[filter as Kind].emoji} ${KIND_META[filter as Kind].label}`} ✕
              </Chip>
            )}
          </div>
        )}
      </nav>

      <section className="px-3 pt-3 space-y-2">
        {!state && <p className="text-center text-stone-500 py-10">Loading…</p>}

        {activeArea && <AreaHeader area={activeArea} onEdit={() => setAreasOpen(true)} />}

        {job && (
          <JobPanel
            job={job}
            onDismiss={() => setDismissedJobs((d) => [...d, job.id])}
            onRetry={() => {
              setSince(new Date().toISOString());
              run({ action: "reprocess", id: job.id }).catch(() => {});
            }}
          />
        )}

        {view === "reflect" && state && (
          <ReflectView
            done={state.done}
            history={state.history}
            cardsById={byId}
            areaById={areaById}
            activeArea={activeArea}
            today={today}
            matches={matches}
          />
        )}

        {view === "plan" && <>
        {mindset && !q && (
          <button
            onClick={() => setMindsetIdx((i) => i + 1)}
            className="w-full text-left rounded-2xl bg-indigo-50 text-indigo-900 px-4 py-3 min-h-11"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Remember</span>
            <span className="block font-medium">{mindset.title}</span>
          </button>
        )}
        {fresh.map((c) => (
          <CardRow key={c.id} card={c} today={today} isNew onOpen={setOpenId} onLeft={archive} onRight={markDone}
            onPlay={play} area={activeArea ? null : areaOf(c)} />
        ))}

        {state && list.length === 0 && fresh.length === 0 && (
          <Empty>
            {filter === "principle"
              ? "Add reminders like “Lead without permission” or “Be concise.”"
              : "No cards yet. Tap + to add one."}
          </Empty>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {shown.map((c) => (
                <SortableCardRow key={c.id} card={c} today={today} reason={scores.get(c.id)?.reason}
                  area={activeArea ? null : areaOf(c)}
                  onOpen={setOpenId} onLeft={archive} onRight={markDone} onPlay={play}
                  {...(c.kind === "habit" ? { done: c.last_done_on === today, onCheck: () => complete(c) } : {})} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </>}
      </section>

      <button
        onClick={() => setCaptureOpen(true)}
        aria-label="Add"
        className="fixed right-5 z-20 size-14 rounded-full bg-stone-900 text-white text-3xl shadow-lg"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        +
      </button>

      {toast && (
        <div className="fixed inset-x-3 z-30 mx-auto max-w-md rounded-xl bg-stone-900 text-white px-4 py-2 flex items-center gap-3 shadow-lg"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
          <span className="flex-1 text-sm">{toast.text}</span>
          {toast.undo && (
            <button className="min-h-11 px-3 font-semibold text-amber-300" onClick={() => { toast.undo!(); setToast(null); }}>
              Undo
            </button>
          )}
        </div>
      )}

      {captureOpen && (
        <CaptureSheet
          onClose={() => setCaptureOpen(false)}
          onSubmit={async (text) => { setCaptureOpen(false); await submitText(text); }}
          onSendAudio={(audio, prefix) => { setCaptureOpen(false); sendAudio(audio, prefix); }}
        />
      )}

      {openCard && (
        <CardSheet
          card={openCard}
          today={today}
          related={openCard.related_ids.map((id) => byId.get(id)).filter((c): c is Card => !!c)}
          kindOrder={kindOrder}
          areas={areaOrder}
          onClose={() => setOpenId(null)}
          onOpenRelated={setOpenId}
          onSave={(fields) => {
            patchLocal(openCard.id, fields);
            run({ action: "update", id: openCard.id, fields }).catch(() => {});
          }}
          onStart={() => { setTimer({ id: openCard.id, startedAt: new Date().toISOString() }); setOpenId(null); }}
          onDone={() => { complete(openCard); setOpenId(null); }}
          onDelete={() => { archive(openCard); setOpenId(null); }}
        />
      )}

      {areasOpen && (
        <AreasSheet
          areas={areas}
          onClose={() => setAreasOpen(false)}
          onSave={(id, fields) => run({ action: "area_save", id, fields }).catch(() => {})}
          onArchive={(id) => {
            if (areaFilter === id) setAreaFilter("all");
            run({ action: "area_archive", id }).catch(() => {});
          }}
        />
      )}

      {timer && (
        <TimerOverlay
          card={timerCard}
          startedAt={timer.startedAt}
          now={now}
          onCancel={() => setTimer(null)}
          onDone={() => { if (timerCard) complete(timerCard, timer.startedAt); setTimer(null); }}
        />
      )}
    </main>
  );
}

function ChipRow<T extends string>({
  items, active, onSelect, max = 4, extra,
}: {
  items: { id: T; label: React.ReactNode }[];
  active: T;
  onSelect: (id: T) => void;
  max?: number;
  extra?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  let visible = expanded ? items : items.slice(0, max);
  if (!expanded && !visible.some((i) => i.id === active)) {
    const current = items.find((i) => i.id === active);
    if (current) visible = [...visible.slice(0, max - 1), current];
  }
  const hidden = items.length - visible.length;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((i) => (
        <Chip key={i.id} active={i.id === active} onClick={() => onSelect(i.id)}>{i.label}</Chip>
      ))}
      {hidden > 0 && <Chip active={false} onClick={() => setExpanded(true)}>+{hidden}</Chip>}
      {expanded && items.length > max && <Chip active={false} onClick={() => setExpanded(false)}>Less</Chip>}
      {extra}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-sm text-stone-500 px-6 py-8">{children}</p>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("shrink-0 min-h-11 px-4 rounded-full text-sm border",
        active ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200")}>
      {children}
    </button>
  );
}

function Stars({ value, onChange, size = "text-sm" }: { value: number; onChange?: (n: number) => void; size?: string }) {
  return (
    <span className={cn("inline-flex", size)} aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} onClick={() => onChange(n)} className="min-w-11 min-h-11 text-2xl"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            {n <= value ? "★" : "☆"}
          </button>
        ) : (
          <span key={n} className={n <= value ? "text-amber-500" : "text-stone-300"}>★</span>
        )
      )}
    </span>
  );
}

const SWIPE_AT = 90;

type CardRowProps = {
  card: Card;
  today: string;
  isNew?: boolean;
  reason?: string | null;
  area?: Area | null;
  onOpen: (id: string) => void;
  onLeft: (c: Card) => void;
  onRight: (c: Card) => void;
  onPlay: (c: Card) => void;
  done?: boolean;
  onCheck?: () => void;
};

function SortableCardRow(props: CardRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.card.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-20 opacity-90 shadow-xl rounded-2xl")}>
      <CardRow {...props} handle={
        <span
          {...attributes}
          {...listeners}
          onPointerDown={(e) => { listeners?.onPointerDown?.(e); e.stopPropagation(); }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
          className="-ml-3 -my-1 w-8 h-11 shrink-0 flex items-center justify-center text-stone-300 cursor-grab active:cursor-grabbing touch-none"
        >
          ⋮⋮
        </span>
      } />
    </div>
  );
}

function CardRow({
  card, today, onOpen, onLeft, onRight, onPlay, done, onCheck, isNew, reason, area, handle,
}: CardRowProps & { handle?: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const moved = useRef(false);
  const meta = KIND_META[card.kind];
  const important = card.kind !== "principle" && card.stars >= 4;
  const age = card.kind === "habit" || card.kind === "principle" || isNew ? null : ageLabel(card.created_at);
  const playable = !done && !card.id.startsWith("tmp-") && ["action", "habit", "reminder"].includes(card.kind);
  const hasMeta = isNew || !!reason || !!area || !!age || card.kind !== "action" || !!card.due_date || !!card.est_minutes || important
    || card.related_ids.length > 0;

  const end = () => {
    if (dx <= -SWIPE_AT) onLeft(card);
    else if (dx >= SWIPE_AT) onRight(card);
    setDx(0);
    start.current = null;
    axis.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className={cn("absolute inset-0 flex items-center px-5 text-sm font-semibold text-white",
        dx > 0 ? "bg-emerald-500 justify-start" : "bg-rose-500 justify-end")}>
        {dx > 0 ? "✓ Done" : "Delete"}
      </div>
      <div
        className={cn("group relative bg-white border rounded-2xl px-4 py-3 flex items-start gap-3 select-none cursor-pointer",
          isNew ? "border-emerald-300" : "border-stone-200",
          dx === 0 && "transition-transform", done && "opacity-50")}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; moved.current = false; }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const ddx = e.clientX - start.current.x;
          const ddy = e.clientY - start.current.y;
          if (!axis.current && Math.hypot(ddx, ddy) > 8) {
            axis.current = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
            if (axis.current === "x") e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (axis.current) moved.current = true;
          if (axis.current === "x") setDx(ddx);
        }}
        onPointerUp={end}
        onPointerCancel={() => { setDx(0); start.current = null; axis.current = null; }}
        onClick={() => { if (!moved.current) onOpen(card.id); }}
      >
        {handle}
        {onCheck ? (
          <button
            onClick={(e) => { e.stopPropagation(); if (!done) onCheck(); }}
            aria-label={done ? "Done today" : "Mark done today"}
            className="-ml-2 -my-1 size-11 shrink-0 flex items-center justify-center"
          >
            <span className={cn("size-6 rounded-full border-2 flex items-center justify-center text-xs",
              done ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300")}>
              {done && "✓"}
            </span>
          </button>
        ) : (
          <span className="text-lg leading-6 pt-0.5" aria-hidden>{meta.emoji}</span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium leading-snug break-words">
            {card.prioritized && <span className="text-amber-500 mr-1">★</span>}
            {card.title}
          </p>
          {hasMeta && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
              {isNew && <span className="rounded-full bg-emerald-500 px-2 py-0.5 font-semibold text-white">New</span>}
              {reason && <span className="font-medium text-indigo-600">{reason}</span>}
              {area && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{area.emoji} {area.name}</span>}
              {card.kind !== "action" && <span className={cn("rounded-full px-2 py-0.5", meta.tone)}>{meta.label}</span>}
              {card.due_date && (
                <span className={cn("font-medium",
                  card.due_date <= today ? "text-rose-600" : card.due_date === addDays(today, 1) ? "text-amber-600" : "")}>
                  {dueLabel(card.due_date, today)}
                </span>
              )}
              {card.est_minutes && <span>~{card.est_minutes} min</span>}
              {important && <Stars value={card.stars} size="text-xs" />}
              {card.related_ids.length > 0 && <span>🔗 {card.related_ids.length}</span>}
              {age && <span className="text-stone-400" title="Age">{age}</span>}
            </div>
          )}
        </div>
        {!card.id.startsWith("tmp-") && (
          <div className="hidden pointer-fine:flex -my-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onRight(card); }}
              aria-label="Mark done"
              title="Mark done"
              className="size-11 rounded-full text-stone-400 hover:bg-emerald-50 hover:text-emerald-600"
            >
              ✓
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onLeft(card); }}
              aria-label="Delete"
              title="Delete"
              className="size-11 rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-600"
            >
              🗑
            </button>
          </div>
        )}
        {playable && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(card); }}
            aria-label="Be intentional — start timer"
            title="Start timer"
            className="-my-1 -mr-2 size-11 shrink-0 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50"
          >
            <span className="size-8 rounded-full bg-emerald-50 flex items-center justify-center text-sm pl-0.5">▶</span>
          </button>
        )}
      </div>
    </div>
  );
}

function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA");
}

function dayLabel(d: string, today: string): string {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function ReflectView({ done, history, cardsById, areaById, activeArea, today, matches }: {
  matches: (c: Card) => boolean;
  done: Card[];
  history: Log[];
  cardsById: Map<string, Card>;
  areaById: Map<string, Area>;
  activeArea: Area | null;
  today: string;
}) {
  const inArea = (areaId: string | null) => !activeArea || areaId === activeArea.id;
  const doneIds = new Set(done.map((c) => c.id));
  const minsByCard = new Map<string, number>();
  type Item = { key: string; card: Card; minutes: number; habit?: boolean };
  const days = new Map<string, { items: Item[]; seconds: number }>();
  const day = (d: string) => days.get(d) ?? days.set(d, { items: [], seconds: 0 }).get(d)!;

  for (const l of history) {
    if (l.card_id) minsByCard.set(l.card_id, (minsByCard.get(l.card_id) ?? 0) + l.seconds / 60);
    if (inArea(l.area_id)) day(localDate(l.ended_at)).seconds += l.seconds;
  }
  for (const c of done) {
    if (!c.completed_at || !inArea(c.area_id) || !matches(c)) continue;
    day(localDate(c.completed_at)).items.push({ key: c.id, card: c, minutes: Math.round(minsByCard.get(c.id) ?? 0) });
  }
  // habit check-offs live only in the time log
  const seen = new Set<string>();
  for (const l of history) {
    const c = l.card_id ? cardsById.get(l.card_id) : null;
    if (!c || c.kind !== "habit" || doneIds.has(c.id) || !inArea(c.area_id) || !matches(c)) continue;
    const d = localDate(l.ended_at);
    const k = `${d}:${c.id}`;
    const entry = day(d);
    const existing = entry.items.find((i) => i.key === k);
    if (existing) existing.minutes += Math.round(l.seconds / 60);
    else if (!seen.has(k)) {
      seen.add(k);
      entry.items.push({ key: k, card: c, minutes: Math.round(l.seconds / 60), habit: true });
    }
  }

  const ordered = [...days.entries()].filter(([, v]) => v.items.length || v.seconds).sort((a, b) => b[0].localeCompare(a[0]));
  if (!ordered.length) {
    return <Empty>Nothing to look back on yet. Tap + → Reflect and talk through your day: wins, progress, mistakes.</Empty>;
  }

  return (
    <div className="space-y-5">
      {ordered.map(([d, { items, seconds }]) => {
        const lessons = items.filter((i) => i.card.kind === "lesson");
        const rest = items.filter((i) => i.card.kind !== "lesson");
        const mins = Math.round(seconds / 60);
        return (
          <section key={d}>
            <div className="flex items-baseline justify-between px-2 mb-2">
              <h2 className="font-semibold">{dayLabel(d, today)}</h2>
              <span className="text-xs text-stone-500">
                {[rest.length && `${rest.length} done`, lessons.length && `${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`, mins && `${mins} min`].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="space-y-2">
              {[...rest, ...lessons].map(({ key, card, minutes, habit }) => {
                const area = !activeArea && card.area_id ? areaById.get(card.area_id) : null;
                const lesson = card.kind === "lesson";
                return (
                  <div key={key} className={cn("rounded-2xl border px-4 py-3 flex items-start gap-3",
                    lesson ? "bg-amber-50 border-amber-200" : "bg-white border-stone-200")}>
                    <span className="text-lg leading-6" aria-hidden>{habit ? "🔁" : lesson ? "⚠️" : card.kind === "action" ? "✓" : KIND_META[card.kind].emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium leading-snug break-words">{card.title}</p>
                      {card.body && lesson && <p className="text-sm text-stone-600 mt-0.5">{card.body}</p>}
                      {(area || minutes > 0) && (
                        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-stone-500">
                          {area && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{area.emoji} {area.name}</span>}
                          {minutes > 0 && <span>{minutes} min</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AreaHeader({ area, onEdit }: { area: Area; onEdit: () => void }) {
  const target = area.weekly_minutes;
  const pct = target ? Math.min(100, (area.minutes_week / target) * 100) : 0;
  const fmt = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`);

  return (
    <div className="rounded-2xl bg-white border border-stone-200 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-8" aria-hidden>{area.emoji}</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg leading-8">{area.name}</h2>
          {area.statement && <p className="text-sm text-stone-600">{area.statement}</p>}
        </div>
        <button onClick={onEdit} className="min-h-11 px-3 -my-2 -mr-2 text-sm text-stone-500">Edit</button>
      </div>
      <div className="mt-3 text-xs text-stone-500">
        {target ? `${fmt(area.minutes_week)} of ${fmt(target)} this week` : `${fmt(area.minutes_week)} this week`}
      </div>
      {target && (
        <div className="mt-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

type AreaFields = Partial<Pick<Area, "name" | "emoji" | "statement" | "weekly_minutes" | "focus">>;

function AreasSheet({ areas, onClose, onSave, onArchive }: {
  areas: Area[];
  onClose: () => void;
  onSave: (id: string | undefined, fields: AreaFields) => void;
  onArchive: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");

  return (
    <Sheet onClose={onClose}>
      <h2 className="text-xl font-semibold mb-1">Intentions</h2>
      <p className="text-sm text-stone-500 mb-4">The parts of life every card belongs to. Weekly targets nudge neglected ones up the list.</p>
      <div className="space-y-3">
        {areas.map((a) => (
          <div key={a.id} className="rounded-2xl border border-stone-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input defaultValue={a.emoji} aria-label="Emoji" maxLength={8}
                onBlur={(e) => e.target.value.trim() && e.target.value !== a.emoji && onSave(a.id, { emoji: e.target.value })}
                className="w-12 min-h-11 rounded-xl border border-stone-200 text-center text-xl" />
              <input defaultValue={a.name} aria-label="Name"
                onBlur={(e) => e.target.value.trim() && e.target.value !== a.name && onSave(a.id, { name: e.target.value })}
                className="flex-1 min-w-0 min-h-11 rounded-xl border border-stone-200 px-3 text-base font-medium" />
            </div>
            <textarea defaultValue={a.statement ?? ""} rows={2} placeholder="Why this matters"
              onBlur={(e) => e.target.value !== (a.statement ?? "") && onSave(a.id, { statement: e.target.value || null })}
              className="w-full rounded-xl border border-stone-200 p-2 text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input type="number" inputMode="decimal" min={0} step={0.5}
                  defaultValue={a.weekly_minutes ? a.weekly_minutes / 60 : ""}
                  onBlur={(e) => {
                    const h = parseFloat(e.target.value);
                    const mins = Number.isFinite(h) && h > 0 ? Math.round(h * 60) : null;
                    if (mins !== a.weekly_minutes) onSave(a.id, { weekly_minutes: mins });
                  }}
                  className="w-20 min-h-11 rounded-xl border border-stone-200 px-2 text-base" />
                hrs / week
              </label>
              <select defaultValue={a.focus} aria-label="Best time"
                onChange={(e) => onSave(a.id, { focus: e.target.value as Area["focus"] })}
                className="min-h-11 rounded-xl border border-stone-200 px-2 text-sm bg-white">
                <option value="any">Anytime</option>
                <option value="work">Work hours</option>
                <option value="personal">Evenings & weekends</option>
              </select>
              <button onClick={() => confirm(`Remove “${a.name}”? Its cards stay, just untagged.`) && onArchive(a.id)} className="ml-auto min-h-11 px-3 text-sm text-rose-600">Remove</button>
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          onSave(undefined, { name: newName.trim() });
          setNewName("");
        }}
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New intention"
          className="flex-1 min-w-0 min-h-11 rounded-xl border border-stone-200 px-3 text-base" />
        <button className="min-h-11 px-4 rounded-full bg-stone-900 text-white font-medium">Add</button>
      </form>
    </Sheet>
  );
}

function JobPanel({ job, onDismiss, onRetry }: { job: Job; onDismiss: () => void; onRetry: () => void }) {
  const [open, setOpen] = useState(false);
  const running = job.status === "processing";
  const failed = job.status === "failed";
  const found = job.log.filter((l) => l.startsWith("+") || l.startsWith("◷") || l.startsWith("✓ Marked")).length;
  const final = job.log[job.log.length - 1] ?? "";

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (job.status !== "done") return;
    const t = setTimeout(() => dismissRef.current(), 4000);
    return () => clearTimeout(t);
  }, [job.status]);

  const label = running
    ? found ? `Processing · ${found} card${found === 1 ? "" : "s"} so far` : "Processing…"
    : failed ? "Couldn’t process — saved as a note" : final.replace(/^✓ Done · /, "✓ ");

  return (
    <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
      <div className="flex items-center gap-2 pl-4 pr-1">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 min-h-11 flex items-center gap-2 text-left text-sm">
          {running && <span className="size-3.5 shrink-0 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />}
          <span className={cn("truncate", failed ? "text-rose-600" : running ? "text-stone-700" : "text-emerald-700 font-medium")}>{label}</span>
        </button>
        {failed && <button onClick={onRetry} className="min-h-11 px-3 text-sm font-semibold text-stone-900">Retry</button>}
        {!running && <button onClick={onDismiss} aria-label="Dismiss" className="min-w-11 min-h-11 text-stone-400">✕</button>}
      </div>
      <div className="h-0.5 bg-stone-100">
        <div className={cn("h-full transition-all duration-500", failed ? "bg-rose-400" : "bg-emerald-500")}
          style={{ width: `${job.progress}%` }} />
      </div>
      {open && (
        <div className="max-h-40 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed text-stone-500 space-y-0.5">
          {job.log.map((line, i) => <p key={i} className="whitespace-pre-wrap break-words">{line}</p>)}
        </div>
      )}
    </div>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", new File([blob], `memo.${blob.type.includes("mp4") ? "mp4" : "webm"}`, { type: blob.type }));
  const res = await fetch("/api/intentional", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Couldn't transcribe that");
  return json.transcript as string;
}

const WAVE_BARS = 40;
const LIVE_EVERY_MS = 4000;
// Live preview re-transcribes the whole clip so far; stop previewing long memos to bound cost.
const LIVE_MAX_SECS = 240;

function CaptureSheet({ onClose, onSubmit, onSendAudio }: {
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
  onSendAudio: (audio: Blob, prefix: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;

  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try { await onSubmit(text.trim()); } catch { /* toast shown */ } finally { setBusy(false); }
  };

  // Voice: tap mic to start; ■ stops and shows the transcript, ↑ stops and sends.
  const [rec, setRec] = useState<"idle" | "recording" | "transcribing">("idle");
  const [recStart, setRecStart] = useState(0);
  const [recNow, setRecNow] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(WAVE_BARS).fill(0));
  const [live, setLive] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const liveBusy = useRef(false);

  useEffect(() => () => cleanupRef.current?.(), []);

  const startRecording = async () => {
    if (rec !== "idle") return;
    setRecError(null);
    setLive("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const type = () => r.mimeType || "audio/webm";
      chunksRef.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let raf = 0;
      let last = 0;
      const tick = (t: number) => {
        raf = requestAnimationFrame(tick);
        if (t - last < 60) return;
        last = t;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 5);
        setLevels((l) => [...l.slice(1), level]);
        setRecNow(Date.now());
      };
      raf = requestAnimationFrame(tick);

      const startedAt = Date.now();
      const liveTimer = setInterval(async () => {
        if (liveBusy.current || !chunksRef.current.length || Date.now() - startedAt > LIVE_MAX_SECS * 1000) return;
        liveBusy.current = true;
        try {
          setLive(await transcribeBlob(new Blob(chunksRef.current, { type: type() })));
        } catch {
          /* preview only */
        } finally {
          liveBusy.current = false;
        }
      }, LIVE_EVERY_MS);

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        clearInterval(liveTimer);
        ctx.close().catch(() => {});
        stream.getTracks().forEach((t) => t.stop());
      };

      r.onstop = () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        const blob = new Blob(chunksRef.current, { type: type() });
        if (!blob.size) { setRec("idle"); return; }
        if (sendRef.current) { onSendAudio(blob, textRef.current.trim()); return; }
        setRec("transcribing");
        transcribeBlob(blob)
          .then((t) => setText((prev) => (prev.trim() ? `${prev.trim()}\n${t}` : t)))
          .catch((err) => setRecError((err as Error).message))
          .finally(() => { setRec("idle"); setLive(""); });
      };

      recorderRef.current = r;
      sendRef.current = false;
      r.start(1000);
      setLevels(Array(WAVE_BARS).fill(0));
      setRecStart(Date.now());
      setRecNow(Date.now());
      setRec("recording");
    } catch {
      setRecError("Microphone blocked — allow it in your browser settings");
    }
  };

  const stopRecording = (send: boolean) => {
    sendRef.current = send;
    recorderRef.current?.stop();
  };
  const recSecs = Math.max(0, Math.floor((recNow - recStart) / 1000));

  // Track the visible viewport so the bottom bar sits above the on-screen keyboard.
  const [vp, setVp] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVp({ h: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const listening = rec !== "idle";

  return (
    <div
      className="fixed inset-x-0 z-40 flex flex-col bg-white"
      style={{ top: vp?.top ?? 0, height: vp ? `${vp.h}px` : "100dvh", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center px-3 pt-2">
        <button onClick={onClose} aria-label="Close" className="size-11 shrink-0 rounded-full text-xl text-stone-500">✕</button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 max-w-xl w-full mx-auto">
        {listening ? (
          <div className="flex-1 min-h-0 overflow-y-auto text-lg leading-relaxed whitespace-pre-wrap">
            {text.trim() && <span>{text.trim()}{"\n"}</span>}
            {live ? <span className="text-stone-500">{live}</span>
              : <span className="text-stone-400">{rec === "transcribing" ? "Transcribing…" : "Listening…"}</span>}
          </div>
        ) : (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Anything: a to-do, a brain dump, or what you got done today."
            className="flex-1 min-h-0 w-full resize-none text-lg leading-relaxed outline-none placeholder:text-stone-400"
          />
        )}
      </div>
      <div className="border-t border-stone-100 px-4 pt-3 max-w-xl w-full mx-auto"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {recError && <p className="mb-2 text-sm text-rose-600">{recError}</p>}
        {rec === "recording" ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 h-12 rounded-full bg-stone-100 px-4 flex items-center gap-3 overflow-hidden">
              <span className="text-sm tabular-nums text-stone-600 shrink-0">
                {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0 h-8 flex items-center justify-end gap-[3px]" aria-hidden>
                {levels.map((l, i) => (
                  <span key={i} className="w-[3px] shrink-0 rounded-full bg-rose-500 transition-[height] duration-75"
                    style={{ height: `${Math.max(3, l * 32)}px` }} />
                ))}
              </div>
            </div>
            <button onClick={() => stopRecording(false)} aria-label="Stop and review"
              className="size-12 shrink-0 rounded-full bg-stone-100 text-stone-800 flex items-center justify-center">
              <Square className="size-4 fill-current" />
            </button>
            <button onClick={() => stopRecording(true)} aria-label="Send"
              className="size-12 shrink-0 rounded-full bg-stone-900 text-white flex items-center justify-center">
              <ArrowUp className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={startRecording}
              disabled={rec === "transcribing"}
              aria-label="Record voice"
              className="size-12 shrink-0 rounded-full bg-stone-100 text-stone-800 flex items-center justify-center disabled:opacity-40"
            >
              <Mic className="size-5" />
            </button>
            <button
              disabled={busy || !text.trim() || rec !== "idle"}
              onClick={submit}
              className="flex-1 min-h-12 rounded-full bg-stone-900 text-white font-semibold disabled:opacity-40"
            >
              {rec === "transcribing" ? "Transcribing…" : busy ? "Saving…" : "Add"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardSheet({
  card, today, related, kindOrder, areas, onClose, onOpenRelated, onSave, onStart, onDone, onDelete,
}: {
  card: Card;
  today: string;
  related: Card[];
  kindOrder: Kind[];
  areas: Area[];
  onClose: () => void;
  onOpenRelated: (id: string) => void;
  onSave: (fields: Partial<Card>) => void;
  onStart: () => void;
  onDone: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body ?? "");
  useEffect(() => { setTitle(card.title); setBody(card.body ?? ""); }, [card.id, card.title, card.body]);

  const doable = card.kind !== "principle" && card.kind !== "thought" && card.kind !== "note" && card.kind !== "idea";
  const doneToday = card.kind === "habit" && card.last_done_on === today;

  return (
    <Sheet onClose={onClose}>
      <textarea
        value={title}
        rows={2}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== card.title && onSave({ title: title.trim() })}
        className="w-full text-xl font-semibold resize-none outline-none"
      />
      {areas.length > 0 && (
        <div className="mb-3">
          <Label>Intention</Label>
          <ChipRow
            active={card.area_id ?? "none"}
            onSelect={(id) => onSave({ area_id: id === "none" ? null : id })}
            items={[
              ...areas.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` })),
              { id: "none", label: "None" },
            ]}
          />
        </div>
      )}
      <Label>Type</Label>
      <ChipRow
        active={card.kind}
        onSelect={(k) => onSave({ kind: k })}
        items={kindOrder.map((k) => ({ id: k, label: `${KIND_META[k].emoji} ${KIND_META[k].label}` }))}
      />

      {card.kind !== "principle" && (
        <div className="mt-2">
          <Label>Importance</Label>
          <div className="text-amber-500 -ml-2"><Stars value={card.stars} onChange={(n) => onSave({ stars: n })} /></div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="block">
          <Label>Estimate (min)</Label>
          <input
            type="number" inputMode="numeric" min={1}
            defaultValue={card.est_minutes ?? ""}
            key={`m-${card.id}-${card.est_minutes}`}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              onSave({ est_minutes: Number.isFinite(n) && n > 0 ? n : null });
            }}
            className="w-full min-h-11 rounded-xl border border-stone-200 px-3 text-base"
          />
        </label>
        <label className="block">
          <Label>Due</Label>
          <input
            type="date"
            value={card.due_date ?? ""}
            onChange={(e) => onSave({ due_date: e.target.value || null })}
            className="w-full min-h-11 rounded-xl border border-stone-200 px-3 text-base bg-white"
          />
        </label>
      </div>

      <label className="block mt-3">
        <Label>Notes</Label>
        <textarea
          value={body}
          rows={3}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => body !== (card.body ?? "") && onSave({ body: body || null })}
          className="w-full rounded-xl border border-stone-200 p-3 text-base"
        />
      </label>

      {related.length > 0 && (
        <div className="mt-3">
          <Label>Related</Label>
          <div className="flex flex-col gap-1">
            {related.map((r) => (
              <button key={r.id} onClick={() => onOpenRelated(r.id)}
                className="min-h-11 text-left rounded-xl bg-stone-50 px-3 text-sm">
                {KIND_META[r.kind].emoji} {r.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {doable && !doneToday && (
          <button onClick={onStart} className="col-span-2 min-h-12 rounded-full bg-emerald-600 text-white font-semibold">
            ▶ Be intentional{card.est_minutes ? ` · ${card.est_minutes} min` : ""}
          </button>
        )}
        <button onClick={() => onSave({ prioritized: !card.prioritized })}
          className="min-h-11 rounded-full border border-stone-200 font-medium">
          {card.prioritized ? "Unprioritize" : "★ Prioritize"}
        </button>
        {doable && !doneToday ? (
          <button onClick={onDone} className="min-h-11 rounded-full border border-stone-200 font-medium">Mark done</button>
        ) : (
          <button onClick={onDelete} className="min-h-11 rounded-full border border-rose-200 text-rose-600 font-medium">Delete</button>
        )}
        {doable && !doneToday && (
          <button onClick={onDelete} className="col-span-2 min-h-11 text-rose-600 text-sm">Delete card</button>
        )}
      </div>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{children}</span>;
}

function TimerOverlay({
  card, startedAt, now, onCancel, onDone,
}: {
  card: Card | null;
  startedAt: string;
  now: Date;
  onCancel: () => void;
  onDone: () => void;
}) {
  const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(startedAt)) / 1000));
  const target = (card?.est_minutes ?? 0) * 60;
  const pct = target ? Math.min(100, (elapsed / target) * 100) : 0;
  const over = target > 0 && elapsed > target;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900 text-white flex flex-col items-center justify-center p-6 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <p className="text-sm uppercase tracking-wide text-stone-400">Being intentional</p>
      <h2 className="mt-2 text-2xl font-semibold max-w-sm break-words">{card?.title ?? "Card"}</h2>
      <p className={cn("mt-8 text-6xl font-light tabular-nums", over && "text-amber-400")}>{fmtClock(elapsed)}</p>
      {target > 0 && (
        <>
          <div className="mt-6 h-2 w-full max-w-xs rounded-full bg-stone-700 overflow-hidden">
            <div className={cn("h-full transition-all", over ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-stone-400">
            {over ? `${Math.ceil((elapsed - target) / 60)} min over estimate` : `of ~${card!.est_minutes} min`}
          </p>
        </>
      )}
      <button onClick={onDone} disabled={!card}
        className="mt-10 w-full max-w-xs min-h-14 rounded-full bg-emerald-500 text-lg font-semibold disabled:opacity-40">
        Done
      </button>
      <button onClick={onCancel} className="mt-3 min-h-11 px-6 text-stone-400">Cancel</button>
    </div>
  );
}
