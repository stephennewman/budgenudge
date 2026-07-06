// Daily content for the "Friends & Connections" channel.
//
// Authored, rotating prompts that nudge you to stay socially connected —
// reaching out to friends, former colleagues, and extended family, plus
// small everyday acts that keep your wider network warm. Tone matches the
// other channels: practical, low-pressure, one small action per day.

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

// Direct nudges to contact a specific person from your past or present.
export const FRIENDS_REACH: string[] = [
  "Text an old friend you haven't talked to in months. No agenda — just 'thinking of you.'",
  "Reach out to a former colleague and ask what they're working on these days.",
  "Send a quick thank-you to a past boss or mentor who shaped how you work.",
  "Call a cousin, aunt, or uncle you only see at holidays. Five minutes counts.",
  "Reply to that message you've been meaning to answer. Late is better than never.",
  "Wish someone a happy birthday with a call instead of a comment.",
  "Text a college or high school friend a memory that made you laugh.",
  "Check in on a friend who's been going through something. Just ask how they're holding up.",
  "Send an article, song, or meme to the one person it made you think of.",
  "Invite a friend to something already on your calendar — a walk, an errand, a game.",
  "Congratulate someone on a win you saw online — but do it privately, in their inbox.",
  "Ask an old coworker to grab coffee or a call this month. Put a date on it.",
  "Message the friend you always say 'we should catch up' to — and actually propose a time.",
  "Reach out to someone who moved away. Distance only ends friendships if you let it.",
  "Text a sibling or parent something specific you appreciate about them.",
  "Reconnect with a neighbor from a place you used to live.",
  "Ask a friend for a small favor or opinion. People like being needed.",
  "Send a photo from your week to a friend who'd enjoy the update.",
  "Follow up with someone you met recently and said you'd stay in touch with.",
  "Call a grandparent or older relative. Your voice makes their day.",
  "Tell a friend about something you're struggling with. Letting people in deepens the bond.",
  "Recommend a friend for something — a job, a project, an introduction.",
  "Message an old teammate from a sport, band, or club and reminisce a little.",
  "Ask someone how their big thing went — the interview, the move, the appointment.",
  "Reach out to the friend who always reaches out to you first. Take a turn.",
  "Text a couple you and your spouse enjoy and float a double date.",
  "Send a voice memo instead of a text. It lands warmer.",
  "Reconnect with a childhood friend. Shared history is a rare thing.",
  "Thank someone who helped you this year — specifically, not generically.",
  "Pick one person you miss and tell them exactly that: 'I miss you.'",
];

// Small social acts with strangers, neighbors, and acquaintances.
export const FRIENDS_HELLO: string[] = [
  "Smile and say hi to a stranger today. It costs nothing and lifts you both.",
  "Learn one name today — a barista, a cashier, a neighbor — and use it.",
  "Give a genuine compliment to someone you don't know well.",
  "Ask the person helping you how their day is going — and listen to the answer.",
  "Wave at a neighbor instead of pretending you didn't see them.",
  "Hold the door, make eye contact, say 'have a good one.' Small warmth compounds.",
  "Chat with the parent next to you at pickup, practice, or the playground.",
  "Thank someone doing a job people rarely notice.",
  "Ask a coworker you don't know well about their weekend.",
  "Let someone go ahead of you in line and mean it.",
  "Say good morning to the people you pass on your walk.",
  "Strike up thirty seconds of small talk instead of reaching for your phone.",
  "Introduce yourself to a neighbor you've only ever nodded at.",
  "Ask someone a question about themselves and follow up on their answer.",
  "Leave a kind review or note for a small business you love.",
  "Compliment a stranger's dog, garden, or jacket. Easy openers, real connection.",
  "Tip a little extra and say thanks by name if they're wearing a tag.",
  "Offer to help someone visibly juggling too much — bags, kids, boxes.",
  "Make small talk in the elevator instead of staring at the numbers.",
  "Tell a manager when someone gives you great service.",
  "Sit near someone at church or an event instead of an empty row away.",
  "Ask the new person at work, the gym, or the neighborhood how they're settling in.",
  "Put the phone away in line and be available for a human moment.",
  "Say 'good game' or 'nice job' to a stranger's kid at the field.",
  "Invite a casual acquaintance one ring closer — coffee, a walk, a favor.",
  "Ask your server or barista for a recommendation and take it.",
  "Notice someone standing alone at a gathering and go say hello.",
  "Give up your seat, your spot, or your parking space once today.",
  "Tell a stranger they dropped something, left lights on, or got a great deal — be useful.",
  "Be the first to say hello everywhere you go today.",
];

// Habits and tips for keeping your wider network fresh over time.
export const FRIENDS_KEEP: string[] = [
  "Friendships run on maintenance, not milestones. Little and often beats big and rare.",
  "Don't keep score on who reached out last. The relationship matters more than the ledger.",
  "Put recurring reminders on your calendar for the people you never want to drift from.",
  "When you think of someone, tell them within the hour. Unsent warmth expires.",
  "Say yes to the invite you'd normally skip. Presence builds friendship faster than intent.",
  "Be the one who organizes. Most people want to gather — few send the first text.",
  "Follow up after people share something big. 'How did it go?' is friendship glue.",
  "Keep a short list of people you're 'due' to contact and work through it weekly.",
  "Loneliness shrinks your world slowly. Fight it with one small reach-out a day.",
  "Ask better questions. 'What's been good lately?' opens more than 'How are you?'",
  "Remember the details — kids' names, job changes, health stuff. Write them down if you must.",
  "Old friends need new memories. Plan something instead of only reminiscing.",
  "Weak ties matter: the acquaintance you barely know may open your next door.",
  "End conversations with a next step: 'Let's do this again in a month.'",
  "Celebrate other people's wins loudly. Envy shrinks networks; enthusiasm grows them.",
  "Apologize for the friendship you dropped. Most people just want to hear from you.",
  "Show up in person when it counts — funerals, big birthdays, hard seasons.",
  "Do favors without invoicing them. Generosity is the best networking strategy.",
  "Make your home easy to visit. Hospitality doesn't require a spotless house.",
  "Mix your circles — introduce two friends who'd get along. Everyone wins.",
  "Reach out when things are good, not only when you need something.",
  "Treat your spouse's friends and family as your network too. Invest there.",
  "Consistency beats intensity: a monthly call outlasts an annual reunion.",
  "Be easy to reach and quick to reply. Responsiveness is a form of respect.",
  "Join something recurring — a league, a study, a club. Repetition builds friendship.",
  "Ask for help sometimes. Letting people show up for you deepens the tie.",
  "Send the group text that gets everyone together. Someone has to.",
  "Check on the strong ones. The friend who seems fine may need it most.",
  "Give people your full attention when you're with them. Presence is rare currency.",
  "Aim to leave every interaction a little warmer than you found it.",
];

export function friendsReachForDate(date = new Date()): string {
  return FRIENDS_REACH[dayOfYear(date) % FRIENDS_REACH.length];
}

export function friendsHelloForDate(date = new Date()): string {
  return FRIENDS_HELLO[dayOfYear(date) % FRIENDS_HELLO.length];
}

export function friendsKeepForDate(date = new Date()): string {
  return FRIENDS_KEEP[dayOfYear(date) % FRIENDS_KEEP.length];
}
