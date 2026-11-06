/**
 * Protect/restore machinery: tokenize URLs, fenced code blocks, and inline
 * code behind sentinel tokens so the Markdown transforms can never touch
 * their contents.
 *
 * Sentinel codepoints are allocated per call from the U+E000–U+E0FF pool,
 * scanning the input first so the chosen sentinels never occur in it. All
 * state lives in the `Protection` value returned by `protectSpans` — no
 * module-level mutable state, every export pure.
 *
 * Tokenization order: fenced code (4+-backtick outer fences first so they
 * win over inner 3-backtick blocks, body verbatim) → inline code → bare
 * URLs. Inline code precedes URL tokenization so a URL inside backticks
 * belongs to the code span (rendered per the inline-code mode) instead of
 * swallowing the closing backtick; unclosed fences never match and pass
 * through raw.
 *
 * `extend` feeds later text (e.g. the expanded output of the table pass)
 * into the SAME span store, so one `restore` pass round-trips every token
 * and no sentinel codepoint can reach the output. The URL character class
 * excludes U+200B so synthesized link guards survive re-tokenization.
 */

import type { ResolvedOptions } from '../options'
import { renderDecoratedCode } from '../code/decorate'

export type ProtectedSpan =
  | { type: 'url'; raw: string }
  | { type: 'inlineCode'; raw: string }
  | { type: 'fence'; raw: string; indent: string; lang: string; body: string }

export interface Protection {
  /** Input with every protected span replaced by a sentinel token. */
  text: string
  /** Tokenize protected-span syntax in `text` into this same store. */
  extend(text: string): string
  /** Expand every token in `text` to renderable content (nested too). */
  expandAll(text: string, opts: ResolvedOptions): string
  /** Restore tokens: fences/inline code honor `opts`, URLs always verbatim. */
  restore(text: string, opts: ResolvedOptions): string
}

interface Sentinels {
  start: string
  sep: string
  end: string
}

// U+200B excluded: it is not JS `\s`, and the link/image decorators wrap
// URLs as `(\u200Burl\u200B)` — re-tokenizing must not swallow the guards.
// The sentinel pool is excluded so a URL running into a code-span token
// (inline code tokenizes first) stops at the token instead of swallowing
// it into the raw — restored raws must never contain sentinel tokens.
const URL_RE = /https?:\/\/[^\s\[\]()\u200B\uE000-\uE0FF]+/g
// Outer fences run before 3-backtick fences: `\2` re-matches the exact tick
// run, so a 4+-backtick fence consumes inner ``` blocks verbatim.
const OUTER_FENCE_RE = /^([ \t]*)(`{4,})\n([\s\S]*?)\n\2[ \t]*$/gm
const FENCE_RE = /^([ \t]*)```([^\n]*)\n([\s\S]*?)```[ \t]*$/gm
const INLINE_CODE_RE = /`([^`\n]+)`/g

const SENTINEL_POOL_START = 0xe000
const SENTINEL_POOL_END = 0xe0ff

const TYPE_CODES: Record<'url' | 'inlineCode' | 'fence', string> = {
  url: 'U',
  inlineCode: 'I',
  fence: 'C',
}

function allocateSentinels(text: string): Sentinels {
  const used = new Set<number>()
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= SENTINEL_POOL_START && code <= SENTINEL_POOL_END) used.add(code)
  }
  const picked: number[] = []
  for (let code = SENTINEL_POOL_START; code <= SENTINEL_POOL_END && picked.length < 3; code++) {
    if (!used.has(code)) picked.push(code)
  }
  if (picked.length < 3) {
    throw new Error(
      'unmarkdown: sentinel pool exhausted — input already uses nearly all U+E000–U+E0FF codepoints',
    )
  }
  return {
    start: String.fromCodePoint(picked[0]),
    sep: String.fromCodePoint(picked[1]),
    end: String.fromCodePoint(picked[2]),
  }
}

export function protectSpans(input: string): Protection {
  const { start, sep, end } = allocateSentinels(input)
  const spans: ProtectedSpan[] = []
  const makeToken = (type: string, index: number): string => `${start}${type}${sep}${index}${end}`

  const tokenize = (subject: string): string => {
    let text = subject

    text = text.replace(OUTER_FENCE_RE, (raw: string, indent: string, _ticks: string, body: string) => {
      spans.push({ type: 'fence', raw, indent, lang: '', body })
      return makeToken(TYPE_CODES.fence, spans.length - 1)
    })

    text = text.replace(FENCE_RE, (raw: string, indent: string, langLine: string, body: string) => {
      spans.push({ type: 'fence', raw, indent, lang: langLine.trim(), body })
      return makeToken(TYPE_CODES.fence, spans.length - 1)
    })

    // Inline code spans are extracted before bare URLs so a URL inside
    // backticks belongs to the span (rendered per the inline-code mode)
    // instead of swallowing the closing backtick as part of the URL.
    text = text.replace(INLINE_CODE_RE, (fullMatch: string, code: string) => {
      spans.push({ type: 'inlineCode', raw: code })
      return makeToken(TYPE_CODES.inlineCode, spans.length - 1)
    })

    text = text.replace(URL_RE, (raw: string) => {
      spans.push({ type: 'url', raw })
      return makeToken(TYPE_CODES.url, spans.length - 1)
    })

    return text
  }

  const allTokenRe = new RegExp(`${start}(?:[UCI])${sep}(\\d+)${end}`, 'g')
  const fenceTokenRe = new RegExp(`${start}C${sep}(\\d+)${end}`, 'g')
  const inlineTokenRe = new RegExp(`${start}I${sep}(\\d+)${end}`, 'g')
  const urlTokenRe = new RegExp(`${start}U${sep}(\\d+)${end}`, 'g')

  const spanAt = (index: string): ProtectedSpan | undefined => spans[Number(index)]

  const renderInlineCode = (span: ProtectedSpan, opts: ResolvedOptions): string => {
    if (opts.inlineCode === 'bracket') return `⦗ ${span.raw} ⦘`
    if (opts.inlineCode === 'corner') return `『${span.raw}』`
    return `\`${span.raw}\``
  }

  const renderFence = (span: ProtectedSpan, opts: ResolvedOptions): string => {
    if (span.type !== 'fence') return span.raw
    return opts.codeBlock === 'verbatim'
      ? span.raw
      : renderDecoratedCode({ indent: span.indent, lang: span.lang, body: span.body }, opts)
  }

  const text = tokenize(input)

  return {
    text,
    extend: tokenize,
    expandAll: (subject: string, opts: ResolvedOptions): string => {
      let out = subject
      // Raw span content is taken before the passes that create later token
      // types and cannot contain sentinel codepoints, so a single pass
      // consumes every token; the loop stays as a safety net for the
      // no-sentinel-leak invariant.
      while (out.includes(start)) {
        const next = out.replace(allTokenRe, (match: string, index: string) => {
          const span = spanAt(index)
          if (!span) return match
          // Inline code renders per the resolved mode (backticks/corner/
          // brackets) so expanded cells keep their inline-code syntax;
          // URLs and fences expand to raw content.
          if (span.type === 'inlineCode') return renderInlineCode(span, opts)
          return span.raw
        })
        if (next === out) break
        out = next
      }
      return out
    },
    restore: (subject: string, opts: ResolvedOptions): string => {
      // Fence → inline → URL order keeps restoration deterministic; raws
      // contain no tokens, so each type expands exactly once.
      let out = subject.replace(fenceTokenRe, (match: string, index: string) => {
        const span = spanAt(index)
        return span && span.type === 'fence' ? renderFence(span, opts) : match
      })
      out = out.replace(inlineTokenRe, (match: string, index: string) => {
        const span = spanAt(index)
        return span && span.type === 'inlineCode' ? renderInlineCode(span, opts) : match
      })
      out = out.replace(urlTokenRe, (match: string, index: string) => {
        const span = spanAt(index)
        return span && span.type === 'url' ? span.raw : match
      })
      return out
    },
  }
}
