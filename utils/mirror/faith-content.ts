// Daily faith content for the Faith channel.
//
// Authored, rotating content for a Christian household dashboard. The daily
// verse comes from a free API (see the together route); this file adds an
// interesting faith fact and a practical faith-living tip. Edit freely.

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export const FAITH_FACTS: string[] = [
  "The Bible was written over roughly 1,500 years by about 40 authors on three continents.",
  "Psalm 117 is the shortest chapter in the Bible; Psalm 119 is the longest.",
  "The word 'gospel' simply means 'good news.'",
  "Jesus quoted from the book of Deuteronomy more than any other Old Testament book.",
  "The Bible is the most translated book in history, available in over 700 languages in full.",
  "The early church met in homes; dedicated church buildings came centuries later.",
  "The shortest verse in many English Bibles is John 11:35 — 'Jesus wept.'",
  "There are 66 books in the Protestant Bible: 39 Old Testament, 27 New Testament.",
  "The name 'Christian' was first used in the city of Antioch (Acts 11:26).",
  "The Sea of Galilee, where Jesus called His first disciples, is actually a freshwater lake.",
  "Easter celebrates the resurrection of Jesus — the cornerstone of the Christian faith.",
  "The word 'Amen' means 'so be it' or 'let it be so.'",
  "The book of Psalms is essentially the songbook and prayer book of the Bible.",
  "Jesus' most repeated command in the Gospels is some form of 'do not be afraid.'",
  "The Lord's Prayer is found in Matthew 6 and Luke 11.",
  "The four Gospels — Matthew, Mark, Luke, John — each tell Jesus' story from a different angle.",
  "'Hallelujah' means 'praise the Lord.'",
  "The first miracle of Jesus recorded in John's Gospel was turning water into wine.",
  "Paul wrote much of the New Testament — including several letters from prison.",
  "The Bible mentions 'fear not' or similar encouragements hundreds of times.",
  "Communion (the Lord's Supper) traces back to Jesus' last meal with His disciples.",
  "Grace, a central Christian idea, means unearned favor — a gift you can't repay.",
  "The cross, once a symbol of execution, became the symbol of hope and redemption.",
  "The Bible's central message can be summed up as love God and love your neighbor.",
  "Pentecost marks the coming of the Holy Spirit and the birth of the church.",
  "The Ten Commandments appear in both Exodus 20 and Deuteronomy 5.",
  "Jesus told around 40 parables — short stories that reveal deep truths.",
  "The word 'disciple' means 'learner' or 'follower.'",
  "Christianity is the largest faith in the world, with over 2 billion followers.",
  "The Bible ends with the promise of all things being made new (Revelation 21).",
];

export const FAITH_TIPS: string[] = [
  "Start the day with a short prayer of gratitude before your feet hit the floor.",
  "Read one verse slowly and carry it with you all day.",
  "Pray for someone who's hard to love — it softens your own heart.",
  "Pause before meals to give a quick word of thanks.",
  "Forgive quickly; bitterness only chains the one who holds it.",
  "Look for one way to serve someone today without being asked.",
  "When anxious, trade worry for prayer: name it, then hand it over.",
  "Be quick to listen, slow to speak, slow to anger (James 1:19).",
  "Memorize a short verse this week, one phrase at a time.",
  "Confess and let go — grace means you don't have to carry yesterday.",
  "Speak life: offer one genuine encouragement to someone today.",
  "Rest is holy. Take a real Sabbath pause this week.",
  "Give generously and quietly; let the gift, not the credit, be the point.",
  "Choose contentment — name three things you already have to be thankful for.",
  "Treat the next person you meet as someone God deeply loves.",
  "Pray honestly. God can handle your doubts and your questions.",
  "Do the small, unseen right thing — character is built in private.",
  "Replace a complaint today with a prayer.",
  "Slow down enough to notice grace in ordinary moments.",
  "Lead your family by serving them, not by ruling them.",
  "When wronged, respond with kindness — it disarms and heals.",
  "Spend a few quiet minutes simply being still before God.",
  "Be a peacemaker today — lower the temperature, not raise it.",
  "Let your yes be yes; keep your word, even when it's costly.",
  "Look for God in your work; do it well, as if for Him.",
  "Encourage your kids' faith with one honest conversation, not a lecture.",
  "Hold your plans loosely and trust that He's working things for good.",
  "Practice humility: assume you have something to learn from everyone.",
  "End the day by naming one way you saw God at work.",
  "Love God, love people. Let that shape one decision today.",
];

export function faithFactForDate(date = new Date()): string {
  return FAITH_FACTS[dayOfYear(date) % FAITH_FACTS.length];
}

export function faithTipForDate(date = new Date()): string {
  return FAITH_TIPS[dayOfYear(date) % FAITH_TIPS.length];
}
