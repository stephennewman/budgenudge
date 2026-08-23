// Spark categories — shared between the page (button labels) and the API
// (prompt construction). The client sends only the id; the hint text that
// steers the model never leaves the server response path.

export interface SparkCategory {
  id: string;
  name: string;
  hint: string;
}

// Action tags: each generated idea is steered toward one verb so a batch of
// four never comes out as four variations of "do this tonight". The client
// deals four distinct random tags per generation, one per level.
export interface SparkTag {
  id: string;
  gloss: string;
}

export const ACTION_TAGS: SparkTag[] = [
  { id: "do", gloss: "a physical act to perform" },
  { id: "say", gloss: "an exact line to speak out loud, face to face" },
  { id: "send", gloss: "an exact text message to send right now" },
  { id: "share", gloss: "a fantasy or confession to share with their spouse" },
  { id: "record", gloss: "a voice note or private video to record for their spouse" },
  { id: "try", gloss: "a new position, technique, or move to try" },
  { id: "wear", gloss: "something to wear — or deliberately not wear" },
  { id: "tease", gloss: "a slow tease to run on their spouse" },
  { id: "touch", gloss: "a specific way to touch their spouse" },
  { id: "watch", gloss: "something for the two of them to watch each other do" },
  { id: "whisper", gloss: "an exact line to whisper at close range in passing" },
  { id: "plan", gloss: "something to secretly set up for later tonight or this week" },
  { id: "play", gloss: "a quick two-person game to play, with rules and stakes" },
  { id: "buy", gloss: "something inexpensive to buy or order for use together soon" },
  { id: "think", gloss: "a fantasy about their spouse to dwell on when apart" },
  { id: "dare", gloss: "a dare to issue to their spouse" },
  { id: "show", gloss: "something to show or reveal to their spouse" },
  { id: "act", gloss: "a small scene or role to act out, just the two of them" },
];

export const CATEGORIES: SparkCategory[] = [
  {
    id: "texts",
    name: "Texts to Send",
    hint: "messages for the reader to send to their spouse right now — word-for-word in the reader's own voice, ready to copy",
  },
  {
    id: "dirty-talk",
    name: "Dirty Talk",
    hint: "exact lines to whisper or say out loud in the moment",
  },
  {
    id: "positions",
    name: "Positions",
    hint: "specific positions or moves to try, described concretely enough to actually pull off",
  },
  {
    id: "dares",
    name: "Dares",
    hint: "dares and challenges — things to do, or to pull off on their spouse",
  },
  {
    id: "foreplay",
    name: "Foreplay",
    hint: "ways to start things and build heat long before the main event",
  },
  {
    id: "games",
    name: "Games",
    hint: "playful two-person games with sexy stakes and clear rules",
  },
  {
    id: "roleplay",
    name: "Roleplay",
    hint: "scenarios where the two of them play characters — strangers at a bar, boss and new hire — always knowing it's just the two of them",
  },
  {
    id: "power-play",
    name: "Power Play",
    hint: "who's in charge tonight — commands, control, obedience, surrender",
  },
  {
    id: "anticipation",
    name: "Anticipation",
    hint: "slow-burn teases that build all day toward tonight",
  },
  {
    id: "solo-show",
    name: "Solo Show",
    hint: "solo pleasure — enjoyed alone thinking of their spouse, or performed for them to watch",
  },
  {
    id: "sensory",
    name: "Sensory Play",
    hint: "blindfolds, ice, wax, feathers, breath, temperature, deprivation of one sense to heighten the rest",
  },
  {
    id: "stolen-moments",
    name: "Stolen Moments",
    hint: "quick, discreet moments stolen around a busy family day with kids in the house",
  },
  {
    id: "around-the-house",
    name: "Around the House",
    hint: "new spots, rooms, and surfaces at home to put to unexpected use",
  },
  {
    id: "massage",
    name: "Massage & Touch",
    hint: "hands-on, full-body, slow touch that deliberately turns into more",
  },
  {
    id: "props",
    name: "Toys & Props",
    hint: "toys or ordinary household items to bring into play",
  },
  {
    id: "voice",
    name: "Voice & Whisper",
    hint: "voice notes to record or promises to whisper in their ear in passing",
  },
  {
    id: "undress",
    name: "The Reveal",
    hint: "what to wear underneath, how to reveal it, and exactly how it comes off",
  },
  {
    id: "morning",
    name: "Morning Heat",
    hint: "before-the-alarm and before-the-kids-wake wake-up moves",
  },
  {
    id: "kink-sampler",
    name: "Kink Sampler",
    hint: "one kink to explore together — introduced gently at low levels, taken all the way at the top",
  },
  {
    id: "date-finale",
    name: "Date Night Finale",
    hint: "how tonight's date should end once they're back home and the sitter leaves",
  },
  {
    id: "mirror",
    name: "Watch & Be Watched",
    hint: "mirrors, watching each other, being told to watch, putting on a show",
  },
  {
    id: "worship",
    name: "Body Worship",
    hint: "slow, focused adoration of one specific part of their spouse's body",
  },
  {
    id: "hotpast",
    name: "Hot Past",
    hint: "swapping kinky confessions about their sexual histories — wild past experiences, former partners, firsts, secrets never told — shared as stories or questions to turn each other on",
  },
  {
    id: "challenges",
    name: "Challenges",
    hint: "timed challenges with concrete numbers — sprints, marathons, quickies, speed rounds, endurance tests, beat-the-clock, number of positions before the timer, hold-out-as-long-as-you-can. Every idea includes a specific time limit, duration, or count",
  },
  {
    id: "confessions",
    name: "Confessions",
    hint: "present-day confessions to make to their spouse — secret desires, dirty thoughts they've had about them this week, things they've never admitted wanting, moments they were secretly turned on",
  },
  {
    id: "truth-or-dare",
    name: "Truth or Dare",
    hint: "classic truth-or-dare between the two of them — each idea is one truth question or one dare, clearly labeled, ready to fire at their spouse",
  },
  {
    id: "would-you-rather",
    name: "Would You Rather",
    hint: "dirty either/or questions to ask their spouse — two tempting options, spouse must pick one and explain why",
  },
  {
    id: "bucket-list",
    name: "Bucket List",
    hint: "a sexual bucket-list item to propose adding to their shared list — something they've never done together, pitched with when and how to make it happen",
  },
  {
    id: "know-me",
    name: "How Well You Know Me",
    hint: "sexy quiz questions to ask their spouse about themselves — what gets me going, my favorite spot, what I think about — with stakes for right and wrong answers",
  },
  {
    id: "firsts",
    name: "New Firsts",
    hint: "a brand-new first for the two of them to have together — something neither has ever done with anyone, claimed as theirs alone",
  },
  {
    id: "oral",
    name: "Oral",
    hint: "going down on their spouse — giving and receiving, techniques, positions, teasing starts, timing, places, making them beg for it or finish from it",
  },
];
