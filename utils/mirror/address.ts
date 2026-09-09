// Name the reader at the start of a card so it can't be mistaken for
// someone else's prompt — especially when the channel is cycling.

export type CardAudience = "stephen" | "whitney" | "both";

const OPENER: Record<CardAudience, string> = {
  stephen: "Stephen, ",
  whitney: "Whitney, ",
  both: "Stephen & Whitney, ",
};

const ALREADY = /^(Stephen & Whitney,|Stephen,|Whitney,)/i;

export function addressAs(audience: CardAudience, text: string): string {
  const trimmed = text.trim();
  if (!trimmed || ALREADY.test(trimmed)) return trimmed;
  return `${OPENER[audience]}${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

export function addressAll(audience: CardAudience, pool: string[]): string[] {
  return pool.map((text) => addressAs(audience, text));
}
