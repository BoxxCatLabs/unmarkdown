/**
 * Staged orchestration shared by both pipelines:
 * normalize → guard → protect → table pass → wrap → line pass → inline pass →
 * restore → cleanup. The pipelines differ only in the rule set bound at the
 * line/inline stages (`PipelineRules`).
 *
 * There is exactly one protection store per call: after the table pass
 * expands cells to raw text, `protection.extend` re-tokenizes the new URLs
 * and inline code into that same store, so the single final `restore`
 * round-trips every token and no sentinel codepoint can leak.
 *
 * `opts.wrap` is resolved and stored on the options; when enabled (plain
 * pipeline default), the text is width-wrapped right after the table pass
 * and `protection.extend`, BEFORE the line/inline passes — i.e. on
 * source-syntax text: fenced code, URLs, and inline code are still sentinel
 * tokens (skipped whole), tables are already decorated (region-skipped),
 * and headings/lists/quotes are still source Markdown (skipped by source
 * syntax, so a heading degraded to its bare title by core/headings.ts can
 * never be mistaken for prose and every heading stays exactly one row).
 * Widths measure raw source text — a conservative budget. The whitespace
 * cleanup at the very end never reflows lines.
 */

import { resolveOptions } from '../options'
import type { PlainTextOptions, PipelineName, ResolvedOptions } from '../options'
import { decorateTablesInText } from '../table'
import { isUsableInput, normalizeLineEndings } from './normalize'
import { protectSpans } from './protect'
import { cleanupWhitespace, unescapeQuotes } from './rules'
import type { ExpandTokens } from './rules'
import { wrapProse } from './wrap'

export interface PipelineRules {
  /** Block-level pass over the whole text (headings, lists, quotes, rules). */
  transformLines(text: string, opts: ResolvedOptions, expand: ExpandTokens): string
  /** Single-line pass (images, links, emphasis, strikethrough). */
  transformInline(text: string, opts: ResolvedOptions, expand: ExpandTokens): string
}

export function runPipeline(
  input: unknown,
  rules: PipelineRules,
  pipeline: PipelineName,
  user?: PlainTextOptions,
): string {
  if (!isUsableInput(input)) return ''
  const opts = resolveOptions(pipeline, user)
  const protection = protectSpans(normalizeLineEndings(input))
  const expand: ExpandTokens = (subject: string): string => protection.expandAll(subject, opts)

  let result = protection.text

  if (opts.table.enabled) {
    // Cells run the pipeline's inline pass, then tokens expand to renderable
    // content (URLs raw, inline code per mode) so the record renderer
    // measures and emits real text.
    const renderCell = (cell: string): string => {
      return protection.expandAll(rules.transformInline(cell, opts, expand), opts)
    }
    result = decorateTablesInText(result, renderCell, opts)
    result = protection.extend(result)
  }

  // Width-aware prose wrapping (plain only; pseudo resolves wrap:false and
  // never wraps). Runs BEFORE the line/inline passes, on source-syntax
  // text: sentinel tokens (fenced code/URLs/inline code) and decorated
  // table regions skip whole; headings/lists/quotes still carry their
  // source syntax, so a bare degraded heading is never mistaken for prose.
  if (pipeline === 'plain' && opts.wrap) result = wrapProse(result, opts)
  result = rules.transformLines(result, opts, expand)
  result = rules.transformInline(result, opts, expand)
  result = protection.restore(result, opts)
  result = unescapeQuotes(result)
  return cleanupWhitespace(result, opts.code)
}
