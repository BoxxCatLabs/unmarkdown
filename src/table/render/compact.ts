import type { ResolvedOptions } from '../../options'
import { displayWidth } from '../../core/width'
import type { Table } from '../parse'
import { collapseBreaks, renderKeyValue } from './keyValue'

/**
 * Mechanical English plural heuristic for the compact block label:
 * consonant + `y` → `ies`, words ending in `s`/`x`/`z`/`ch`/`sh` → `+es`,
 * everything else → `+s`. Vowel + `y` (`key`, `day`) takes plain `+s`.
 */
export function pluralize(word: string): string {
  if (/[^aeiouAEIOU]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

/**
 * Compact renderer (table strategy `'compact'`): an exactly-2-column table
 * renders as a boxed key-value list instead of numbered records.
 *
 * ```
 * ┌─ Cmds ──────
 *
 * Cmd  ─ a | b
 * Out  ─ c
 *
 * └─────────────
 * ```
 *
 * Box glyphs follow the glyph bundle: `┌`/`└` corners with `─` rules and
 * `─` pair separators under the Unicode bundle, `+` corners with `-` rules
 * and separators under `glyphs: 'ascii'`.
 *
 * The label is `opts.table.twoColumnLabel` when set, else the pluralized
 * first header cell. Each data row contributes one pair per column: the
 * header cell is the key (all keys padded to the widest header), the row
 * cell at the same position is the value; empty or missing cells render
 * as `opts.table.emptyCell` and width never truncates anything. The bottom
 * rule matches the top line's display width (bottom corner + rule repeated
 * `displayWidth(topLine) - 1` times).
 */
export function renderCompact(
  table: Table,
  renderCell: (cell: string) => string,
  opts: ResolvedOptions,
): string {
  if (table.headers.length !== 2) {
    // Compact blocks only make sense for exactly-2-column tables; any other
    // shape (including a forced strategy) falls back to numbered records.
    return renderKeyValue(table, renderCell, opts)
  }

  const headerCell = collapseBreaks(renderCell(table.headers[0] ?? ''))
  const label = opts.table.twoColumnLabel ?? pluralize(headerCell)
  const ascii = opts.glyphs === 'ascii'
  const corner = ascii ? '+' : '┌'
  const bottomCorner = ascii ? '+' : '└'
  const rule = ascii ? '-' : '─'
  const sep = ascii ? '-' : '─'
  const topLine = `${corner}${rule} ${label} ${rule.repeat(6)}`

  const keys = table.headers.map((header) => collapseBreaks(renderCell(header)))
  const maxKeyWidth = keys.reduce((max, key) => Math.max(max, key.length), 0)
  const lines: string[] = []
  for (const row of table.rows) {
    for (let c = 0; c < keys.length; c++) {
      const value = collapseBreaks(renderCell(row[c] ?? ''))
      lines.push(`${keys[c].padEnd(maxKeyWidth)}  ${sep} ${value === '' ? opts.table.emptyCell : value}`)
    }
  }
  const bottom = `${bottomCorner}${rule.repeat(Math.max(0, displayWidth(topLine) - 1))}`

  if (lines.length === 0) return `${topLine}\n\n${bottom}`
  return `${topLine}\n\n${lines.join('\n')}\n\n${bottom}`
}
