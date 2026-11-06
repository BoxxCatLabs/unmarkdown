/**
 * Heading transforms, shared by both pipelines.
 *
 * Modes (from resolved options):
 * - `decorate` (plain default): per-level styles drive the output. The title
 *   is first normalized per the resolved inline transforms (feedback rule 8:
 *   `normalizeInlineMarkdown` — emphasis stripped, inline code per
 *   `inlineCode` mode, links/images per `links` mode, strikethrough per
 *   mode) so measuring and framing size the decorated text. A level with a
 *   non-empty `frame` is framed with symmetric runs capped at 4 per side
 *   and floored at 2 (`━━━━ Getting Started ━━━━`; shrink toward 2 as the
 *   width tightens); otherwise `prefix + title + suffix`
 *   (`【 Title 】`, `◆ Title`). Decorations that do not fit degrade to the
 *   bare title — a non-empty heading is never wrapped, truncated, or dropped.
 * - `preserve` (pseudo default): `#{n} Title` kept, whitespace normalized to
 *   exactly one separator space and a trimmed title; inline Markdown stays
 *   verbatim — no normalization, no measuring.
 *
 * Edge behavior (unchanged): empty/whitespace-only titles drop the whole
 * line; more than six hash marks is not a heading; depths beyond
 * `headingDepth` pass through undecorated; a `#` not at line start or not
 * followed by a separator never matches.
 */

import { displayWidth } from './width'
import { normalizeInlineMarkdown } from './rules'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

/** Per-level style (optional fields; resolved options provide concrete values). */
export interface HeadingStyle {
  prefix?: string
  suffix?: string
  frame?: string
}

/**
 * Structural mirror of the `ResolvedOptions` slice the heading pass consumes
 * — the four inline-transform modes feed rule-8 title normalization, so any
 * resolved options object satisfies it and no import from options internals
 * is required.
 */
export interface HeadingOptions {
  headingMode: 'decorate' | 'preserve'
  headingDepth: number
  width: number
  headings: Record<HeadingLevel, HeadingStyle>
  inlineCode: 'verbatim' | 'corner' | 'bracket'
  strikethrough: 'strip' | 'brackets' | 'overline' | 'preserve'
  links: 'decorated' | 'urlOnly' | 'verbatim'
  guardUrlParens: boolean
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/gm

function renderDecorated(title: string, style: HeadingStyle, width: number): string {
  const frame = style.frame ?? ''
  if (frame !== '') {
    const t = displayWidth(title)
    // Owner-directed frame budget (2026-11-04): each side's run is capped at
    // 4 and floored at 2 — prefer 4 per side while the decorated heading
    // fits the resolved width, shrink toward the 2-per-side floor as the
    // budget tightens, and degrade to the bare title when even 2 per side
    // (t + 2 spaces + 4 frame cols) overflows. The heading never wraps or
    // truncates either way.
    if (t + 6 > width) return title
    const k = Math.min(4, Math.floor((width - t - 2) / 2))
    return `${frame.repeat(k)} ${title} ${frame.repeat(k)}`
  }
  const decorated = `${style.prefix ?? ''}${title}${style.suffix ?? ''}`
  return displayWidth(decorated) <= width ? decorated : title
}

export function transformHeadings(
  text: string,
  opts: HeadingOptions,
  expand?: (text: string) => string,
): string {
  return text.replace(HEADING_RE, (line: string, marks: string, content: string) => {
    if (marks.length > opts.headingDepth) return line
    const title = content.trim()
    if (title === '') return ''
    if (opts.headingMode === 'preserve') return `${marks} ${title}`
    const style = opts.headings[marks.length as HeadingLevel] ?? {}
    // Rule 8: normalize, then resolve any remaining sentinel tokens so
    // measuring, framing, and emission all see real rendered text (a
    // link-titled H1 frames on the decorated width, not a token width).
    let rendered = normalizeInlineMarkdown(title, opts, expand)
    if (expand) rendered = expand(rendered)
    return renderDecorated(rendered, style, opts.width)
  })
}
