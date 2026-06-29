// Daily family / parenting connection prompts for the shared bathroom dashboard.
//
// Same approach as connection-prompts: there's no good free API for these, so
// it's authored content that rotates by day-of-year. Edit freely — keep them
// small, warm, and doable in a normal day with kids around.
export const FAMILY_PROMPTS: string[] = [
  "At dinner, ask each kid the high and low of their day.",
  "Let a child pick the music for the next 10 minutes.",
  "Tell each kid one specific thing they did well today.",
  "Ask a kid to teach you something they learned recently.",
  "Do a 5-minute dance party before the morning rush.",
  "Read one extra page tonight, even if it's past bedtime.",
  "Ask: if you could plan our weekend, what would we do?",
  "Let a kid be in charge of one small decision today.",
  "Share a story about when you were their age.",
  "Build something together for 10 minutes — blocks, a fort, anything.",
  "Ask each child what made them laugh today.",
  "Put away your phone during the first 15 minutes after school.",
  "Give each kid a job that makes them feel like a big helper.",
  "Ask: what's something you're proud of yourself for?",
  "Have everyone name one thing they're grateful for at dinner.",
  "Draw or doodle together for a few minutes, no rules.",
  "Ask a kid about their favorite part of being in this family.",
  "Let them stay up 10 extra minutes to just talk.",
  "Cook or set the table together tonight.",
  "Ask: what's one thing you wish we did more often?",
  "Tell a kid a memory of the day they were born or came home.",
  "Play one round of their favorite game, their rules.",
  "Ask each child to describe their perfect day.",
  "Leave a little note in a backpack or lunchbox.",
  "Go outside together for five minutes and notice something new.",
  "Ask: who was kind to you today, and were you kind to anyone?",
  "Let a kid interview you with any three questions.",
  "Make a silly face contest part of brushing teeth tonight.",
  "Ask what superpower they'd want and why.",
  "Hug each kid and tell them you're glad they're yours.",
  "Plan one tiny family adventure for this weekend together.",
  "Ask each child to share one goal for the week.",
];

export function familyForDate(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return FAMILY_PROMPTS[dayOfYear % FAMILY_PROMPTS.length];
}
