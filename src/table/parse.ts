/**
 * GFM pipe-table line parsing.
 *
 * Cells split on unescaped `|` only: `\|` inside a cell is a literal pipe.
 * The fragments left of the first pipe and right of the last pipe are
 * boundary artifacts and are dropped when empty-or-whitespace; interior
 * empty cells are real cells and are preserved.
 */

export interface Table {
  headers: string[]
  rows: string[][]
}

export function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i)
    if (ch === '\\' && line.charAt(i + 1) === '|') {
      // Escaped pipe: literal `|` inside the cell.
      current += '|'
      i++
      continue
    }
    if (ch === '|') {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)

  const first = cells[0]
  if (first !== undefined && first.trim() === '') cells.shift()
  const last = cells[cells.length - 1]
  if (last !== undefined && last.trim() === '') cells.pop()

  return cells.map((cell) => cell.trim())
}

const DELIMITER_CELL = /^:?-+:?$/

/** True for a pipe row whose every cell is a GFM alignment marker (`---`, `:--`, `--:`, `:-:`). */
export function isDelimiterRow(line: string): boolean {
  if (!line.includes('|')) return false
  const cells = splitRow(line)
  return cells.length >= 1 && cells.every((cell) => DELIMITER_CELL.test(cell))
}

/** True for a pipe row: starts with `|` after at most 3 leading spaces (4+ would be indented code). */
export function isPipeRow(line: string): boolean {
  return /^ {0,3}\|/.test(line)
}
