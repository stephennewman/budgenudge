"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Delete, Flame, Lock, RefreshCw, X } from "lucide-react";
import { cn } from "@/utils/styles";

// "Extra Fun" — passcode-gated couples challenge generator.
//
// Flow: passcode → (pending check-in from a prior day?) → generate button →
// playful loading sequence → challenge card with accept / decline / regen.
// The passcode is kept only in component state, so it must be re-entered on
// every visit — by design, since the mirror lives on a shared iPad.

type Challenge = { id: string; text: string };

type FunState = {
  person: "stephen" | "whitney";
  checkIn: (Challenge & { date: string }) | null;
  offered: Challenge | null;
  acceptedToday: Challenge | null;
  regensLeft: number;
};

const LOADING_LINES = [
  "Warming things up…",
  "Consulting the naughty archives…",
  "Checking the kids are asleep…",
  "Dimming the lights…",
  "Measuring your comfort zone… and stepping past it…",
  "Untying something…",
  "Whispering to the algorithm…",
  "Locking the bedroom door…",
  "Finding just the right amount of trouble…",
  "Almost there… don't finish without it…",
];

// Split the stored "title|||body" format.
function splitChallenge(text: string): { title: string | null; body: string } {
  const i = text.indexOf("|||");
  if (i === -1) return { title: null, body: text };
  return { title: text.slice(0, i), body: text.slice(i + 3) };
}

async function callApi(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  status: number;
  data: FunState | { error: string };
}> {
  const res = await fetch("/api/mirror/extra-fun", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export default function ExtraFunPage() {
  const [passcode, setPasscode] = useState("");
  const [entered, setEntered] = useState(""); // digits typed so far
  const [shake, setShake] = useState(false);
  const [state, setState] = useState<FunState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate through the loading lines while generating.
  useEffect(() => {
    if (loading) {
      setLoadingLine(0);
      loadingTimer.current = setInterval(() => {
        setLoadingLine((l) => Math.min(l + 1, LOADING_LINES.length - 1));
      }, 1400);
    } else if (loadingTimer.current) {
      clearInterval(loadingTimer.current);
      loadingTimer.current = null;
    }
    return () => {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
    };
  }, [loading]);

  const tryUnlock = async (code: string) => {
    setBusy(true);
    setError(null);
    const { ok, status, data } = await callApi({ action: "unlock", passcode: code });
    setBusy(false);
    if (!ok) {
      setEntered("");
      if (status === 401) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        setError((data as { error: string }).error ?? "Something went wrong");
      }
      return;
    }
    setPasscode(code);
    setState(data as FunState);
  };

  const pressDigit = (d: string) => {
    if (busy) return;
    const next = entered + d;
    setEntered(next);
    if (next.length === 4) void tryUnlock(next);
  };

  const act = async (payload: Record<string, unknown>, withLoading = false) => {
    setBusy(true);
    setError(null);
    if (withLoading) setLoading(true);
    const { ok, data } = await callApi({ ...payload, passcode });
    setBusy(false);
    setLoading(false);
    if (!ok) {
      setError((data as { error: string }).error ?? "Something went wrong");
      return;
    }
    setState(data as FunState);
  };

  return (
    <div
      className="min-h-screen w-full text-white antialiased"
      style={{
        background: "linear-gradient(160deg, #1a0511 0%, #3d0a2e 55%, #6b1039 100%)",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-lg flex-col p-4 md:p-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Flame className="h-6 w-6 text-rose-300" />
            <h1 className="text-2xl font-light tracking-tight md:text-3xl">Extra Fun</h1>
          </div>
          <Link
            href="/mirror"
            className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Mirror
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center pb-16">
          {!state ? (
            <PasscodePad
              entered={entered}
              shake={shake}
              busy={busy}
              onDigit={pressDigit}
              onDelete={() => setEntered((e) => e.slice(0, -1))}
            />
          ) : loading ? (
            <LoadingCard line={LOADING_LINES[loadingLine]} />
          ) : state.checkIn ? (
            <CheckInCard
              challenge={state.checkIn}
              busy={busy}
              onAnswer={(completed) =>
                act({ action: "complete", id: state.checkIn!.id, completed })
              }
            />
          ) : state.offered ? (
            <OfferCard
              challenge={state.offered}
              regensLeft={state.regensLeft}
              busy={busy}
              onAccept={() =>
                act({ action: "respond", id: state.offered!.id, response: "accepted" })
              }
              onDecline={() =>
                act({ action: "respond", id: state.offered!.id, response: "declined" })
              }
              onRegenerate={() => act({ action: "generate" }, true)}
            />
          ) : state.acceptedToday ? (
            <AcceptedCard challenge={state.acceptedToday} />
          ) : (
            <GenerateCard
              person={state.person}
              regensLeft={state.regensLeft}
              busy={busy}
              onGenerate={() => act({ action: "generate" }, true)}
            />
          )}

          {error && (
            <p className="mt-4 rounded-full bg-rose-500/25 px-4 py-1.5 text-sm text-rose-100">
              {error}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

function PasscodePad({
  entered,
  shake,
  busy,
  onDigit,
  onDelete,
}: {
  entered: string;
  shake: boolean;
  busy: boolean;
  onDigit: (d: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <Lock className="mb-4 h-8 w-8 text-white/50" />
      <p className="mb-6 text-sm text-white/60">Enter your passcode</p>
      <div className={cn("mb-8 flex gap-4", shake && "animate-[shake_0.4s_ease-in-out]")}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border border-white/40 transition",
              entered.length > i && "border-rose-300 bg-rose-300"
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <DigitButton key={d} label={d} onClick={() => onDigit(d)} disabled={busy} />
        ))}
        <span />
        <DigitButton label="0" onClick={() => onDigit("0")} disabled={busy} />
        <button
          onClick={onDelete}
          disabled={busy}
          aria-label="Delete"
          className="flex h-16 w-16 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 disabled:opacity-40"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

function DigitButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-16 w-16 rounded-full border border-white/15 bg-white/10 text-xl font-light backdrop-blur-md transition hover:bg-white/20 active:bg-white/30 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function LoadingCard({ line }: { line: string }) {
  return (
    <div className="flex w-full flex-col items-center rounded-3xl border border-white/10 bg-white/10 p-10 text-center backdrop-blur-md">
      <Flame className="mb-5 h-10 w-10 animate-pulse text-rose-300" />
      <p className="text-lg font-light text-white/90">{line}</p>
      <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-rose-400/80" />
      </div>
      <style jsx global>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

function ChallengeText({ text }: { text: string }) {
  const { title, body } = splitChallenge(text);
  return (
    <>
      {title && (
        <h2 className="mb-3 text-xl font-semibold tracking-tight text-rose-200">{title}</h2>
      )}
      <p className="text-lg font-light leading-relaxed text-white/95">{body}</p>
    </>
  );
}

function GenerateCard({
  person,
  regensLeft,
  busy,
  onGenerate,
}: {
  person: "stephen" | "whitney";
  regensLeft: number;
  busy: boolean;
  onGenerate: () => void;
}) {
  const name = person === "stephen" ? "Stephen" : "Whitney";
  return (
    <div className="flex w-full flex-col items-center rounded-3xl border border-white/10 bg-white/10 p-10 text-center backdrop-blur-md">
      <p className="mb-1 text-sm uppercase tracking-wider text-white/50">Hey {name}</p>
      <p className="mb-8 text-lg font-light text-white/85">Feeling brave today?</p>
      {regensLeft > 0 ? (
        <button
          onClick={onGenerate}
          disabled={busy}
          className="rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-8 py-4 text-base font-semibold shadow-lg shadow-rose-900/50 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          Generate new sexy challenge
        </button>
      ) : (
        <p className="text-sm text-white/60">
          You&apos;re out of challenges for today. Come back tomorrow…
        </p>
      )}
    </div>
  );
}

function OfferCard({
  challenge,
  regensLeft,
  busy,
  onAccept,
  onDecline,
  onRegenerate,
}: {
  challenge: Challenge;
  regensLeft: number;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="w-full rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-md">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/50">
        Your challenge
      </p>
      <ChallengeText text={challenge.text} />
      <div className="mt-8 flex flex-col gap-3">
        <button
          onClick={onAccept}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3.5 text-base font-semibold shadow-lg shadow-rose-900/50 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
          Accept challenge
        </button>
        <div className="flex gap-3">
          <button
            onClick={onDecline}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/20 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Decline
          </button>
          <button
            onClick={onRegenerate}
            disabled={busy || regensLeft <= 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/20 disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
            {regensLeft > 0 ? `Regenerate (${regensLeft} left)` : "No regens left"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptedCard({ challenge }: { challenge: Challenge }) {
  return (
    <div className="w-full rounded-3xl border border-rose-300/25 bg-white/10 p-8 backdrop-blur-md">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-rose-200">
        Challenge accepted — good luck
      </p>
      <ChallengeText text={challenge.text} />
      <p className="mt-6 text-sm text-white/55">
        You&apos;ll check in on this next time. Make it count.
      </p>
    </div>
  );
}

function CheckInCard({
  challenge,
  busy,
  onAnswer,
}: {
  challenge: Challenge & { date: string };
  busy: boolean;
  onAnswer: (completed: boolean) => void;
}) {
  return (
    <div className="w-full rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-md">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/50">
        First things first… did you complete your last challenge?
      </p>
      <ChallengeText text={challenge.text} />
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => onAnswer(true)}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3.5 text-base font-semibold shadow-lg shadow-emerald-900/40 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <Check className="h-5 w-5" />
          Yes I did
        </button>
        <button
          onClick={() => onAnswer(false)}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3.5 text-base font-medium text-white/75 transition hover:bg-white/20 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
          Not this time
        </button>
      </div>
    </div>
  );
}
