// Daily parenting content for the Family channel.
//
// Authored, rotating content. family-prompts.ts holds the daily family activity;
// this file adds a practical parenting tip. Edit freely — keep them warm and
// realistic for everyday family life.

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export const PARENTING_TIPS: string[] = [
  "Connect before you correct — a calm kid listens better than a scared one.",
  "Narrate what you see: 'You worked hard on that' beats 'good job.'",
  "Give choices within limits: 'red cup or blue cup?' lowers power struggles.",
  "Get down to their eye level when something matters.",
  "Catch them being good and say it out loud.",
  "Name big feelings: 'You're really frustrated.' Naming calms the storm.",
  "Routines beat reminders — kids feel safe when they know what's next.",
  "Repair after you lose your cool. Apologizing teaches them to do the same.",
  "Let them struggle a little; rescued kids miss the win of figuring it out.",
  "Read together, even for 10 minutes. It builds brains and closeness.",
  "Special time: 10 minutes of their choice, fully present, no phone.",
  "Praise effort and strategy, not just the outcome.",
  "Say 'when/then' instead of 'if': 'When shoes are on, then we go.'",
  "Model the behavior you want — they copy more than they obey.",
  "Keep limits kind and firm: warm tone, clear boundary.",
  "Ask 'what do you think we should do?' to build problem-solvers.",
  "Protect sleep. Most behavior battles get harder when kids are tired.",
  "Whisper instead of yell — it gets attention and lowers the temperature.",
  "Let natural consequences teach when it's safe to.",
  "Replace 'don't run' with 'walking feet, please' — tell them what TO do.",
  "Hug first thing in the morning; start the day connected.",
  "Make screen rules clear and consistent ahead of time, not in the moment.",
  "Notice the kid who isn't acting out — connection prevents attention-seeking.",
  "Teach by doing chores together before expecting them solo.",
  "Validate first, then redirect: 'I know you want it. We're not buying today.'",
  "Give a 5-minute warning before transitions.",
  "Let them help cook — kids eat better when they've had a hand in it.",
  "End the day with 'high, low, and one kind thing you did.'",
  "Stay curious about the behavior — it's usually a need in disguise.",
  "Be the calm you want them to find. Your steadiness is contagious.",
];

export function parentingTipForDate(date = new Date()): string {
  return PARENTING_TIPS[dayOfYear(date) % PARENTING_TIPS.length];
}
