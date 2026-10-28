"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/utils/styles";

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
};

type State = { cards: Card[]; today: string; minutesToday: number };
type Tab = "today" | "board" | "all" | "mindset";
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

async function api(body?: object): Promise<State & { added?: number; error?: string }> {
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
  const [tab, setTab] = useState<Tab>("today");
  const [kindFilter, setKindFilter] = useState<Kind | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [captureOpen, setCaptureOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [mindsetIdx, setMindsetIdx] = useState(0);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const cards = useMemo(() => state?.cards ?? [], [state]);
  const today = state?.today ?? now.toISOString().slice(0, 10);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const principles = cards.filter((c) => c.kind === "principle");
  const habits = cards.filter((c) => c.kind === "habit");
  const habitsLeft = habits.filter((c) => c.last_done_on !== today);
  const tasks = cards.filter((c) => c.kind !== "habit" && c.kind !== "principle");
  const upNext = tasks.filter(
    (c) => c.prioritized || c.stars >= 5 || (c.due_date && c.due_date <= addDays(today, 1))
  );
  const board = tasks.filter((c) => c.prioritized);
  const allList = (kindFilter ? cards.filter((c) => c.kind === kindFilter) : cards).filter(
    (c) => c.kind !== "principle" || kindFilter === "principle"
  );
  const mindset = principles.length ? principles[mindsetIdx % principles.length] : null;

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
    patchLocal(card.id, null);
    run({ action: "archive", id: card.id }).catch(() => {});
    setToast({ text: `Deleted “${card.title}”`, undo: () => run({ action: "restore", id: card.id }).catch(() => {}) });
  };

  const togglePriority = (card: Card) => {
    patchLocal(card.id, { prioritized: !card.prioritized });
    run({ action: "update", id: card.id, fields: { prioritized: !card.prioritized } }).catch(() => {});
    setToast({ text: card.prioritized ? "Removed from board" : "Added to your board ⭐" });
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
        <p className="text-sm text-stone-600 mt-1">
          {habitsLeft.length} daily left · {upNext.length} up next · {state?.minutesToday ?? 0} min intentional today
        </p>
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

      <nav className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur px-3 py-2 flex gap-1 border-b border-stone-200">
        {(["today", "board", "all", "mindset"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 min-h-11 rounded-full text-sm font-medium capitalize",
              tab === t ? "bg-stone-900 text-white" : "text-stone-600"
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      <section className="px-3 pt-3 space-y-2">
        {!state && <p className="text-center text-stone-500 py-10">Loading…</p>}

        {state && tab === "today" && (
          <>
            {habits.length > 0 && <SectionTitle>Daily</SectionTitle>}
            {[...habitsLeft, ...habits.filter((h) => h.last_done_on === today)].map((c) => (
              <CardRow key={c.id} card={c} today={today} onOpen={setOpenId} onLeft={archive} onRight={togglePriority}
                done={c.last_done_on === today} onCheck={() => complete(c)} />
            ))}
            <SectionTitle>Up next</SectionTitle>
            {upNext.length === 0 && (
              <Empty>Nothing pressing. Swipe right on cards in “All” to put them on your board.</Empty>
            )}
            {upNext.map((c) => (
              <CardRow key={c.id} card={c} today={today} onOpen={setOpenId} onLeft={archive} onRight={togglePriority} />
            ))}
          </>
        )}

        {state && tab === "board" && (
          <>
            {board.length === 0 && <Empty>Swipe right on a card to add it to your board.</Empty>}
            {board.map((c) => (
              <CardRow key={c.id} card={c} today={today} onOpen={setOpenId} onLeft={archive} onRight={togglePriority} />
            ))}
          </>
        )}

        {state && tab === "all" && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3">
              <Chip active={!kindFilter} onClick={() => setKindFilter(null)}>All</Chip>
              {KINDS.map((k) => (
                <Chip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
                  {KIND_META[k].emoji} {KIND_META[k].label}
                </Chip>
              ))}
            </div>
            {allList.length === 0 && <Empty>No cards yet. Tap + to dump a transcript.</Empty>}
            {allList.map((c) => (
              <CardRow key={c.id} card={c} today={today} onOpen={setOpenId} onLeft={archive} onRight={togglePriority} />
            ))}
          </>
        )}

        {state && tab === "mindset" && (
          <>
            {principles.length === 0 && <Empty>Add reminders like “Lead without permission” or “Be concise.”</Empty>}
            {principles.map((c) => (
              <CardRow key={c.id} card={c} today={today} onOpen={setOpenId} onLeft={archive} onRight={togglePriority} />
            ))}
          </>
        )}
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
          onSubmit={async (text, single) => {
            const res = await run({ action: "capture", text, single });
            setCaptureOpen(false);
            setToast({ text: `Added ${res.added} card${res.added === 1 ? "" : "s"}` });
          }}
        />
      )}

      {openCard && (
        <CardSheet
          card={openCard}
          today={today}
          related={openCard.related_ids.map((id) => byId.get(id)).filter((c): c is Card => !!c)}
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{children}</h2>;
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

function CardRow({
  card, today, onOpen, onLeft, onRight, done, onCheck,
}: {
  card: Card;
  today: string;
  onOpen: (id: string) => void;
  onLeft: (c: Card) => void;
  onRight: (c: Card) => void;
  done?: boolean;
  onCheck?: () => void;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const moved = useRef(false);
  const meta = KIND_META[card.kind];

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
        className={cn("relative bg-white border border-stone-200 rounded-2xl px-4 py-3 flex items-start gap-3 select-none",
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
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
            <span className={cn("rounded-full px-2 py-0.5", meta.tone)}>{meta.label}</span>
            {card.kind !== "principle" && <Stars value={card.stars} size="text-xs" />}
            {card.est_minutes && <span>~{card.est_minutes} min</span>}
            {card.due_date && (
              <span className={card.due_date < today ? "text-rose-600 font-medium" : ""}>
                {dueLabel(card.due_date, today)}
              </span>
            )}
            {card.related_ids.length > 0 && <span>🔗 {card.related_ids.length}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200" />
        {children}
      </div>
    </div>
  );
}

function CaptureSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (text: string, single: boolean) => Promise<void> }) {
  const [text, setText] = useState("");
  const [single, setSingle] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Sheet onClose={onClose}>
      <div className="flex gap-1 rounded-full bg-stone-100 p-1 mb-3">
        {[{ v: false, l: "Dump transcript" }, { v: true, l: "One card" }].map((o) => (
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
        rows={single ? 3 : 10}
        placeholder={single ? "Get Whitney to do her insurance…" : "Paste a voice memo transcript. It’ll be split into actions, ideas, thoughts, daily habits, and mindset reminders."}
        className="w-full rounded-2xl border border-stone-200 p-3 text-base outline-none focus:border-stone-400"
      />
      <button
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          try { await onSubmit(text, single); } catch { /* toast shown */ } finally { setBusy(false); }
        }}
        className="mt-3 w-full min-h-12 rounded-full bg-stone-900 text-white font-semibold disabled:opacity-40"
      >
        {busy ? "Making cards…" : single ? "Add card" : "Make cards"}
      </button>
    </Sheet>
  );
}

function CardSheet({
  card, today, related, onClose, onOpenRelated, onSave, onStart, onDone, onDelete,
}: {
  card: Card;
  today: string;
  related: Card[];
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
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
        {KINDS.map((k) => (
          <Chip key={k} active={card.kind === k} onClick={() => onSave({ kind: k })}>
            {KIND_META[k].emoji} {KIND_META[k].label}
          </Chip>
        ))}
      </div>

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
