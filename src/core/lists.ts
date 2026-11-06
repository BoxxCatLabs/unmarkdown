/**
 * List transforms.
 *
 * Plain path (`transformPlainLists`): `-`, `*`, and `+` markers render with
 * `bullet` at depth 1 and `bulletNested` at depth ≥ 2, where depth is
 * ⌊indentChars / 2⌋ + 1 (clamped ≥ 1) — the same 2-space grouping the pseudo
 * pass pads with, 1-based. Output indent is always normalized to 2 spaces ×
 * (depth − 1), so odd source indents round down to the enclosing even level.
 * `ordered: 'render'` renumbers sequentially — `1.`, `2.`, … at depth 1,
 * cycling letters `a.`–`z.` at depth ≥ 2, one counter per depth, restarting
 * after any non-blank, non-ordered line; `ordered: 'preserve'` leaves
 * ordered lines byte-identical. Task items (`- [ ]`, `- [x]`, `- [X]`) render
 * the configured glyph at the bullet position.
 *
 * Pseudo path (`transformPseudoLists`): markers normalize to `- `, ordered
 * items keep their number but re-pad to 2 spaces per level (capped at 3),
 * and task items normalize to GFM `[ ]` / `[x]` (lowercased `x`, single
 * spaces).
 *
 * Fenced code never reaches these transforms (protected upstream). All
 * state is call-local: pure functions, deterministic double calls.
 */

/** Structural mirror of the glyph triple (`TaskGlyphs` in options.ts). */
interface TaskGlyphs {
  pending: string
  done: string
  cancelled: string
}

/** Structural slice of `ResolvedOptions` the plain list pass consumes. */
interface PlainListOptions {
  bullet: string
  bulletNested: string
  ordered: 'render' | 'preserve'
  tasks: TaskGlyphs
}

const BULLET_RE = /^([ \t]*)([-*+])[ \t]+(.*)$/
const TASK_RE = /^([ \t]*)([-*+])[ \t]+\[([ xX])\](?:[ \t]+(.*))?$/
const ORDERED_RE = /^([ \t]*)(\d+)\.[ \t]+(.*)$/

/** Depth for an indent string: ⌊chars / 2⌋ + 1, clamped to ≥ 1. */
function indentDepth(indent: string): number {
  return Math.max(1, Math.floor(indent.length / 2) + 1)
}

/** Pseudo level indent: 2 spaces per detected level, capped at 3. */
function pseudoPad(indent: string): string {
  return '  '.repeat(Math.min(Math.floor(indent.length / 2), 3))
}

/** Ordered marker for the n-th depth ≥ 2 item, cycling a–z. */
function letterMarker(n: number): string {
  return `${String.fromCharCode(97 + ((n - 1) % 26))}.`
}

/** Split off a trailing CR so CRLF input round-trips byte-identically. */
function splitCr(line: string): { body: string; cr: string } {
  return line.endsWith('\r') ? { body: line.slice(0, -1), cr: '\r' } : { body: line, cr: '' }
}

/** Normalized output indent: 2 spaces × (depth − 1). */
function normalizedIndent(indent: string): string {
  return '  '.repeat(indentDepth(indent) - 1)
}

export function transformPlainLists(text: string, opts: PlainListOptions): string {
  const orderedCounters: number[] = []
  return text
    .split('\n')
    .map((line) => {
      const { body, cr } = splitCr(line)
      return renderPlainLine(body, opts, orderedCounters) + cr
    })
    .join('\n')
}

function renderPlainLine(line: string, opts: PlainListOptions, counters: number[]): string {
  if (line.trim() === '') return line // blank lines never reset ordered counters

  const task = TASK_RE.exec(line)
  if (task) {
    counters.length = 0
    const glyph = task[3] === ' ' ? opts.tasks.pending : opts.tasks.done
    const suffix = task[4] === undefined ? '' : ` ${task[4]}`
    return `${normalizedIndent(task[1])}${glyph}${suffix}`
  }

  if (opts.ordered === 'render') {
    const ordered = ORDERED_RE.exec(line)
    if (ordered) {
      const depth = indentDepth(ordered[1])
      counters.length = depth + 1 // returning to this depth restarts deeper sublists
      counters[depth] = (counters[depth] ?? 0) + 1
      const marker = depth === 1 ? `${counters[depth]}.` : letterMarker(counters[depth])
      return `${normalizedIndent(ordered[1])}${marker} ${ordered[3]}`
    }
  }

  const bullet = BULLET_RE.exec(line)
  if (bullet) {
    counters.length = 0 // unordered items end any running ordered sequence
    const depth = indentDepth(bullet[1])
    const glyph = depth === 1 ? opts.bullet : opts.bulletNested
    return `${normalizedIndent(bullet[1])}${glyph} ${bullet[3]}`
  }

  counters.length = 0 // prose and other blocks end any running ordered sequence
  return line
}

export function transformPseudoLists(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const { body, cr } = splitCr(line)
      return renderPseudoLine(body) + cr
    })
    .join('\n')
}

function renderPseudoLine(line: string): string {
  const task = TASK_RE.exec(line)
  if (task) {
    const check = task[3] === ' ' ? '[ ]' : '[x]'
    const suffix = task[4] === undefined ? '' : ` ${task[4]}`
    return `${pseudoPad(task[1])}- ${check}${suffix}`
  }
  const bullet = BULLET_RE.exec(line)
  if (bullet) return `${pseudoPad(bullet[1])}- ${bullet[3]}`
  const ordered = ORDERED_RE.exec(line)
  if (ordered) return `${pseudoPad(ordered[1])}${ordered[2]}. ${ordered[3]}`
  return line
}
