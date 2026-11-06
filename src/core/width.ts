/**
 * Unicode display-width measurement: how many terminal columns a string
 * occupies in a monospace chat surface. Pure, deterministic, dependency-free;
 * range tables are hardcoded and probed by binary search.
 *
 * Rules (feedback doc §8 "Unicode display width"):
 * - Default column width is 1; astral-safe (iterates code points, not UTF-16 units).
 * - Zero width: combining marks (Mn/Me/Mc), format controls Cf (ZWSP U+200B,
 *   ZWJ U+200D, BOM U+FEFF, …), variation selectors (U+FE00–FE0F,
 *   U+E0100–E01EF), C0/C1 controls.
 * - Width 2: East Asian Wide/Fullwidth (Hangul Jamo, CJK, kana, Hangul
 *   syllables, compatibility ideographs, vertical/fullwidth forms, CJK
 *   extensions) and emoji-presentation bases.
 * - Emoji sequences: VS16 (U+FE0F) after an emoji base keeps 2; skin-tone
 *   modifiers absorb into the base; ZWJ-joined constituents collapse into one
 *   2-column glyph. Regional indicators count 1 each, so a flag pair is 2.
 *
 * Documented approximation: mobile renderers compose emoji ZWJ sequences into
 * a single glyph (one 2-column cell); most terminals do too, but legacy ones
 * sum the constituents. We measure the mobile rendering. Ligature-forming
 * text (Arabic shaping, fi/ff ligatures) is also measured per code point,
 * which can overcount by the number of joined glyphs.
 */

/** Target display widths — not truncation limits (feedback doc §8). */
export type WidthProfile = 'compact' | 'standard' | 'comfortable'

export const WIDTH_PROFILES: Record<WidthProfile, number> = {
  compact: 32,
  standard: 40,
  comfortable: 60,
}

/** Inclusive code-point ranges, sorted ascending by start. */
type Range = readonly [start: number, end: number]

/** Width 0: C0/C1 controls, combining marks (Mn/Me/Mc), Cf, variation selectors. */
const ZERO_RANGES: readonly Range[] = [
  [0x0000, 0x001f], [0x007f, 0x009f], // C0 / C1 controls
  [0x00ad, 0x00ad], // soft hyphen (Cf)
  [0x0300, 0x036f], // combining diacritical marks
  [0x0483, 0x0489], // Arabic/Hebrew combining
  [0x0591, 0x05bd], [0x05bf, 0x05bf], [0x05c1, 0x05c2], [0x05c4, 0x05c5], [0x05c7, 0x05c7],
  [0x0600, 0x0605], [0x0610, 0x061a], [0x061c, 0x061c], [0x064b, 0x065f], [0x0670, 0x0670],
  [0x06d6, 0x06dd], [0x06df, 0x06e4], [0x06e7, 0x06e8], [0x06ea, 0x06ed],
  [0x070f, 0x070f], [0x0711, 0x0711], [0x0730, 0x074a], [0x07a6, 0x07b0], [0x07eb, 0x07f3],
  [0x0816, 0x0819], [0x081b, 0x0823], [0x0825, 0x0827], [0x0829, 0x082d], [0x08e2, 0x08e2],
  [0x0900, 0x0902], [0x093a, 0x093a], [0x093c, 0x093c], [0x0941, 0x0948], [0x094d, 0x094d],
  [0x0951, 0x0957], [0x0962, 0x0963], // Devanagari marks
  [0x0e31, 0x0e31], [0x0e34, 0x0e3a], [0x0e47, 0x0e4e], // Thai marks
  [0x180b, 0x180e], // Mongolian free variation selectors / FVS4 (Cf)
  [0x1ab0, 0x1aff], [0x1dc0, 0x1dff], // combining extended / supplement
  [0x200b, 0x200f], // ZWSP, ZWNJ, ZWJ, LRM, RLM (Cf)
  [0x202a, 0x202e], // bidi embedding controls (Cf)
  [0x2060, 0x2064], [0x2066, 0x206f], // word joiner, invisible ops, bidi isolates (Cf)
  [0x20d0, 0x20f0], // combining marks for symbols
  [0xfe00, 0xfe0f], // variation selectors VS1–VS16
  [0xfe20, 0xfe2f], // combining half marks
  [0xfeff, 0xfeff], // BOM / ZWNBSP (Cf)
  [0x1d173, 0x1d17a], // musical control characters (Cf)
  [0xe0001, 0xe0001], [0xe0020, 0xe007f], // language tags (Cf)
  [0xe0100, 0xe01ef], // variation selectors supplement VS17–VS256
]

/** Width 2: East Asian Wide/Fullwidth plus emoji-presentation bases. */
const WIDE_RANGES: readonly Range[] = [
  [0x1100, 0x115f], // Hangul Jamo (leading)
  // Emoji-presentation singles in the BMP (⌚ ⌛ ⏏ ⏩ … ✅ ❎ ⭕ etc.)
  [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f],
  [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd],
  [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x2e80, 0xa4cf], // CJK radicals, kana, bopomofo, CJK unified, Yi
  [0xa960, 0xa97f], // Hangul Jamo extended-A
  [0xac00, 0xd7fb], // Hangul syllables + Jamo extended-B
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], [0xfe30, 0xfe6f], // vertical / CJK compatibility forms
  [0xff00, 0xff60], // fullwidth forms (halfwidth U+FF61–FF9F stays 1)
  [0xffe0, 0xffe6], // fullwidth sign forms
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], // mahjong tile, playing-card joker
  // U+1F1E6–U+1F1FF (regional indicators) deliberately excluded: width 1 each.
  [0x1f170, 0x1f1e5], [0x1f200, 0x1f251], // enclosed alphanumeric emoji (🅰 🅱 🆎 …)
  [0x1f300, 0x1f9ff], // misc symbols/pictographs, emoticons, transport, supplemental
  [0x1fa00, 0x1faff], // symbols and pictographs extended-A
  [0x20000, 0x3fffd], // CJK unified ideographs extensions B–G (plane 2–3)
]

/** Emoji bases that ZWJ can join into one glyph (all width 2). */
const EMOJI_BASE_RANGES: readonly Range[] = [
  [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f],
  [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd],
  [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf],
  [0x1f170, 0x1f1e5], [0x1f200, 0x1f251],
  [0x1f300, 0x1f9ff], [0x1fa00, 0x1faff],
]

/** Skin-tone modifiers U+1F3FB–U+1F3FF absorb into a preceding emoji base. */
const SKIN_TONE_RANGES: readonly Range[] = [[0x1f3fb, 0x1f3ff]]

/** Binary search over sorted inclusive ranges. */
function inRanges(cp: number, ranges: readonly Range[]): boolean {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, end] = ranges[mid]
    if (cp < start) hi = mid - 1
    else if (cp > end) lo = mid + 1
    else return true
  }
  return false
}

/**
 * Display width of `s` in monospace columns. Zero for an empty string;
 * O(n) over code points; deterministic pure function.
 *
 * Regional indicators (U+1F1E6–U+1F1FF) fall through to the width-1 default,
 * so a flag pair measures 2 while a lone indicator measures 1.
 */
export function displayWidth(s: string): number {
  let total = 0
  let clusterOpen = false // an emoji base may still be ZWJ-extended
  let joinedByZWJ = false
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp === 0x200d) {
      // ZWJ: extends an open emoji cluster, zero-width elsewhere.
      // Checked before ZERO_RANGES (which contains it) so joining actually happens.
      if (clusterOpen) joinedByZWJ = true
      continue
    }
    if (inRanges(cp, ZERO_RANGES)) continue // zero-width: never opens/closes a cluster
    if (clusterOpen && joinedByZWJ) {
      joinedByZWJ = false
      if (inRanges(cp, EMOJI_BASE_RANGES)) continue // joined constituent → same glyph
      clusterOpen = false // malformed sequence: the base stands, this char counts alone
      total += inRanges(cp, WIDE_RANGES) ? 2 : 1
      continue
    }
    if (clusterOpen && inRanges(cp, SKIN_TONE_RANGES)) continue // modifier → same glyph
    clusterOpen = inRanges(cp, EMOJI_BASE_RANGES)
    total += inRanges(cp, WIDE_RANGES) ? 2 : 1
  }
  return total
}
