/**
 * Inline and cleanup rules shared by both pipelines, plus the per-pipeline
 * composites (`plainInlinePass`, `pseudoInlinePass`, `applyPlainInline`).
 *
 * Inline order: reference defs/uses → images → links → emphasis →
 * strikethrough. Protected sentinel tokens pass through every rule
 * untouched; the `expand` callback resolves tokens to raw content where a
 * rule must compare text against a URL (link-text ≡ URL detection).
 */

import type { CodeFrameOptions, ResolvedOptions } from '../options'
import { isCodeSeparator } from '../code/decorate'

export type ExpandTokens = (text: string) => string

// --- horizontal rules ------------------------------------------------------

const HRULE_RE = /^[ \t]{0,3}([-*_])[ \t]*\1[ \t]*\1(?:[ \t]*\1)*[ \t]*$/gm

/**
 * `---` / `***` / `___` runs (≥3, ≤3 leading spaces): 'decorate' →
 * `opts.hrule`; 'preserve' → normalized `---` (three dashes) regardless of
 * the source marker character.
 */
export function transformHorizontalRules(text: string, opts: ResolvedOptions): string {
  return text.replace(HRULE_RE, opts.hruleMode === 'preserve' ? '---' : opts.hrule)
}

// --- emphasis ---------------------------------------------------------------

/** Plain path: bold/italic stripped to their content. */
export function stripEmphasis(text: string): string {
  return text.replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2')
}

/** Pseudo path: emphasis delimiters normalized and preserved. */
export function normalizeEmphasis(text: string): string {
  return text
    .replace(/(\*\*\*|___)(.*?)\1/g, '***$2***')
    .replace(/(\*\*|__)(.*?)\1/g, '**$2**')
    .replace(/(?<!\*)(\*|_)(.*?)\1(?!\*)/g, '*$2*')
}

// --- strikethrough ----------------------------------------------------------

/** Plain default: `~~x~~` → bare content. */
export function strikeStripped(text: string): string {
  return text.replace(/~~+(.*?)~~+/g, '$1')
}

/** `~~x~~` → `[x]`. */
export function strikeWithBrackets(text: string): string {
  return text.replace(/~~(.*?)~~/g, '[$1]')
}

/** `~~x~~` → every content char followed by U+0336. */
export function strikeWithOverline(text: string): string {
  return text.replace(/~~(.*?)~~/g, (_match: string, content: string) => {
    return content
      .split('')
      .map((c) => c + '\u0336')
      .join('')
  })
}

/** Pseudo default: tilde runs normalized to exactly `~~x~~`. */
export function strikePreserved(text: string): string {
  return text.replace(/~~+(.*?)~~+/g, '~~$1~~')
}

/**
 * Strikethrough dispatch on the resolved option (per-pipeline defaults
 * applied in `resolveOptions`, explicit override wins on both pipelines):
 * 'strip' → bare content, 'brackets' → `[content]`, 'overline' → U+0336
 * after every char, 'preserve' → normalized `~~content~~`.
 */
export function transformStrikethrough(text: string, opts: Pick<ResolvedOptions, 'strikethrough'>): string {
  switch (opts.strikethrough) {
    case 'strip':
      return strikeStripped(text)
    case 'overline':
      return strikeWithOverline(text)
    case 'preserve':
      return strikePreserved(text)
    default:
      return strikeWithBrackets(text)
  }
}

// --- reference-style links -----------------------------------------------------

/**
 * Paragraph-standalone definition lines: up to three leading spaces, then
 * `[ref]: url` with an optional `"title"` / `'title'` / `(title)` tail. The
 * match includes the trailing newline so removing it takes the whole line.
 * Code spans/fences are sentinel tokens by this point and never match.
 */
const REF_DEF_RE =
  /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*(\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*(?:\n|$)/gm

/** Full `[label][ref]` and collapsed `[label][]` uses (ref defaults to label). */
const REF_USE_RE = /\[([^\]]+)\]\[([^\]]*)\]/g

/** Reference keys match case-insensitively with collapsed internal whitespace. */
function refKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface RefLinkTable {
  /** Input with every definition line removed. */
  text: string
  /** Normalized ref key → destination (raw text or a URL sentinel token). */
  urls: Map<string, string>
}

/**
 * Collect `[ref]: url` definition lines and consume them (removed from the
 * text wherever they appear); the optional title tail is dropped — resolved
 * links render exactly like inline links, which carry no title.
 */
export function consumeRefDefinitions(text: string): RefLinkTable {
  const urls = new Map<string, string>()
  const stripped = text.replace(REF_DEF_RE, (_match: string, label: string, url: string) => {
    urls.set(refKey(label), url)
    return ''
  })
  return { text: stripped, urls }
}

/**
 * Rewrite resolved `[label][ref]` / `[label][]` uses into the equivalent
 * inline `[label](url)` form, so the active links mode renders them exactly
 * like inline links. Unresolved uses pass through verbatim. Repeated uses
 * of one definition each render their destination inline — the definition
 * itself is never duplicated.
 */
export function resolveRefLinks(text: string, urls: Map<string, string>): string {
  return text.replace(REF_USE_RE, (match: string, label: string, ref: string) => {
    const url = urls.get(refKey(ref || label))
    return url === undefined ? match : `[${label}](${url})`
  })
}

/** Consume definition lines, then resolve uses; run first in inline passes. */
export function resolveReferences(text: string): RefLinkTable {
  const { text: withoutDefs, urls } = consumeRefDefinitions(text)
  return { text: resolveRefLinks(withoutDefs, urls), urls }
}

// --- links & images ---------------------------------------------------------

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g
const LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g

/** ZWSP between each paren and the URL so mobile auto-linkers keep the `)`. */
function guardUrl(url: string, opts: Pick<ResolvedOptions, 'guardUrlParens'>): string {
  return opts.guardUrlParens ? `\u200B${url}\u200B` : url
}

/**
 * Images follow the resolved `links` mode: `decorated` (plain default)
 * renders `alt (\u200Burl\u200B)` — empty/whitespace alt → bare URL — with
 * the guard honoring `opts.guardUrlParens`; `urlOnly` → bare URL;
 * `verbatim` (pseudo default) leaves the raw `![alt](url)` syntax untouched.
 * The URL is usually a sentinel token here — the guard wraps around it and
 * expands to sit between paren and raw URL at restore time.
 */
export function transformImages(
  text: string,
  opts: Pick<ResolvedOptions, 'links' | 'guardUrlParens'>,
  expand: ExpandTokens,
): string {
  if (opts.links === 'verbatim') return text
  return text.replace(IMAGE_RE, (_match: string, alt: string, url: string) => {
    if (opts.links === 'urlOnly') return url
    if (expand(alt).trim() === '') return url
    return `${alt} (${guardUrl(url, opts)})`
  })
}

/**
 * Decorated links (plain default): `[text](url)` → `text (\u200Burl\u200B)`;
 * when text ≡ url → bare URL (no parens, no guard). `urlOnly` → bare URL;
 * `verbatim` (pseudo default) → untouched.
 */
export function transformLinks(
  text: string,
  opts: Pick<ResolvedOptions, 'links' | 'guardUrlParens'>,
  expand: ExpandTokens,
): string {
  if (opts.links === 'verbatim') return text
  return text.replace(LINK_RE, (_match: string, linkText: string, url: string) => {
    if (opts.links === 'urlOnly') return url
    if (expand(linkText).trim() === expand(url).trim()) return url
    return `${linkText} (${guardUrl(url, opts)})`
  })
}

// --- escapes & cleanup -------------------------------------------------------

export function unescapeQuotes(text: string): string {
  return text.replace(/\\"/g, '"')
}

export function cleanupWhitespace(text: string, code?: CodeFrameOptions): string {
  // Split into lines and mask decorated-code regions (┄ separators): blank
  // runs inside code bodies are content and must survive the collapse.
  const src = text.split('\n')
  const kept: string[] = []
  let inCode = false
  let blanks = 0
  for (const line of src) {
    if (code !== undefined && isCodeSeparator(line, code)) {
      inCode = !inCode
      blanks = 0
      kept.push(line)
      continue
    }
    if (inCode) {
      kept.push(line)
      continue
    }
    if (line.trim() === '') {
      blanks++
      if (blanks <= 1) kept.push(line)
      continue
    }
    blanks = 0
    kept.push(line)
  }
  let out = kept.join('\n')
  out = out.replace(/^\s*\n/, '')
  // Leading blank lines are decoration; a ≥4-space indent on the first
  // content line is an indented code block and survives as content (tabs
  // are not code-block indents here — legacy trim behavior keeps tab-indented
  // first lines trimmed). Trailing whitespace always trims.
  if (!/^ {4}/.test(out)) out = out.replace(/^[ \t]+/, '')
  return out.trimEnd()
}

// --- per-pipeline composites --------------------------------------------------

const identity: ExpandTokens = (text) => text

// --- heading-title normalization (feedback rule 8) ----------------------------

/**
 * Raw inline code spans render per the resolved mode. Only reachable where
 * spans were never protected (unit seam, unpaired leftovers); in the pipeline
 * `protect.ts` tokenizes pairs first and restores tokens the same way at the
 * end, so this never double-renders.
 */
const RAW_INLINE_CODE_RE = /`([^`\n]+)`/g

function renderRawInlineCode(code: string, mode: ResolvedOptions['inlineCode']): string {
  if (mode === 'bracket') return `⦗ ${code} ⦘`
  if (mode === 'corner') return `『${code}』`
  return `\`${code}\``
}

/**
 * Rule 8 (docs/unmarkdown-feedback.md §2.1): normalize inline Markdown in a
 * heading title BEFORE measuring and framing — inline code renders per the
 * resolved `inlineCode` mode (corner → `『x』`), images/links render per the
 * resolved `links` mode incl. `guardUrlParens` ZWSP guards, emphasis is
 * stripped to its content, strikethrough applies per mode. The later
 * pipeline inline pass is a no-op on the result: no Markdown markers remain,
 * and rendered `『x』` cannot re-match the code/link regexes. Protected
 * sentinel tokens (URLs, code spans in the live pipeline) pass through the
 * marker regexes untouched and keep rendering at restore time. Reference
 * resolution is deliberately not applied: a heading title is never
 * reference-definition context, and consuming `[ref]: url` in isolation
 * would drop content.
 */
export function normalizeInlineMarkdown(
  text: string,
  opts: Pick<ResolvedOptions, 'inlineCode' | 'strikethrough' | 'links' | 'guardUrlParens'>,
  expand: ExpandTokens = identity,
): string {
  const withCode = text.replace(RAW_INLINE_CODE_RE, (_match: string, code: string) =>
    renderRawInlineCode(code, opts.inlineCode),
  )
  return transformStrikethrough(stripEmphasis(transformLinks(transformImages(withCode, opts, expand), opts, expand)), opts)
}

export function plainInlinePass(text: string, opts: ResolvedOptions, expand: ExpandTokens = identity): string {
  const { text: withRefs } = resolveReferences(text)
  return transformStrikethrough(stripEmphasis(transformLinks(transformImages(withRefs, opts, expand), opts, expand)), opts)
}

export function pseudoInlinePass(text: string, opts: ResolvedOptions, expand: ExpandTokens = identity): string {
  const { text: withRefs } = resolveReferences(text)
  return transformStrikethrough(normalizeEmphasis(transformLinks(transformImages(withRefs, opts, expand), opts, expand)), opts)
}

/**
 * Plain-path inline pass incl. `\"` unescape — the entry the table
 * decorator uses for cell preprocessing (standalone table input carries no
 * sentinel tokens, so the identity expander is correct there).
 */
export function applyPlainInline(text: string, opts: ResolvedOptions): string {
  return unescapeQuotes(plainInlinePass(text, opts))
}
