/**
 * Plain pipeline (`toPlainText`) — presentation format for surfaces that
 * cannot render Markdown at all: headings framed/decorated per level
 * (H1 width-aware `━━`, single line guaranteed), bullets `•`/`◦` with
 * normalized indent, ordered lists re-rendered (`1.`, nested `a.`), task
 * checkboxes as glyphs, blockquotes bar-prefixed `┃`, hrules decorated
 * `─────`, inline code corner-bracketed `『』`, strikethrough stripped,
 * links/images ZWSP-guarded, code fences `┄`-framed, tables rendered as
 * record blocks (auto strategy: compact two-column boxes where they fit).
 */

import type { PlainTextOptions } from './options'
import { runPipeline } from './core/pipeline'
import type { PipelineRules } from './core/pipeline'
import { transformHeadings } from './core/headings'
import { transformPlainLists } from './core/lists'
import { transformBlockquotes } from './core/quotes'
import { plainInlinePass, transformHorizontalRules } from './core/rules'

const PLAIN_RULES: PipelineRules = {
  // Order mirrors the pseudo pipeline: headings → hrules → quotes → lists,
  // so quoted bullets are depth-prefixed before markers normalize.
  transformLines: (text, opts, expand) => {
    return transformPlainLists(
      transformBlockquotes(
        transformHorizontalRules(transformHeadings(text, opts, expand), opts),
        opts,
      ),
      opts,
    )
  },
  transformInline: (text, opts, expand) => plainInlinePass(text, opts, expand),
}

export function toPlainText(input: string, options?: PlainTextOptions): string {
  return runPipeline(input, PLAIN_RULES, 'plain', options)
}
