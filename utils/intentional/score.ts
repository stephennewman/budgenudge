import { guessDueDate } from "./dates";

export type ScorableCard = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  est_minutes: number | null;
  stars: number;
  prioritized: boolean;
  due_date: string | null;
  last_done_on: string | null;
};

export type ScorableArea = {
  name: string;
  focus: string;
  weekly_minutes: number | null;
  minutes_week: number;
};

const MORNING = /\b(exercise|workout|gym|run|walk|bible|pray|prayer|devotion|breath|breathing|meditat\w*|stretch|journal)\b/;
const EVENING = /\b(kids?|whitney|wife|family|dinner|read|book|wind down|date night)\b/;
const WEEKEND = /\b(garage|yard|lawn|clean|organi[sz]e|car|house|fix|repair|errand)\b/;
const WORK = /\b(email|call|meeting|client|proposal|invoice|review|deck|follow up|send)\b/;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
}

// Stable per-hour wobble so ties rotate between opens without reshuffling while the app is open.
function wobble(id: string, seed: string): number {
  let h = 0;
  for (const ch of id + seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((h >>> 0) % 600) / 100;
}

/** Higher = more worth your attention right now. Returns the strongest reason for display. */
export function intentionScore(
  card: ScorableCard,
  now: Date,
  today: string,
  area?: ScorableArea | null
): { score: number; reason: string | null } {
  const hour = now.getHours();
  const day = now.getDay();
  const weekend = day === 0 || day === 6;
  const workHours = !weekend && hour >= 9 && hour < 17;
  const text = `${card.title} ${card.body ?? ""}`.toLowerCase();
  const reasons: [number, string][] = [];
  let score = wobble(card.id, `${today}-${hour}`);

  const add = (pts: number, why?: string) => {
    score += pts;
    if (why) reasons.push([pts, why]);
  };

  if (card.kind === "habit") {
    if (card.last_done_on === today) return { score: -1000, reason: null };
    add(25);
    if (hour < 12 && MORNING.test(text)) add(25, "Good morning fit");
    else if (hour >= 17 && EVENING.test(text)) add(25, "Good evening fit");
    else if (hour >= 20) add(15, "Still open today");
  }

  if (card.prioritized) add(35);
  add((card.stars - 3) * 12, card.stars >= 5 ? "Critical" : undefined);

  const due = card.due_date ?? guessDueDate(card.title, today);
  if (due) {
    const d = daysBetween(today, due);
    if (d < 0) add(55, "Overdue");
    else if (d === 0) add(50, "Due today");
    else if (d === 1) add(hour >= 15 ? 30 : 18, "Tomorrow — prep now");
    else if (d <= 6) add(-6 * d);
    else add(-35);
  }

  if (card.kind === "thought" || card.kind === "idea" || card.kind === "note") add(-15);
  if (card.kind === "reminder") add(5);

  const mins = card.est_minutes;
  if (mins && mins <= 15) add(workHours ? 10 : 5, workHours ? "Quick win" : undefined);
  if (mins && mins >= 60) add(weekend ? 12 : workHours ? -10 : 0, weekend ? "Weekend-sized" : undefined);
  if (weekend && WEEKEND.test(text)) add(15, "Weekend project");
  if (workHours && WORK.test(text)) add(10, "Work hours");
  if (!workHours && !weekend && WORK.test(text)) add(-8);

  if (area) {
    if (area.focus === "work") add(workHours ? 12 : weekend ? -20 : -10, workHours ? "Work hours" : undefined);
    if (area.focus === "personal") {
      const personalTime = weekend || hour >= 17;
      add(personalTime ? 12 : workHours ? -8 : 0, personalTime ? `${area.name} time` : undefined);
    }
    if (area.weekly_minutes) {
      const weekFraction = (((day + 6) % 7) + hour / 24) / 7;
      const deficit = area.weekly_minutes * weekFraction - area.minutes_week;
      if (deficit > 0) {
        const pts = Math.min(20, (deficit / area.weekly_minutes) * 40);
        add(pts, `${area.name} needs time this week`);
      }
    }
  }

  reasons.sort((a, b) => b[0] - a[0]);
  return { score, reason: reasons[0] && reasons[0][0] >= 10 ? reasons[0][1] : null };
}
