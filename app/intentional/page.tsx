"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/utils/styles";
import { intentionScore } from "@/utils/intentional/score";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Kind = "action" | "thought" | "idea" | "reminder" | "note" | "habit" | "principle";

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
};

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
type State = { cards: Card[]; jobs: Job[]; areas: Area[]; today: string; minutesToday: number };
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
};
const KINDS = Object.keys(KIND_META) as Kind[];
const TIMER_KEY = "intentional.timer";

function greeting(h: number) {
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

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
  const [showTypes, setShowTypes] = useState(false);
  const [areasOpen, setAreasOpen] = useState(false);
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
  const habitsLeft = cards.filter((c) => c.kind === "habit" && c.last_done_on !== today);
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
    .filter((c) =>
      filter === "all" ? c.kind !== "principle" : filter === "prioritized" ? c.prioritized : c.kind === filter
    )
    .sort((x, y) => total(y) - total(x));
  const stats = [
    habitsLeft.length && `${habitsLeft.length} daily left`,
    state?.minutesToday && `${state.minutesToday} min intentional today`,
  ].filter(Boolean);
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

  const togglePriority = (card: Card) => {
    if (card.id.startsWith("tmp-")) return;
    patchLocal(card.id, { prioritized: !card.prioritized });
    run({ action: "update", id: card.id, fields: { prioritized: !card.prioritized } }).catch(() => {});
    setToast({ text: card.prioritized ? "Unprioritized" : "Prioritized ★" });
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
    setToast({ text: startedAt ? "Done — time logged" : "Done 🎉" });
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
    <main className="min-h-dvh max-w-xl mx-auto pb-32 text-stone-900" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-6 pb-3">
        <p className="text-sm text-stone-500">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </p>
        <h1 className="text-2xl font-semibold mt-1">{greeting(now.getHours())}.</h1>
        {stats.length > 0 && <p className="text-sm text-stone-600 mt-1">{stats.join(" · ")}</p>}
      </header>

      {mindset && (
        <button
          onClick={() => setMindsetIdx((i) => i + 1)}
          className="mx-5 mb-3 w-[calc(100%-2.5rem)] text-left rounded-2xl bg-indigo-600 text-white px-4 py-3 min-h-11"
        >
          <span className="text-xs uppercase tracking-wide text-indigo-200">Remember</span>
          <span className="block font-medium">{mindset.title}</span>
        </button>
      )}

      <nav className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur px-3 py-2 border-b border-stone-200 space-y-2">
        <ChipRow
          max={5}
          active={areaFilter}
          onSelect={setAreaFilter}
          items={[
            { id: "all", label: "All" },
            ...areaOrder.map((a) => ({
              id: a.id,
              label: `${a.emoji} ${a.name}${areaCounts.get(a.id) ? ` ${areaCounts.get(a.id)}` : ""}`,
            })),
          ]}
          extra={
            <>
              <Chip active={showTypes || filter !== "all"} onClick={() => setShowTypes((v) => !v)}>
                {filter === "all" ? "Type ▾" : filter === "prioritized" ? "★ Prioritized" : `${KIND_META[filter as Kind].emoji} ${KIND_META[filter as Kind].label}`}
              </Chip>
              <Chip active={false} onClick={() => setAreasOpen(true)}>⚙︎</Chip>
            </>
          }
        />
        {showTypes && (
          <ChipRow
            max={5}
            active={filter}
            onSelect={(f) => { setFilter(f); setShowTypes(false); }}
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

        {fresh.map((c) => (
          <CardRow key={c.id} card={c} today={today} isNew onOpen={setOpenId} onLeft={archive} onRight={togglePriority}
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
                  onOpen={setOpenId} onLeft={archive} onRight={togglePriority} onPlay={play}
                  {...(c.kind === "habit" ? { done: c.last_done_on === today, onCheck: () => complete(c) } : {})} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
          areas={areaOrder}
          defaultArea={activeArea?.id ?? null}
          onClose={() => setCaptureOpen(false)}
          onSubmit={async (text, single, areaId) => {
            const temp: Card = {
              id: `tmp-${Date.now()}`,
              kind: single ? "action" : "note",
              title: (text.split("\n")[0] || text).slice(0, 120),
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
            };
            setPending((p) => [temp, ...p]);
            setCaptureOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
            try {
              const res = await run({ action: "capture", text, single, area_id: areaId });
              const at = res.addedSince!;
              setSince((s) => (s && s < at ? s : at));
              // single cards: pick up the background AI sorting (transcripts poll their job)
              if (single) [4000, 10000].forEach((ms) => setTimeout(() => run().catch(() => {}), ms));
            } catch {
              /* toast shown */
            } finally {
              setPending((p) => p.filter((c) => c.id !== temp.id));
            }
          }}
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
  const playable = !done && !card.id.startsWith("tmp-") && ["action", "habit", "reminder"].includes(card.kind);
  const hasMeta = isNew || !!reason || !!area || card.kind !== "action" || !!card.due_date || !!card.est_minutes || important
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
        dx > 0 ? "bg-amber-500 justify-start" : "bg-rose-500 justify-end")}>
        {dx > 0 ? (card.prioritized ? "Unprioritize" : "★ Prioritize") : "Delete"}
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
            </div>
          )}
        </div>
        {!card.id.startsWith("tmp-") && (
          <div className="hidden pointer-fine:flex -my-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onRight(card); }}
              aria-label={card.prioritized ? "Unprioritize" : "Prioritize"}
              title={card.prioritized ? "Unprioritize" : "Prioritize"}
              className={cn("size-11 rounded-full hover:bg-stone-100", card.prioritized ? "text-amber-500" : "text-stone-400")}
            >
              ★
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
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [job.log.length]);
  const running = job.status === "processing";

  return (
    <div className="rounded-2xl bg-stone-900 text-stone-100 p-3 font-mono text-xs shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={cn("font-semibold", job.status === "failed" ? "text-rose-300" : "text-emerald-300")}>
          {running ? "Processing transcript…" : job.status === "failed" ? "Stopped" : "Complete"} · {job.progress}%
        </span>
        {!running && (
          <span className="flex items-center -my-3 -mr-2">
            {job.status === "failed" && (
              <button onClick={onRetry} className="min-h-11 px-3 font-semibold text-amber-300">Retry</button>
            )}
            <button onClick={onDismiss} aria-label="Dismiss" className="min-w-11 min-h-11 text-stone-400">✕</button>
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-stone-700 overflow-hidden mb-2">
        <div
          className={cn("h-full transition-all duration-500", job.status === "failed" ? "bg-rose-400" : "bg-emerald-400")}
          style={{ width: `${job.progress}%` }}
        />
      </div>
      <div ref={logRef} className="max-h-40 overflow-y-auto space-y-0.5 leading-relaxed">
        {job.log.map((line, i) => (
          <p key={i} className={cn("whitespace-pre-wrap break-words",
            line.startsWith("+") ? "text-emerald-300" : line.startsWith("↺") ? "text-amber-300"
              : line.startsWith("✗") ? "text-rose-300" : line.startsWith("✓") ? "text-emerald-200 font-semibold" : "text-stone-400")}>
            {line}
          </p>
        ))}
        {running && <p className="text-stone-500 animate-pulse">▌</p>}
      </div>
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

function CaptureSheet({ areas, defaultArea, onClose, onSubmit }: {
  areas: Area[];
  defaultArea: string | null;
  onClose: () => void;
  onSubmit: (text: string, single: boolean, areaId: string | null) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [areaId, setAreaId] = useState<string>(defaultArea ?? "auto");
  const [single, setSingle] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try { await onSubmit(text, single, areaId === "auto" ? null : areaId); } catch { /* toast shown */ } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="flex gap-1 rounded-full bg-stone-100 p-1 mb-3">
        {[{ v: true, l: "One card" }, { v: false, l: "Dump transcript" }].map((o) => (
          <button key={o.l} onClick={() => setSingle(o.v)}
            className={cn("flex-1 min-h-11 rounded-full text-sm font-medium", single === o.v ? "bg-white shadow" : "text-stone-600")}>
            {o.l}
          </button>
        ))}
      </div>
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
        rows={single ? 3 : 10}
        placeholder={single ? "Get Whitney to do her insurance…" : "Paste a voice memo transcript. It’ll be split into actions, ideas, thoughts, daily habits, and mindset reminders."}
        className="w-full rounded-2xl border border-stone-200 p-3 text-base outline-none focus:border-stone-400"
      />
      {areas.length > 0 && (
        <div className="mt-3">
          <Label>Intention</Label>
          <ChipRow
            active={areaId}
            onSelect={setAreaId}
            items={[{ id: "auto", label: "✨ Auto" }, ...areas.map((a) => ({ id: a.id, label: `${a.emoji} ${a.name}` }))]}
          />
        </div>
      )}
      <button
        disabled={busy || !text.trim()}
        onClick={submit}
        className="mt-3 w-full min-h-12 rounded-full bg-stone-900 text-white font-semibold disabled:opacity-40"
      >
        {busy ? "Making cards…" : single ? "Add card" : "Make cards"}
      </button>
    </Sheet>
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
