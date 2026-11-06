/**
 * Pseudo-markdown pipeline (`toPseudoMarkdown`) — for surfaces with native
 * Markdown rendering: headings kept as `## Title`, emphasis normalized and
 * preserved, strikethrough `~~kept~~`, blockquotes `>`-prefixed per depth,
 * hrules normalized to `---`, lists level-normalized; inline code, code
 * fences and links stay verbatim by default, tables render as record blocks
 * (auto strategy).
 */

import type { PlainTextOptions } from './options'
import { runPipeline } from './core/pipeline'
import type { PipelineRules } from './core/pipeline'
import { transformHeadings } from './core/headings'
import { transformPseudoLists } from './core/lists'
import { transformBlockquotes } from './core/quotes'
import { pseudoInlinePass, transformHorizontalRules } from './core/rules'

const PSEUDO_RULES: PipelineRules = {
  transformLines: (text, opts) => {
    return transformPseudoLists(
      transformBlockquotes(transformHorizontalRules(transformHeadings(text, opts), opts), opts),
    )
  },
  transformInline: (text, opts, expand) => pseudoInlinePass(text, opts, expand),
}

export function toPseudoMarkdown(input: string, options?: PlainTextOptions): string {
  return runPipeline(input, PSEUDO_RULES, 'pseudo', options)
}
