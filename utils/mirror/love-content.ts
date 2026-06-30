// Daily love / marriage content for the Love channel.
//
// Authored, rotating content (same approach as connection-prompts). The daily
// connection challenge lives in connection-prompts.ts; this file adds a love
// quote and a practical marriage tip. Edit freely.

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export const LOVE_QUOTES: { text: string; author: string }[] = [
  { text: "The best thing to hold onto in life is each other.", author: "Audrey Hepburn" },
  { text: "Love is not about how much you say 'I love you,' but how much you prove it's true.", author: "Unknown" },
  { text: "A successful marriage requires falling in love many times, always with the same person.", author: "Mignon McLaughlin" },
  { text: "To love and be loved is to feel the sun from both sides.", author: "David Viscott" },
  { text: "The greatest happiness of life is the conviction that we are loved.", author: "Victor Hugo" },
  { text: "Love doesn't make the world go round. Love is what makes the ride worthwhile.", author: "Franklin P. Jones" },
  { text: "A great marriage is not when the perfect couple comes together. It is when an imperfect couple learns to enjoy their differences.", author: "Dave Meurer" },
  { text: "Being deeply loved by someone gives you strength, while loving someone deeply gives you courage.", author: "Lao Tzu" },
  { text: "The heart that loves is always young.", author: "Greek Proverb" },
  { text: "Love is composed of a single soul inhabiting two bodies.", author: "Aristotle" },
  { text: "We are most alive when we're in love.", author: "John Updike" },
  { text: "There is no remedy for love but to love more.", author: "Henry David Thoreau" },
  { text: "Where there is love there is life.", author: "Mahatma Gandhi" },
  { text: "The best love is the kind that awakens the soul and makes us reach for more.", author: "Nicholas Sparks" },
  { text: "Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its destination full of hope.", author: "Maya Angelou" },
  { text: "A happy marriage is a long conversation which always seems too short.", author: "André Maurois" },
  { text: "Love is friendship that has caught fire.", author: "Ann Landers" },
  { text: "In all the world, there is no heart for me like yours.", author: "Maya Angelou" },
  { text: "Love is a choice you make from moment to moment.", author: "Barbara De Angelis" },
  { text: "The couple that prays together, stays together.", author: "Proverb" },
  { text: "Marriage is not 50-50. Divorce is 50-50. Marriage has to be 100-100.", author: "Dave Willis" },
  { text: "Love is patient, love is kind. It always protects, always trusts, always hopes, always perseveres.", author: "1 Corinthians 13" },
  { text: "Chains do not hold a marriage together. It is threads, hundreds of tiny threads.", author: "Simone Signoret" },
  { text: "A good marriage is one where each partner secretly suspects they got the better deal.", author: "Unknown" },
  { text: "You don't marry someone you can live with — you marry the person you cannot live without.", author: "Unknown" },
  { text: "Love is the bridge between two hearts.", author: "Unknown" },
  { text: "The goal in marriage is not to think alike, but to think together.", author: "Robert C. Dodds" },
  { text: "Love grows by giving. The love we give away is the only love we keep.", author: "Elbert Hubbard" },
  { text: "True love stories never have endings.", author: "Richard Bach" },
  { text: "The greatest marriages are built on teamwork, mutual respect, and a healthy dose of admiration.", author: "Fawn Weaver" },
];

export const MARRIAGE_TIPS: string[] = [
  "Greet each other first thing in the morning before reaching for your phone.",
  "Say thank you for the ordinary things — they're easy to take for granted.",
  "Argue about the problem, not the person. Stay on the same team.",
  "Schedule a real date, even at home after the kids are asleep.",
  "Assume the best about your partner's intentions before reacting.",
  "Repair quickly after conflict — a sincere 'I'm sorry' goes far.",
  "Ask 'how can I help?' instead of waiting to be asked.",
  "Keep a short list of things you appreciate, and share one today.",
  "Protect your relationship from the small resentments that quietly build up.",
  "Listen to understand, not to reply. Reflect back what you heard.",
  "Do the chore they hate, just once, without mentioning it.",
  "Dream together — talk about something you both want for the future.",
  "Touch base midday with a quick text just to connect.",
  "Celebrate their wins like they're your own.",
  "Make eye contact and put the phone down during dinner.",
  "Forgive the way you'd want to be forgiven.",
  "Speak well of your spouse to others — and to yourself.",
  "Give the benefit of the doubt; everyone has hard days.",
  "Keep flirting. Marriage shouldn't end the romance.",
  "Pray for and with each other, even briefly.",
  "Don't keep score. Generosity beats fairness in love.",
  "Learn how your partner feels loved, then do that on purpose.",
  "Plan one thing to look forward to together this week.",
  "Be quick to listen, slow to speak, slow to become angry.",
  "Hold hands. Physical closeness rebuilds emotional closeness.",
  "Apologize first, even when you're sure you're right.",
  "Make your home a place of grace, not pressure.",
  "Check in on the state of your union: 'How are we doing, really?'",
  "Laugh together every day — shared humor is glue.",
  "Choose your spouse again today, on purpose.",
];

export function loveQuoteForDate(date = new Date()): { text: string; author: string } {
  return LOVE_QUOTES[dayOfYear(date) % LOVE_QUOTES.length];
}

export function marriageTipForDate(date = new Date()): string {
  return MARRIAGE_TIPS[dayOfYear(date) % MARRIAGE_TIPS.length];
}
