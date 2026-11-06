/**
 * Blockquotes (both pipelines): `>`-chains → `opts.quotePrefix` repeated per
 * depth ('bar'); 'preserve' leaves `>` lines raw. Spaces/tabs between
 * markers don't change depth. The resolved `blockquotes` mode decides
 * (plain default 'bar', pseudo default 'preserve').
 */

import type { ResolvedOptions } from '../options'

const QUOTE_RE = /^((?:>[ \t]*)+)(.*)$/gm

export function transformBlockquotes(text: string, opts: ResolvedOptions): string {
  if (opts.blockquotes === 'preserve') return text
  return text.replace(QUOTE_RE, (_match: string, quotes: string, content: string) => {
    const depth = (quotes.match(/>/g) ?? []).length
    return `${opts.quotePrefix.repeat(depth)}${content}`
  })
}
