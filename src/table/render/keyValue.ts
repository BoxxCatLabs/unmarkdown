import type { ResolvedOptions } from '../../options'
import type { Table } from '../parse'

/**
 * `<br>` variants collapse to a single space, then space runs squeeze and
 * edges trim (docs/plan.md §7.4 step 5). Shared by every table renderer:
 * cells run through renderCell, then this — all before emptiness checks.
 */
export function collapseBreaks(s: string): string {
  return s.replace(/<br\s*\/?>/gi, ' ').replace(/ {2,}/g, ' ').trim()
}

/**
 * Record renderer (table strategy `'record'`): one vertical record per data
 * row, wrapped in the configured frame.
 *
 * ```
 * <open frame>
 *
 * [1] firstCell
 *     Header: Value   ← one pair per line, indented exactly 4 spaces
 *     Header: Value
 *
 * [2] firstCell
 *     ...
 *
 * <close frame>
 * ```
 *
 * Numbering is sequential from 1 in row order; a table with no data rows
 * renders just the frame pair with a single blank line between. Width is
 * never consulted: pairs are never grouped, truncated, or split. An empty
 * header cell falls back to its 1-based column position as the key; an
 * empty value renders as `opts.table.emptyCell`.
 */
export function renderKeyValue(
  table: Table,
  renderCell: (cell: string) => string,
  opts: ResolvedOptions,
): string {
  const columnCount = table.headers.length
  const records: string[] = []

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r] ?? []
    const headingCell = collapseBreaks(renderCell(row[0] ?? ''))
    const lines: string[] = [headingCell === '' ? `[${r + 1}]` : `[${r + 1}] ${headingCell}`]

    for (let c = 1; c < columnCount; c++) {
      const key = collapseBreaks(renderCell(table.headers[c] ?? ''))
      const label = key === '' ? String(c + 1) : key
      const value = collapseBreaks(renderCell(row[c] ?? ''))
      lines.push(`    ${label}: ${value === '' ? opts.table.emptyCell : value}`)
    }

    records.push(lines.join('\n'))
  }

  if (records.length === 0) return `${opts.table.open}\n\n${opts.table.close}`
  return `${opts.table.open}\n\n${records.join('\n\n')}\n\n${opts.table.close}`
}
