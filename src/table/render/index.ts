import type { ResolvedOptions } from '../../options'
import type { Table } from '../parse'
import { renderKeyValue } from './keyValue'
import { renderCompact } from './compact'

export type TableRenderer = (
  table: Table,
  renderCell: (cell: string) => string,
  opts: ResolvedOptions,
) => string

/** Presentation strategies; add new ones here without touching block-level detection. */
export const tableRenderers: { keyValue: TableRenderer; compact: TableRenderer } = {
  keyValue: renderKeyValue,
  compact: renderCompact,
}

/**
 * Strategy selection: `'record'` forces numbered records; `'compact'`
 * forces the compact block; `'auto'` picks compact exactly when the table
 * has two columns. The compact renderer itself falls back to records for
 * non-2-column shapes, so a forced `'compact'` strategy degrades safely.
 */
export function selectTableRenderer(table: Table, opts: ResolvedOptions): TableRenderer {
  if (opts.table.strategy === 'record') return tableRenderers.keyValue
  if (opts.table.strategy === 'compact') return tableRenderers.compact
  return table.headers.length === 2 ? tableRenderers.compact : tableRenderers.keyValue
}

/** Render `table` with the renderer selected by `opts.table.strategy`. */
export function renderTable(
  table: Table,
  renderCell: (cell: string) => string,
  opts: ResolvedOptions,
): string {
  return selectTableRenderer(table, opts)(table, renderCell, opts)
}
