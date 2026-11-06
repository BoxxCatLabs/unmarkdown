/**
 * Width-aware prose wrapping for the plain pipeline, applied right after the
 * table pass and `protection.extend` and BEFORE the line/inline passes —
 * i.e. on source-syntax text (feedback doc §8): fenced code, URLs, and
 * inline code are still sentinel tokens, tables are already decorated, and
 * headings, lists, quotes, rules, indented code, and reference definitions
 * are still source Markdown. Pure and deterministic.
 *
 * Why this seam: a heading whose decorated form degrades to the bare title
 * (title ≥ width, see core/headings.ts) would be indistinguishable from
 * prose after decoration — but its SOURCE line still starts with `#`, so
 * the source-syntax skips below keep every heading on exactly one output
 * row, even an overflowing degraded one.
 *
 * Guarantees:
 * - Any line containing a U+E000–U+E0FF sentinel codepoint (a protected
 *   fence, URL, or inline-code token) passes through whole: never measured,
 *   never split. Construct-heavy prose therefore stays unsplit rather than
 *   risk a break mid-construct.
 * - Decorated table regions still skip (the table pass ran earlier): exact
 *   `table.open`/`table.close` lines and compact `┌`…`└` boxes pass through
 *   byte-identical. Decorated code separators (`isCodeSeparator`, shared
 *   with code/decorate and the cleanup pass) toggle a code region whose
 *   interior also passes through verbatim — defensive: fences are normally
 *   sentinel tokens at this seam.
 * - Source-syntax skips, whole lines, byte-identical: ATX headings
 *   `^#{1,6}[ \t]`, blockquotes `^[ \t]{0,3}>`, list items
 *   `^[ \t]*([-*+]|\d{1,9}[.)])[ \t]+` (covers task items), thematic
 *   breaks, indented code `^[ \t]{4,}\S`, and reference definitions
 *   `^[ \t]{0,3}\[[^\]]+\]:`.
 * - Prose wraps greedily, splitting only at space characters that are
 *   markdown-safe; lines already within the budget pass through unchanged;
 *   intentional breaks are never merged; nothing is ever truncated.
 * - Markdown-aware break points: a space breaks only when no `[` or `(` is
 *   unclosed before it, an even number of `**`/`__`/`~~` marker pairs
 *   precede it (not inside an emphasis run), and an even number of backticks
 *   precede it (not inside inline code). Otherwise the space is not a break
 *   point: the construct stays whole and may overflow.
 * - Widths measure RAW markdown text: syntax markers count toward the
 *   budget. Conservative — later decoration can only shorten or keep
 *   lines, never lengthen them beyond their source width.
 * - Tokens without a safe break (URLs, long code-ish tokens, whole
 *   bracketed/emphasis constructs) take their own line and overflow, never
 *   split.
 * - Exception: an unbroken CJK run wider than the budget breaks between
 *   grapheme clusters — every CJK character is a break opportunity;
 *   combining marks, variation selectors, and ZWJ stay attached to their
 *   base cluster and a cluster is never split.
 * - Interior runs of spaces collapse to the single wrapping space, and
 *   continuation lines are flush left (no indent carried over) — the
 *   simplest deterministic choice; the wrapped line's own leading
 *   whitespace stays on its first output line only.
 *
 * Width semantics follow core/width.ts, the documented mobile-rendering
 * approximation of §8: fullwidth/CJK = 2 columns, emoji = 2 (ZWJ-joined and
 * skin-tone modifiers count once), combining marks = 0. A terminal's column
 * count approximates how a chat app actually renders on mobile; profile
 * widths target chat surfaces, not exact terminal layout.
 */

import { isCodeSeparator } from '../code/decorate'
import type { CodeFrameOptions, TableOptions } from '../options'
import { displayWidth } from './width'

/**
 * Minimal resolved-options view — structural: any resolved options object
 * with these fields works, no import from options internals required.
 */
export interface WrapOptions {
  width: number
  code: CodeFrameOptions
  table: Pick<TableOptions, 'open' | 'close'>
}

/** Inclusive code-point ranges, sorted ascending by start. */
type Range = readonly [start: number, end: number]

/**
 * The East-Asian wide sub-ranges of width.ts's width-2 table (emoji planes
 * excluded): a token qualifies as a CJK run only when every non-zero-width
 * code point lands in one of these.
 */
const CJK_RANGES: readonly Range[] = [
  [0x1100, 0x115f], // Hangul Jamo (leading)
  [0x2e80, 0xa4cf], // CJK radicals, kana, bopomofo, CJK unified, Yi
  [0xa960, 0xa97f], // Hangul Jamo extended-A
  [0xac00, 0xd7fb], // Hangul syllables + Jamo extended-B
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], [0xfe30, 0xfe6f], // vertical / CJK compatibility forms
  [0xff00, 0xff60], // fullwidth forms
  [0xffe0, 0xffe6], // fullwidth sign forms
  [0x20000, 0x3fffd], // CJK unified ideographs extensions B–G
]

/** Any codepoint of the protect.ts sentinel pool marks a protected token. */
const SENTINEL_RE = /[\uE000-\uE0FF]/

/** Source-syntax line shapes that must never wrap (whole-line skips). */
const SOURCE_SKIPS: readonly RegExp[] = [
  /^#{1,6}[ \t]/, // ATX heading
  /^[ \t]{0,3}>/, // blockquote
  /^[ \t]*([-*+]|\d{1,9}[.)])[ \t]+/, // list item (bullet/ordered, incl. task items)
  /^[ \t]{0,3}([-*_])[ \t]*\1[ \t]*\1([ \t]*\1)*[ \t]*$/, // thematic break
  /^[ \t]{4,}\S/, // indented code
  /^[ \t]{0,3}\[[^\]]+\]:/, // reference definition
]

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

/** True when every non-zero-width code point of `token` is East-Asian wide. */
function isCjkRun(token: string): boolean {
  let hasBase = false
  for (const ch of token) {
    const cp = ch.codePointAt(0)!
    if (displayWidth(ch) === 0) continue // combining marks, VS, ZWJ ride along
    if (!inRanges(cp, CJK_RANGES)) return false
    hasBase = true
  }
  return hasBase
}

/** Minimal grapheme clusters: a base code point plus attached zero-width code points. */
function clusterSplit(token: string): string[] {
  const clusters: string[] = []
  let cur = ''
  let open = false
  for (const ch of token) {
    if (!open) {
      cur = ch
      open = true
    } else if (displayWidth(ch) === 0) {
      cur += ch
    } else {
      clusters.push(cur)
      cur = ch
    }
  }
  if (open) clusters.push(cur)
  return clusters
}

/**
 * Break an over-wide CJK run between grapheme clusters. Each output line
 * holds as many whole clusters as fit the budget; a lone cluster wider than
 * the budget overflows on its own line (never truncated).
 */
function segmentCjkRun(token: string, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const cluster of clusterSplit(token)) {
    if (line !== '' && displayWidth(line + cluster) > width) {
      out.push(line)
      line = cluster
    } else {
      line += cluster
    }
  }
  if (line !== '') out.push(line)
  return out
}

/**
 * Split `rest` (the line minus its leading whitespace) into space-separated
 * words, recording for each word whether the gap BEFORE it is a legal break
 * point: bracket depth 0 (no unclosed `[`/`(`), an even count of
 * `**`/`__`/`~~` markers, and an even count of backticks so far. Markers,
 * brackets, and backticks are never spaces, so every space of a run shares
 * the scanner state where the run starts.
 */
function scanWords(rest: string): { words: string[]; safe: boolean[] } {
  const words: string[] = []
  const safe: boolean[] = []
  let brackets = 0
  let markers = 0
  let ticks = 0
  let gapSafe = false
  let word = ''
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]!
    if (ch === ' ') {
      if (word !== '') {
        words.push(word)
        safe.push(gapSafe)
        word = ''
      }
      gapSafe = brackets === 0 && markers % 2 === 0 && ticks % 2 === 0
      continue
    }
    if (ch === '[' || ch === '(') brackets++
    else if (ch === ']' || ch === ')') brackets = Math.max(0, brackets - 1)
    else if (ch === '`') ticks++
    else if (
      (ch === '*' || ch === '_' || ch === '~') &&
      i + 1 < rest.length &&
      rest[i + 1] === ch
    ) {
      markers++
      word += ch + rest[i + 1] // consume both marker characters
      i++
      continue
    }
    word += ch
  }
  if (word !== '') {
    words.push(word)
    safe.push(gapSafe)
  }
  return { words, safe }
}

/**
 * Atomic wrap tokens of one line: words merged across every unsafe gap, so
 * a bracketed link, emphasis run, or inline-code span stays one
 * unsplittable token and may overflow rather than break mid-construct.
 */
function markdownTokens(rest: string): string[] {
  const { words, safe } = scanWords(rest)
  const tokens: string[] = []
  for (let k = 0; k < words.length; k++) {
    if (k > 0 && !safe[k]) tokens[tokens.length - 1] += ` ${words[k]}`
    else tokens.push(words[k]!)
  }
  return tokens
}

/** Greedy word wrap of one prose line; see the module doc for the contract. */
function wrapProseLine(line: string, width: number): string[] {
  if (displayWidth(line) <= width) return [line]
  const lead = /^[ \t]*/.exec(line)![0]
  const words = markdownTokens(line.slice(lead.length))
  const out: string[] = []
  let cur = ''
  // `budget` is the width still available on cur's line. The lead rides
  // only on the first output line, so until the first flush the budget is
  // reduced by the lead width; every later line is flush left with the
  // full budget.
  let budget = width - displayWidth(lead)
  for (const word of words) {
    if (isCjkRun(word) && displayWidth(word) > width) {
      const owesLead = cur === '' && out.length === 0
      const segBudget = owesLead ? width - displayWidth(lead) : width
      if (cur !== '') out.push(cur)
      // All segments but the last are final lines; the last stays open so
      // following words can still append to it if they fit.
      const segments = segmentCjkRun(word, segBudget)
      for (const segment of segments.slice(0, -1)) out.push(segment)
      cur = segments[segments.length - 1] ?? ''
      budget = owesLead && segments.length === 1 ? segBudget : width
      continue
    }
    const candidate = cur === '' ? word : `${cur} ${word}`
    if (displayWidth(candidate) <= budget) {
      cur = candidate
    } else {
      const flushed = cur !== ''
      if (flushed) out.push(cur)
      cur = word // may itself overflow: own line, never split
      budget = flushed ? width : width - displayWidth(lead)
    }
  }
  if (cur !== '') out.push(cur)
  if (out.length === 0) return [line]
  return [lead + (out[0] ?? ''), ...out.slice(1)]
}

/**
 * Wrap the prose lines of source-syntax pipeline text to `opts.width` (see
 * the module doc for the seam). Sentinel-token lines, code/table/compact-box
 * regions, and source-syntax construct lines pass through byte-identical;
 * everything else wraps greedily at markdown-safe spaces.
 */
export function wrapProse(text: string, opts: WrapOptions): string {
  const width = opts.width
  const out: string[] = []
  let inCode = false
  let inTable = false
  let inCompact = false
  for (const line of text.split('\n')) {
    if (SENTINEL_RE.test(line)) {
      out.push(line) // protected fence/URL/inline-code token: never measured, never split
      continue
    }
    if (inTable) {
      if (opts.table.close !== '' && line === opts.table.close) inTable = false
      out.push(line)
      continue
    }
    if (opts.table.open !== '' && line === opts.table.open) {
      inTable = true
      out.push(line)
      continue
    }
    if (isCodeSeparator(line, opts.code)) {
      inCode = !inCode // toggles exactly like the cleanup pass
      out.push(line)
      continue
    }
    if (inCode) {
      out.push(line)
      continue
    }
    if (inCompact) {
      if (line.startsWith('└')) inCompact = false
      out.push(line)
      continue
    }
    if (line.startsWith('┌')) {
      inCompact = true
      out.push(line)
      continue
    }
    if (SOURCE_SKIPS.some((pattern) => pattern.test(line))) {
      out.push(line)
      continue
    }
    out.push(...wrapProseLine(line, width))
  }
  return out.join('\n')
}
