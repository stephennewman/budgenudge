// Daily content for the "For Whitney" channel.
//
// Authored, rotating prompts for a 39-year-old wife and mother of three girls.
// GROWTH items focus on rest, warmth, play, and caring for herself; CONNECT
// items focus on inviting and appreciating her husband's steadiness so they
// work as a team. Tone is warm and practical — no jargon.

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export const WHITNEY_GROWTH: string[] = [
  "Schedule one thing today that's just for you — not for anyone else.",
  "Let yourself receive help without earning it or apologizing for it.",
  "Move your body in a way that feels good, not punishing.",
  "Trust your gut today; your first read on people is usually right.",
  "Rest is productive. Give yourself permission to slow down without guilt.",
  "Say no to one thing so you can say yes to your own peace.",
  "Do something playful with the girls — joy is contagious and restorative.",
  "Speak to yourself the way you'd speak to your best friend.",
  "Create a little beauty around you: flowers, music, a tidy corner. It feeds you.",
  "Name what you actually need today, then let it be okay to want it.",
  "Take the long shower, the quiet coffee, the unhurried minute. You've earned it.",
  "Let a small thing go undone. The world keeps spinning, and you get to breathe.",
  "Reconnect with a friend who fills you up. Community is self-care.",
  "Pour into your own cup first; you can't give from empty.",
  "Follow a spark of creativity today, even for ten minutes.",
  "Soften your shoulders, unclench your jaw. Ease is allowed.",
  "Celebrate a small win out loud. You do so much that goes unnoticed.",
  "Protect your energy from people and feeds that drain it.",
  "Get outside for a few minutes. Light and fresh air change everything.",
  "Let yourself feel it fully, then let it move through. Emotions are information.",
  "Wear the thing that makes you feel like yourself today.",
  "Ask for what you want directly — clarity is a gift to everyone.",
  "Make space for stillness before the day grabs you.",
  "You don't have to do it all today. Choose what truly matters and release the rest.",
  "Nurture a dream that's only yours — it still counts, and it still matters.",
  "Receive a compliment with a simple 'thank you,' no deflecting.",
  "Lower the bar from perfect to present. Your presence is the point.",
  "Tend to your body kindly — water, food, rest. It carries so much for you.",
  "Laugh today, on purpose. Lightness is a form of strength.",
  "Be gentle with yourself. You're doing more than anyone sees.",
];

export const WHITNEY_CONNECT: string[] = [
  "Tell Stephen exactly what would help — he'd rather know than guess.",
  "When he handles something, let him do it his way and say thank you.",
  "Share the win and the worry; he wants to be let into your world.",
  "Notice and name one thing he did well today. Respect lands deep for him.",
  "Let him lead the plan tonight and enjoy the break from deciding.",
  "Ask for his help before you're overwhelmed — he loves being your go-to.",
  "Receive his effort warmly, even when it's not perfect. Encouragement multiplies it.",
  "Tell him you're proud of him. He carries that further than you'd think.",
  "Trust him with the kids and the chaos; resist the urge to redo it.",
  "Be clear, not hint-y. Direct words save you both a lot of friction.",
  "Welcome his ideas for a fix sometimes — it's how he shows love.",
  "Greet him like you're glad he's home. That moment sets the evening.",
  "Let him carry the heavy thing. Leaning on him is a gift to him too.",
  "Express appreciation for how he provides, in whatever form that takes.",
  "Invite him in: 'I'd love your help with this' opens the door.",
  "Flirt a little. Playfulness reminds him he's still your guy.",
  "Give him a moment to decompress before the rundown of the day.",
  "Assume the best about his intent before you read into his tone.",
  "Tell him what you're looking forward to doing together.",
  "Let him surprise you without correcting the details.",
  "Speak well of him to the girls — they learn respect by watching you.",
  "When you disagree, aim for the same team, not opposite corners.",
  "Ask his opinion and really weigh it; being needed energizes him.",
  "Thank him for the unseen things — they often go unspoken.",
  "Make room for his strength by stepping back from the steering wheel sometimes.",
  "Tell him one specific way he makes your life easier.",
  "Choose curiosity over criticism when he does things differently.",
  "Let him take care of you today and resist the urge to manage it.",
  "Reconnect at the end of the day — eyes up, phones down, just you two.",
  "Remind him you're in his corner. Steady support brings out his best.",
];

export function whitneyGrowthForDate(date = new Date()): string {
  return WHITNEY_GROWTH[dayOfYear(date) % WHITNEY_GROWTH.length];
}

export function whitneyConnectForDate(date = new Date()): string {
  return WHITNEY_CONNECT[dayOfYear(date) % WHITNEY_CONNECT.length];
}
