// Spark categories — shared between the page (button labels) and the API
// (prompt construction). The client sends only the id; the hint text that
// steers the model never leaves the server response path.

export interface SparkCategory {
  id: string;
  name: string;
  hint: string;
}

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
];
