/**
 * GSM-7 sanitizer.
 *
 * SMS is billed per "segment": 160 chars for plain GSM-7 text, but only ~67
 * chars once a message contains ANY non-GSM-7 character (emoji, curly quotes,
 * bullets, em dashes, box-drawing, etc.), because the whole message flips to
 * UCS-2. Forcing messages into GSM-7 roughly halves credit usage.
 *
 * This maps common "smart" punctuation to GSM-7 equivalents, then drops any
 * remaining non-GSM-7 characters (decorative emoji), and tidies up the
 * whitespace that removal can leave behind (e.g. a leading "emoji + space").
 */

// The GSM 03.38 default alphabet (basic set) plus the extension table chars.
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXTENSION = '^{}\\[~]|€';
const GSM_SET = new Set([...GSM_BASIC, ...GSM_EXTENSION]);

// Best-effort transliteration for common non-GSM punctuation.
const REPLACEMENTS: Record<string, string> = {
  '·': '-',
  '•': '-',
  '‣': '-',
  '–': '-',
  '—': '-',
  '―': '-',
  '…': '...',
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '×': 'x',
  '→': '->',
  '⇒': '=>',
  '≈': '~',
  '™': 'TM',
  '®': '(R)',
  '©': '(C)',
  '\u00A0': ' ', // non-breaking space
  '\t': ' ',
};

export function toGsm7(input: string): string {
  if (!input) return '';

  // 1) Transliterate known punctuation.
  let s = input.replace(/[·•‣–—―…’‘“”×→⇒≈™®©\u00A0\t]/g, (ch) => REPLACEMENTS[ch] ?? ch);

  // 2) Drop anything still outside the GSM-7 alphabet (emoji, box-drawing, VS16, etc.).
  let out = '';
  for (const ch of s) {
    if (GSM_SET.has(ch)) out += ch;
  }

  // 3) Tidy whitespace left behind by removed characters.
  return out
    .replace(/[ ]{2,}/g, ' ') // collapse runs of spaces
    .replace(/[ ]+\n/g, '\n') // trailing spaces on a line
    .replace(/\n[ ]+/g, '\n') // leading spaces on a line (e.g. was "emoji text")
    .replace(/\n{3,}/g, '\n\n') // cap blank lines
    .trim();
}

/** True if the string is already fully GSM-7 representable. */
export function isGsm7(input: string): boolean {
  return [...input].every((ch) => GSM_SET.has(ch));
}
