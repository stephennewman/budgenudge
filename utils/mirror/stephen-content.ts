// Daily content for the "For Stephen" channel.
//
// Authored, rotating prompts for a 42-year-old husband and father of three
// girls. GROWTH items focus on his own strength, presence, and purpose;
// CONNECT items focus on how to show up for his wife in a way that lets her
// soften and feel cared for. Tone is grounded and practical — no jargon.

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export const STEPHEN_GROWTH: string[] = [
  "Decide the hardest thing on your list and do it first. Momentum follows action.",
  "Train your body today, even briefly. A strong frame steadies a busy mind.",
  "Say what you mean plainly. Clarity is a kindness and a sign of strength.",
  "Be the calm in the room. When you stay steady, everyone around you settles.",
  "Lead with a decision. People would rather follow a clear plan than wait on a perfect one.",
  "Keep the promise you made to yourself. Self-trust is built in private.",
  "Protect your word like it's currency — because to your family, it is.",
  "Do one rep more than you feel like. Discipline compounds quietly.",
  "Own the mistake fast and fully. Accountability is magnetic.",
  "Spend ten minutes on something that builds your future, not just your day.",
  "Choose the long game. The patient man usually wins the room.",
  "Sharpen one skill this week. A man who keeps learning never gets stale.",
  "Sit with a hard feeling instead of numbing it. Mastery starts with awareness.",
  "Be generous with your strength — lift someone who can't repay you.",
  "Guard your mornings. How you start sets the tone for everyone who depends on you.",
  "Pick your hard: the discomfort of discipline or the regret of drift.",
  "Stand for something today. Conviction is more attractive than comfort.",
  "Less reacting, more responding. Power is the pause before you speak.",
  "Get outside and move. Sun, sweat, and effort reset a heavy head.",
  "Mentor, don't manage, your girls. Show them what a steady man looks like.",
  "Finish what you start this week. Loose ends drain quiet energy.",
  "Be the thermostat, not the thermometer — set the temperature of your home.",
  "Cut one distraction that steals your focus. Attention is your real wealth.",
  "Carry the heavy thing without complaint. Quiet competence speaks loudest.",
  "Define what 'a good week' means, then build it on purpose.",
  "Rest like you mean it. Recovery is part of strength, not the opposite of it.",
  "Speak to your future self with respect — make him proud of today's choices.",
  "Be slow to anger and quick to act. Controlled force is the goal.",
  "Know your purpose for the season. A man with direction is hard to knock over.",
  "Do the small, unseen right thing. Integrity is who you are when no one's watching.",
];

export const STEPHEN_CONNECT: string[] = [
  "Ask Whitney how she's doing, then just listen. Resist the urge to fix it.",
  "Take one thing off her plate today before she has to ask.",
  "Plan the date yourself — pick the time, the place, the babysitter. Let her just show up.",
  "Tell her specifically what you admire about her, not just that you love her.",
  "When she vents, your job is presence, not solutions. Stay close and stay quiet.",
  "Handle a decision so she gets a break from carrying the mental load.",
  "Pursue her like you're still trying to win her. She notices the effort.",
  "Give her twenty undistracted minutes — phone down, eyes up.",
  "Make the home feel safe and steady today; that's where she relaxes.",
  "Thank her out loud for something she does that usually goes unseen.",
  "Surprise her with the small thing she mentioned weeks ago. It says 'I was listening.'",
  "Lead the logistics tonight so she doesn't have to think. Let her exhale.",
  "Touch base midday with a text that isn't about a task or the kids.",
  "Let her feelings be valid before you offer a single fix.",
  "Create a moment of calm for her — coffee made, kitchen handled, kids managed.",
  "Be affectionate without an agenda. Warmth builds trust over time.",
  "Defend her time. Protect a pocket of the day that's hers alone.",
  "Ask, 'What would make this week easier for you?' — then actually do it.",
  "Notice when she's stretched thin and step in early, not after the storm.",
  "Speak well of her to the girls. They learn how she's treasured by watching you.",
  "Make a plan and invite her into it; she can relax when you've got the wheel.",
  "Hold space for a hard conversation without getting defensive.",
  "Bring the lightness. A little playfulness pulls her out of overwhelm.",
  "Remember the details she cares about — they matter more than grand gestures.",
  "Give her room to rest without guilt. Cover the gap so she can recharge.",
  "Reassure her you're in it together when things get heavy.",
  "Compliment the effort, not just the result — she carries a lot quietly.",
  "End the day connected: ask about her, share about you, then put the day down.",
  "Be consistent. Dependable warmth is more romantic than the occasional grand move.",
  "Let her be soft by being strong — steady, patient, and unshaken.",
];

export function stephenGrowthForDate(date = new Date()): string {
  return STEPHEN_GROWTH[dayOfYear(date) % STEPHEN_GROWTH.length];
}

export function stephenConnectForDate(date = new Date()): string {
  return STEPHEN_CONNECT[dayOfYear(date) % STEPHEN_CONNECT.length];
}
