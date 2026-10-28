const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Best-effort due date from plain words ("tomorrow", "on Friday", "next Tuesday"). `today` is YYYY-MM-DD. */
export function guessDueDate(text: string, today: string): string | null {
  const t = text.toLowerCase();
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);

  const m = t.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (!m) return null;
  const idx = WEEKDAYS.indexOf(m[2]);
  const todayIdx = new Date(`${today}T12:00:00`).getDay();
  let diff = (idx - todayIdx + 7) % 7;
  if (m[1] && diff === 0) diff = 7;
  return addDays(today, diff);
}
