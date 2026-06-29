// Daily connection challenges for the shared bathroom dashboard.
//
// There's no good free API for couple-connection prompts, so this is authored
// content. It rotates by day-of-year so the same prompt shows all day and
// changes the next day. Edit freely — keep them small, kind, and doable.
export const CONNECTION_PROMPTS: string[] = [
  "Ask about the best part of their day before you talk about yours.",
  "Do one small chore they usually handle, no announcement needed.",
  "Send a text today saying one specific thing you appreciate about them.",
  "Put your phone away for the first 15 minutes you're together tonight.",
  "Make their coffee or tea exactly how they like it.",
  "Recall a favorite memory together and bring it up today.",
  "Give a 20-second hug — long enough to actually relax into it.",
  "Ask: what's something you're looking forward to this week?",
  "Plan a short walk together after dinner.",
  "Leave a sticky note somewhere they'll find it later.",
  "Ask how you can make their day 1% easier, then do it.",
  "Compliment something other than how they look.",
  "Take one thing off their to-do list without being asked.",
  "Share one thing you're grateful for about your relationship.",
  "Ask about a dream or goal they haven't mentioned in a while.",
  "Cook or grab their favorite snack as a surprise.",
  "Put on a song that reminds you of them and tell them why.",
  "Ask: is there anything on your mind I can help carry?",
  "Plan a no-screens evening together this week.",
  "Tell them about a moment they made you proud recently.",
  "Hold hands for no reason at all today.",
  "Ask what their younger self would think of them now.",
  "Do the dishes together and just talk while you do.",
  "Write down three things you love about them and read it aloud.",
  "Ask about something they're stressed about and just listen.",
  "Surprise them by handling tomorrow's first annoying task.",
  "Reminisce about your first date or first trip together.",
  "Ask: what's one way I can show up better for you?",
  "Make eye contact and say good morning before anything else.",
  "Plan one tiny adventure for this weekend, together.",
  "Tell them a quality of theirs you hope rubs off on you.",
  "Ask what they'd do with a free, responsibility-free day.",
];

export function challengeForDate(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - start.getTime()) / 86_400_000
  );
  return CONNECTION_PROMPTS[dayOfYear % CONNECTION_PROMPTS.length];
}
