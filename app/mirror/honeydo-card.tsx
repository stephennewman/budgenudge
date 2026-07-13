"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/styles";
import {
  Check,
  Loader2,
  Mic,
  Repeat,
  RotateCcw,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";

// HoneyDo — shared voice-to-task list on the mirror. Tap the mic, say the
// task(s), tap done; the server transcribes and structures them. The card
// polls /api/mirror/honeydo and owns all of its own state.

type Task = {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  recurrence: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  starred: boolean;
  kind: string;
  owner: string | null;
};

type TaskPatch = {
  title?: string;
  due_date?: string | null;
  starred?: boolean;
  kind?: string;
  owner?: string | null;
};

type HoneyDoList = { open: Task[]; done: Task[] };

const CACHE_KEY = "mirror.honeydo.cache";
const MAX_RECORD_MS = 60_000;

function dueLabel(iso: string): { text: string; tone: "overdue" | "today" | "soon" } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${iso}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: days === -1 ? "Yesterday" : `${-days}d overdue`, tone: "overdue" };
  if (days === 0) return { text: "Today", tone: "today" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  if (days < 7) {
    return {
      text: due.toLocaleDateString(undefined, { weekday: "short" }),
      tone: "soon",
    };
  }
  return {
    text: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tone: "soon",
  };
}

export function HoneyDoCard({ token }: { token: string | null }) {
  const [list, setList] = useState<HoneyDoList | null>(null);
  const [recording, setRecording] = useState(false);

  // Recording doesn't work in browser fullscreen (the mic permission prompt
  // gets suppressed), so hide the whole voice-capture row there.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => {
      const d = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement ?? d.webkitFullscreenElement));
    };
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // The card remounts whenever its channel rotates back in, so paint the last
  // known list from localStorage immediately instead of waiting on the fetch.
  const updateList = useCallback((next: HoneyDoList) => {
    setList(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setList((prev) => prev ?? (JSON.parse(cached) as HoneyDoList));
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";

  // Load + poll the list every minute.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/mirror/honeydo${suffix}`);
        if (!res.ok) return;
        const json = (await res.json()) as HoneyDoList;
        if (active) updateList(json);
      } catch {
        /* keep last known list */
      }
    };
    load();
    const id = setInterval(load, 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [suffix, updateList]);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setProcessing(true);
      setError(null);
      try {
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const form = new FormData();
        form.append("audio", new File([blob], `honeydo.${ext}`, { type: blob.type }));
        const res = await fetch(`/api/mirror/honeydo${suffix}`, {
          method: "POST",
          body: form,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Something went wrong");
          return;
        }
        updateList({ open: json.open, done: json.done });
        setFlash(
          json.added === 1 ? "Added 1 task" : `Added ${json.added} tasks`
        );
        setTimeout(() => setFlash(null), 4000);
      } catch {
        setError("Upload failed — try again");
      } finally {
        setProcessing(false);
      }
    },
    [suffix, updateList]
  );

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Safari (the iPad mirror) records mp4; Chrome records webm. Whisper
      // accepts both.
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        if (blob.size > 0) uploadRecording(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      // Safety stop so a forgotten recording doesn't run forever.
      stopTimerRef.current = setTimeout(stopRecording, MAX_RECORD_MS);
    } catch {
      setError("Microphone unavailable — check permissions");
    }
  }, [uploadRecording, stopRecording]);

  const act = useCallback(
    async (action: "complete" | "reopen" | "delete", id: string) => {
      try {
        const res = await fetch(`/api/mirror/honeydo${suffix}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, id }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as HoneyDoList;
        updateList(json);
      } catch {
        /* ignore */
      }
    },
    [suffix, updateList]
  );

  // Task being edited in the slide-out sheet.
  const [editing, setEditing] = useState<Task | null>(null);

  const saveTask = useCallback(
    async (id: string, fields: TaskPatch) => {
      try {
        const res = await fetch(`/api/mirror/honeydo${suffix}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", id, fields }),
        });
        if (!res.ok) return false;
        updateList((await res.json()) as HoneyDoList);
        return true;
      } catch {
        return false;
      }
    },
    [suffix, updateList]
  );

  const open = list?.open ?? [];
  const done = list?.done ?? [];

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/15 p-6 backdrop-blur-md">
      {/* No card title — the section header above the card already shows it. */}

      {/* Task list */}
      <div className="flex-1 space-y-1.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* First load with no cached copy yet: skeleton rows instead of a
            blank card. Once data arrives, an empty list says so explicitly. */}
        {list === null &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-start gap-3 rounded-xl bg-white/5 px-3 py-2"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-white/15" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <div
                  className="h-3 rounded bg-white/15"
                  style={{ width: `${70 - i * 15}%` }}
                />
                <div className="h-2 w-1/4 rounded bg-white/10" />
              </div>
            </div>
          ))}

        {list !== null && open.length === 0 && done.length === 0 && (
          <p className="pt-4 text-center text-sm text-white/45">
            Nothing on the list — enjoy it while it lasts.
          </p>
        )}

        {open.map((t) => {
          const due = t.due_date ? dueLabel(t.due_date) : null;
          return (
            <div
              key={t.id}
              className="group flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition hover:bg-white/10"
            >
              <button
                onClick={() => act("complete", t.id)}
                aria-label={`Mark "${t.title}" done`}
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white/35 text-transparent transition hover:border-emerald-300 hover:text-emerald-300"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
              <button
                onClick={() => setEditing(t)}
                className="min-w-0 flex-1 text-left"
                aria-label={`Edit "${t.title}"`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {t.starred && (
                    <Star className="h-3.5 w-3.5 shrink-0 self-center fill-amber-300 text-amber-300" />
                  )}
                  <span className="text-sm font-medium text-white/90">{t.title}</span>
                  {t.kind === "project" && (
                    <span className="rounded-full bg-violet-400/20 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                      Project
                    </span>
                  )}
                  {t.owner && (
                    <span className="text-[11px] text-white/45">{t.owner}</span>
                  )}
                  {due && (
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        due.tone === "overdue"
                          ? "text-red-300"
                          : due.tone === "today"
                            ? "text-amber-200"
                            : "text-white/50"
                      )}
                    >
                      {due.text}
                    </span>
                  )}
                  {t.recurrence && (
                    <span className="flex items-center gap-1 text-[11px] text-sky-200/80">
                      <Repeat className="h-3 w-3" />
                      {t.recurrence}
                    </span>
                  )}
                </div>
                {t.details && (
                  <p className="mt-0.5 truncate text-xs text-white/50">{t.details}</p>
                )}
              </button>
              <button
                onClick={() => act("delete", t.id)}
                aria-label={`Delete "${t.title}"`}
                className="mt-0.5 shrink-0 text-white/25 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {done.length > 0 && (
          <>
            <div className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Done this week
            </div>
            {done.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl px-3 py-1.5 opacity-60"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/30 text-emerald-200">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white/70 line-through">
                  {t.title}
                </span>
                <button
                  onClick={() => act("reopen", t.id)}
                  aria-label={`Reopen "${t.title}"`}
                  className="shrink-0 text-white/30 transition hover:text-white/70"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Voice capture — anchored bottom right; hidden in fullscreen. */}
      {!isFullscreen && (
      <div className="mt-3 flex items-center justify-end gap-3">
        <div className="min-w-0 text-right text-sm leading-snug">
          {recording ? (
            <span className="font-medium text-red-200">
              Listening… tap to finish
            </span>
          ) : processing ? (
            <span className="text-white/60">Transcribing & organizing…</span>
          ) : error ? (
            <span className="text-red-300">{error}</span>
          ) : flash ? (
            <span className="font-medium text-emerald-200">{flash}</span>
          ) : (
            <span className="text-white/60">
              Tap the mic and say what needs doing
            </span>
          )}
        </div>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={processing}
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition",
            recording
              ? "animate-pulse bg-red-500/90 text-white"
              : processing
                ? "cursor-wait bg-white/15 text-white/50"
                : "bg-amber-400/90 text-slate-900 hover:bg-amber-300"
          )}
          aria-label={recording ? "Stop and save" : "Record a task"}
        >
          {processing ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : recording ? (
            <Square className="h-7 w-7" fill="currentColor" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </button>
      </div>
      )}

      {editing &&
        createPortal(
          <EditSheet
            task={editing}
            onClose={() => setEditing(null)}
            onSave={async (fields) => {
              const ok = await saveTask(editing.id, fields);
              if (ok) setEditing(null);
              return ok;
            }}
            onDelete={async () => {
              await act("delete", editing.id);
              setEditing(null);
            }}
          />,
          document.body
        )}
    </div>
  );
}

// Slide-out editor for one task: title, priority star, task/project tag,
// owner, and due date.
function EditSheet({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onSave: (fields: TaskPatch) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [starred, setStarred] = useState(task.starred);
  const [kind, setKind] = useState(task.kind === "project" ? "project" : "task");
  const [owner, setOwner] = useState<string | null>(task.owner);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave({
      title: title.trim() || task.title,
      starred,
      kind,
      owner,
      due_date: dueDate || null,
    });
    setSaving(false);
    if (!ok) setFailed(true);
  };

  const choice = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium transition",
      active ? "bg-white/25 text-white" : "bg-white/8 text-white/50 hover:text-white/80"
    );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-white/15 bg-slate-900/95 p-6 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Edit task
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Task
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-base text-white outline-none placeholder:text-white/30 focus:border-amber-300/60"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Priority
          </span>
          <button onClick={() => setStarred((s) => !s)} className={choice(starred)}>
            <span className="flex items-center gap-1.5">
              <Star
                className={cn("h-4 w-4", starred && "fill-amber-300 text-amber-300")}
              />
              {starred ? "Starred" : "Star it"}
            </span>
          </button>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Type
          </span>
          <div className="flex gap-2">
            <button onClick={() => setKind("task")} className={choice(kind === "task")}>
              Task
            </button>
            <button
              onClick={() => setKind("project")}
              className={choice(kind === "project")}
            >
              Project
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Owner
          </span>
          <div className="flex gap-2">
            <button onClick={() => setOwner(null)} className={choice(owner === null)}>
              Shared
            </button>
            <button
              onClick={() => setOwner("Stephen")}
              className={choice(owner === "Stephen")}
            >
              Stephen
            </button>
            <button
              onClick={() => setOwner("Whitney")}
              className={choice(owner === "Whitney")}
            >
              Whitney
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
            Due date
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-base text-white outline-none [color-scheme:dark] focus:border-amber-300/60"
            />
            {dueDate && (
              <button
                onClick={() => setDueDate("")}
                className="text-xs text-white/50 underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </label>

        <div className="mt-auto space-y-3">
          {failed && (
            <p className="text-sm text-red-300">Couldn&apos;t save — try again.</p>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-amber-400/90 py-3 text-base font-semibold text-slate-900 transition hover:bg-amber-300 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/8 py-2.5 text-sm text-red-300/90 transition hover:bg-red-500/15"
          >
            <Trash2 className="h-4 w-4" />
            Delete task
          </button>
        </div>
      </div>
    </div>
  );
}
