import type { PlainTextOptions, ResolvedOptions } from '../options'
import { resolveOptions } from '../options'
import { applyPlainInline } from '../core/rules'
import { isDelimiterRow, isPipeRow, splitRow } from './parse'
import type { Table } from './parse'
import { renderTable } from './render'

export type { Table }
export { isDelimiterRow, isPipeRow, splitRow }

/** Pad short rows with '' and truncate long rows to the header width (GFM ragged-row behavior). */
function normalizeRow(cells: string[], width: number): string[] {
  const row = cells.slice(0, width)
  while (row.length < width) row.push('')
  return row
}

/**
 * Replace every Markdown table in `text` with its strategy-rendered block
 * (numbered records or a compact two-column box, per `opts.table.strategy`);
 * every other byte is kept identical.
 *
 * A table is a MAXIMAL run of consecutive pipe-rows whose 2nd line is a
 * delimiter row (run length ≥ 2). A pipe-run whose 2nd line is not a
 * delimiter row is not a table and is left untouched. The caller guarantees
 * code fences are already single-line sentinel tokens (never starting with
 * `|`), so no fence handling happens here.
 */
export function decorateTablesInText(
  text: string,
  renderCell: (cell: string) => string,
  opts: ResolvedOptions,
): string {
  if (!opts.table.enabled) return text

  const lines = text.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (!isPipeRow(line)) {
      out.push(line)
      i++
      continue
    }

    // Maximal run of consecutive pipe-rows starting at i.
    let j = i + 1
    while (j < lines.length && isPipeRow(lines[j] ?? '')) j++

    if (j - i >= 2 && isDelimiterRow(lines[i + 1] ?? '')) {
      const headers = splitRow(line)
      const rows: string[][] = []
      for (let k = i + 2; k < j; k++) {
        rows.push(normalizeRow(splitRow(lines[k] ?? ''), headers.length))
      }
      const table: Table = { headers, rows }
      out.push(renderTable(table, renderCell, opts))
    } else {
      // Not a table: emit the whole run verbatim.
      for (let k = i; k < j; k++) out.push(lines[k] ?? '')
    }
    i = j
  }
  return out.join('\n')
}

/**
 * Standalone entry: decorate `input` only when it parses as exactly one
 * table (all lines pipe-rows, 2nd line a delimiter row); otherwise return
 * the original input unchanged. Cells run through the plain-path inline
 * pass (link/image decoration, emphasis stripping, plain-path strikethrough
 * and inline-code styles, `\"` unescape); the block layout follows
 * `opts.table.strategy` exactly like the in-text path.
 */
export function decorateTable(input: string, userOpts?: PlainTextOptions): string {
  if (typeof input !== 'string' || input.trim() === '') return ''

  const opts = resolveOptions('plain', userOpts)
  const trimmed = input.trim()
  const lines = trimmed.split('\n')
  if (lines.length < 2 || !lines.every((l) => isPipeRow(l)) || !isDelimiterRow(lines[1] ?? '')) {
    return input
  }

  const headers = splitRow(lines[0] ?? '')
  const rows = lines.slice(2).map((l) => normalizeRow(splitRow(l), headers.length))
  return renderTable({ headers, rows }, (cell) => applyPlainInline(cell, opts), opts)
}
