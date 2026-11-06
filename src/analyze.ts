/**
 * Pure residual-markdown detection — the stateless replacement for boxxcat's
 * module-level `lastHadMarkdown` side effect. True when the input still
 * contains a heading line, bold, italic, inline code, or unconsumed
 * reference-style markdown: a `[ref]: url` definition line or a
 * `[label][ref]` / `[label][]` use (collapsed form included). No
 * transforms, no state.
 */

const RESIDUAL_MARKDOWN_RE =
  /(^#{1,6}\s+\S|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`|^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S|\[[^\]]+\]\[[^\]]*\])/m

export function analyze(input: string): { hadResidualMarkdown: boolean } {
  if (typeof input !== 'string') return { hadResidualMarkdown: false }
  return { hadResidualMarkdown: RESIDUAL_MARKDOWN_RE.test(input) }
}
