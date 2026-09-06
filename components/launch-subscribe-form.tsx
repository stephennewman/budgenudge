"use client";

import { useState, type FormEvent } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function LaunchSubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "loading" });

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/launches/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        sent?: number;
        alreadySubscribed?: boolean;
        queued?: boolean;
      };

      if (!response.ok) {
        setStatus({ kind: "error", message: payload.error ?? "Could not subscribe" });
        return;
      }

      if (payload.alreadySubscribed) {
        setStatus({
          kind: "success",
          message: "You're already on the list. New launches will be emailed when a time is posted.",
        });
        return;
      }

      if (payload.queued) {
        setStatus({
          kind: "success",
          message: "You're on the list. Invites go out from production when a launch has a date and time.",
        });
        return;
      }

      const sent = payload.sent ?? 0;
      setStatus({
        kind: "success",
        message:
          sent > 0
            ? "Check your inbox and accept the invites to add them to your calendar. New launches will be emailed the same way."
            : "You're on the list. We'll email you when the next Florida launch gets a date and time.",
      });
    } catch {
      setStatus({ kind: "error", message: "Could not subscribe. Try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="launch-email" className="text-sm font-medium text-slate-200">
        Email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="launch-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@email.com"
          className="min-h-11 flex-1 rounded-lg bg-slate-900 px-3 text-sm text-slate-100 ring-1 ring-slate-700 outline-none placeholder:text-slate-500 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {status.kind === "loading" ? "Sending…" : "Add to my calendar"}
        </button>
      </div>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <p className="text-xs leading-relaxed text-slate-500">
        Upcoming Florida launches are emailed as calendar invites. Anything that later gets a
        date and time is emailed too.
      </p>
      {status.kind === "success" && (
        <p className="text-sm text-emerald-300" role="status">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-sm text-rose-300" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
