/**
 * Table decorator suite — strategy-selected rendering. `'record'` renders
 * numbered vertical records; `'compact'` renders exactly-2-column tables as
 * a boxed key-value list; `'auto'` (the default) picks compact for two
 * columns and records otherwise. Every expectation below is an inline
 * literal byte-exact with the renderer contract — no runtime doc reads.
 */

import { describe, expect, test } from 'vitest'
import { DEFAULT_TABLE_OPTIONS, decorateTable, toPlainText, toPseudoMarkdown } from '../src/index.js'
import { splitRow } from '../src/table/parse.js'
import { pluralize } from '../src/table/render/compact.js'

const OPEN = '════════ ✧･ﾟ ════════'
const CLOSE = '════════ ✧･ﾟ ════════'

const j = (...lines: string[]): string => lines.join('\n')

describe('record renderer (strategy \'record\')', () => {
  test('contract example: 3-row task table renders byte-exact record block', () => {
    const out = toPlainText(
      j(
        '| Task | Status | Priority | Owner |',
        '| --- | --- | --- | --- |',
        '| Authentication | Done | High | Shane |',
        '| Notifications | In Progress | Medium | Alex |',
        '| Billing | Blocked | High | John |',
      ),
    )
    expect(out).toBe(
      j(
        OPEN,
        '',
        '[1] Authentication',
        '    Status: Done',
        '    Priority: High',
        '    Owner: Shane',
        '',
        '[2] Notifications',
        '    Status: In Progress',
        '    Priority: Medium',
        '    Owner: Alex',
        '',
        '[3] Billing',
        '    Status: Blocked',
        '    Priority: High',
        '    Owner: John',
        '',
        CLOSE,
      ),
    )
  })

  test('one pair per line at the default 40 width — no ` | ` grouping', () => {
    const headers = '| ' + Array.from({ length: 11 }, (_, i) => `C${i + 1}`).join(' | ') + ' |'
    const delimiter = '| ' + Array.from({ length: 11 }, () => '---').join(' | ') + ' |'
    const out = toPlainText(
      j(headers, delimiter, '| a | bb | c | d | e | f | g | h | i | j | k |'),
    )
    expect(out).toBe(
      j(
        OPEN,
        '',
        '[1] a',
        '    C2: bb',
        '    C3: c',
        '    C4: d',
        '    C5: e',
        '    C6: f',
        '    C7: g',
        '    C8: h',
        '    C9: i',
        '    C10: j',
        '    C11: k',
        '',
        CLOSE,
      ),
    )
    for (const line of out.split('\n')) expect(line).not.toContain(' | ')
  })

  test('forced record strategy renders 2-column tables as numbered records', () => {
    const out = toPlainText(
      j('| A | B |', '| --- | --- |', '| 1 | 2 |'),
      { table: { strategy: 'record' } },
    )
    expect(out).toBe(j(OPEN, '', '[1] 1', '    B: 2', '', CLOSE))
  })

  test('single-column table: records are `[n] value` headings only, no pairs', () => {
    const out = toPlainText(j('| A |', '| --- |', '| x |', '| y |'))
    expect(out).toBe(j(OPEN, '', '[1] x', '', '[2] y', '', CLOSE))
  })

  test('no data rows: frame pair with a single blank line between', () => {
    const out = toPlainText(j('| A | B | C |', '| --- | --- | --- |'))
    expect(out).toBe(j(OPEN, '', CLOSE))
    expect(out.split('\n')).toHaveLength(3)
  })

  test('empty header cell: fallback key is the 1-based column position', () => {
    const out = toPlainText(
      j('| Name | | Note |', '| --- | --- | --- |', '| r1 | val | n |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] r1', '    2: val', '    Note: n', '', CLOSE))
  })

  test('empty first header: headings come from the cell, pairing still works', () => {
    const out = toPlainText(
      j(
        '| | Alpha | Beta |',
        '| --- | --- | --- |',
        '| 1 | x | x1 |',
        '| 2 | | y |',
      ),
    )
    expect(out).toBe(
      j(
        OPEN,
        '',
        '[1] 1',
        '    Alpha: x',
        '    Beta: x1',
        '',
        '[2] 2',
        '    Alpha: (empty)',
        '    Beta: y',
        '',
        CLOSE,
      ),
    )
  })

  test('empty cells render as (empty); table.emptyCell is customizable', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| one | | |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] one', '    B: (empty)', '    C: (empty)', '', CLOSE))

    const custom = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| one | | |'),
      { table: { emptyCell: '—' } },
    )
    expect(custom).toBe(j(OPEN, '', '[1] one', '    B: —', '    C: —', '', CLOSE))
  })

  test('very long values are never truncated or split', () => {
    const long = 'x'.repeat(120)
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| v | ' + long + ' | w |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] v', '    B: ' + long, '    C: w', '', CLOSE))
    expect(out).toContain(long)
    for (const line of out.split('\n')) {
      expect(line).not.toContain('…')
    }
  })

  test('headers with spaces and punctuation are preserved verbatim as labels', () => {
    const out = toPlainText(
      j(
        '| A | Task #1 (urgent)! | a-b:c |',
        '| --- | --- | --- |',
        '| v | fix | now |',
      ),
    )
    expect(out).toBe(
      j(OPEN, '', '[1] v', '    Task #1 (urgent)!: fix', '    a-b:c: now', '', CLOSE),
    )
  })

  test('markdown in cells flows through the cell pipeline: bold stripped, inline code cornered', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| **bold** | x | y |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] bold', '    B: x', '    C: y', '', CLOSE))

    const code = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| v | `x` | y |'),
    )
    expect(code).toBe(j(OPEN, '', '[1] v', '    B: 『x』', '    C: y', '', CLOSE))
  })

  test('escaped pipes stay one cell: `a \\| b` renders as `a | b`', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| a \\| b | c | d |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] a | b', '    B: c', '    C: d', '', CLOSE))
  })

  test('<br> variants collapse to a single space', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| l1<br>l2 | l3<br/>l4 | x |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] l1 l2', '    B: l3 l4', '    C: x', '', CLOSE))

    const spaced = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| l1<br />l2 | v | w |'),
    )
    expect(spaced).toBe(j(OPEN, '', '[1] l1 l2', '    B: v', '    C: w', '', CLOSE))
  })

  test('a <br>-only cell becomes (empty) / the [n] fallback heading', () => {
    const cell = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| <br> | value | v3 |'),
    )
    expect(cell).toBe(j(OPEN, '', '[1]', '    B: value', '    C: v3', '', CLOSE))

    const value = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| v1 | <br> | v3 |'),
    )
    expect(value).toBe(j(OPEN, '', '[1] v1', '    B: (empty)', '    C: v3', '', CLOSE))

    const header = toPlainText(
      j('| A | <br> | C |', '| --- | --- | --- |', '| v1 | v2 | v3 |'),
    )
    expect(header).toBe(j(OPEN, '', '[1] v1', '    2: v2', '    C: v3', '', CLOSE))
  })

  test('unicode cells are preserved verbatim (CJK, emoji, combining marks)', () => {
    const out = toPlainText(
      j('| 항목 | 상태 | 비고 |', '| --- | --- | --- |', '| 설정 😀 | 완료 ✅ | ok |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] 설정 😀', '    상태: 완료 ✅', '    비고: ok', '', CLOSE))

    const combining = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| cafe\u0301 | ok | ok |'),
    )
    expect(combining).toContain('cafe\u0301')
  })

  test('ragged rows: short rows padded with (empty), long rows truncated to header width', () => {
    const out = toPlainText(
      j(
        '| A | B | C |',
        '| --- | --- | --- |',
        '| one | two |',
        '| u |',
        '| x | y | z | extra | dropme |',
      ),
    )
    expect(out).toBe(
      j(
        OPEN,
        '',
        '[1] one',
        '    B: two',
        '    C: (empty)',
        '',
        '[2] u',
        '    B: (empty)',
        '    C: (empty)',
        '',
        '[3] x',
        '    B: y',
        '    C: z',
        '',
        CLOSE,
      ),
    )
  })

  test('numbering stays sequential across ragged and empty-first-cell rows', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| r1 |', '| r2 | x |', '| | z |'),
    )
    expect(out).toBe(
      j(
        OPEN,
        '',
        '[1] r1',
        '    B: (empty)',
        '    C: (empty)',
        '',
        '[2] r2',
        '    B: x',
        '    C: (empty)',
        '',
        '[3]',
        '    B: z',
        '    C: (empty)',
        '',
        CLOSE,
      ),
    )
  })
})

describe('compact renderer (two-column tables)', () => {
  test('contract example: | Property | Value | renders the compact block byte-exact', () => {
    const out = toPlainText(
      j(
        '| Property | Value |',
        '| --- | --- |',
        '| Version | 1.2.0 |',
        '| License | MIT |',
        '| Runtime | Node.js |',
      ),
    )
    expect(out).toBe(
      j(
        '┌─ Properties ──────',
        '',
        'Property  ─ Version',
        'Value     ─ 1.2.0',
        'Property  ─ License',
        'Value     ─ MIT',
        'Property  ─ Runtime',
        'Value     ─ Node.js',
        '',
        '└───────────────────',
      ),
    )
  })

  test('keys are padded to the widest key with `  ─ ` before each value', () => {
    const out = toPlainText(
      j('| Property | Value |', '| --- | --- |', '| A | 1 |', '| BBBB | 2 |'),
    )
    expect(out).toBe(
      j(
        '┌─ Properties ──────',
        '',
        'Property  ─ A',
        'Value     ─ 1',
        'Property  ─ BBBB',
        'Value     ─ 2',
        '',
        '└───────────────────',
      ),
    )
  })

  test('auto strategy picks compact for exactly two columns and record for three', () => {
    const two = toPlainText(j('| A | B |', '| --- | --- |', '| k | v |'))
    expect(two).toBe(j('┌─ As ──────', '', 'A  ─ k', 'B  ─ v', '', '└───────────'))

    const three = toPlainText(j('| A | B | C |', '| --- | --- | --- |', '| k | v | w |'))
    expect(three).toBe(j(OPEN, '', '[1] k', '    B: v', '    C: w', '', CLOSE))
  })

  test('forced compact strategy matches auto for 2-column tables and falls back for others', () => {
    const forced = toPlainText(
      j('| Property | Value |', '| --- | --- |', '| Version | 1.2.0 |'),
      { table: { strategy: 'compact' } },
    )
    expect(forced).toBe(j('┌─ Properties ──────', '', 'Property  ─ Version', 'Value     ─ 1.2.0', '', '└───────────────────'))

    const forcedWide = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| k | v | w |'),
      { table: { strategy: 'compact' } },
    )
    expect(forcedWide).toBe(j(OPEN, '', '[1] k', '    B: v', '    C: w', '', CLOSE))
  })

  test('custom twoColumnLabel overrides the pluralized header', () => {
    const out = toPlainText(
      j('| Property | Value |', '| --- | --- |', '| Version | 1.2.0 |'),
      { table: { twoColumnLabel: 'Specs' } },
    )
    expect(out).toBe(j('┌─ Specs ──────', '', 'Property  ─ Version', 'Value     ─ 1.2.0', '', '└──────────────'))
  })

  test('empty values render as (empty) in compact blocks', () => {
    const out = toPlainText(
      j('| Property | Value |', '| --- | --- |', '| License | |'),
    )
    expect(out).toBe(j('┌─ Properties ──────', '', 'Property  ─ License', 'Value     ─ (empty)', '', '└───────────────────'))
  })

  test('no data rows: compact block is top frame, blank line, bottom frame', () => {
    const out = toPlainText(j('| Property | Value |', '| --- | --- |'))
    expect(out).toBe(j('┌─ Properties ──────', '', '└───────────────────'))
  })
})

describe('two-column label pluralization', () => {
  test('pluralize: consonant+y → ies, s/x/z/ch/sh → +es, else +s', () => {
    expect(pluralize('property')).toBe('properties')
    expect(pluralize('entry')).toBe('entries')
    expect(pluralize('box')).toBe('boxes')
    expect(pluralize('match')).toBe('matches')
    expect(pluralize('bus')).toBe('buses')
    expect(pluralize('key')).toBe('keys')
    expect(pluralize('day')).toBe('days')
    expect(pluralize('task')).toBe('tasks')
  })

  test('pluralized labels surface in rendered compact blocks', () => {
    const entry = toPlainText(j('| Entry | Value |', '| --- | --- |', '| e1 | v |'))
    expect(entry).toBe(j('┌─ Entries ──────', '', 'Entry  ─ e1', 'Value  ─ v', '', '└────────────────'))

    const box = toPlainText(j('| Box | Value |', '| --- | --- |', '| b1 | v |'))
    expect(box).toBe(j('┌─ Boxes ──────', '', 'Box    ─ b1', 'Value  ─ v', '', '└──────────────'))
  })
})

describe('table frames and pipeline wiring', () => {
  test('DEFAULT_TABLE_OPTIONS frames match the contract glyphs byte-for-byte', () => {
    expect(DEFAULT_TABLE_OPTIONS.open).toBe(OPEN)
    expect(DEFAULT_TABLE_OPTIONS.close).toBe(CLOSE)
  })

  test('custom table.open / table.close replace the frame', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| 1 | 2 | 3 |'),
      { table: { open: '<<TABLE', close: 'TABLE>>' } },
    )
    expect(out).toBe('<<TABLE\n\n[1] 1\n    B: 2\n    C: 3\n\nTABLE>>')
  })

  test('a blank line ends the table; the orphan row afterwards is left untouched', () => {
    const out = toPlainText(
      j('| A | B | C |', '| --- | --- | --- |', '| 1 | 2 | 3 |', '', '| 9 | 8 | 7 |'),
    )
    expect(out).toBe(j(OPEN, '', '[1] 1', '    B: 2', '    C: 3', '', CLOSE, '', '| 9 | 8 | 7 |'))
  })

  test('two tables in one document are decorated independently, numbering restarts', () => {
    const out = toPlainText(
      j(
        '| A | B | C |',
        '| --- | --- | --- |',
        '| 1 | 2 | 3 |',
        '',
        'prose line',
        '',
        '| C | D | E |',
        '| --- | --- | --- |',
        '| 3 | 4 | 5 |',
      ),
    )
    expect(out).toBe(
      j(
        OPEN,
        '',
        '[1] 1',
        '    B: 2',
        '    C: 3',
        '',
        CLOSE,
        '',
        'prose line',
        '',
        OPEN,
        '',
        '[1] 3',
        '    D: 4',
        '    E: 5',
        '',
        CLOSE,
      ),
    )
    // OPEN === CLOSE, so each of the two record blocks emits the string twice
    // (its opener and its closer) → four occurrences of the frame text.
    expect(out.split(OPEN).length - 1).toBe(4)
    expect(out.split(CLOSE).length - 1).toBe(4)
  })

  test('tables are decorated on the pseudo-markdown path too', () => {
    const out = toPseudoMarkdown(j('| A | B | C |', '| --- | --- | --- |', '| 1 | 2 | 3 |'))
    expect(out).toBe(j(OPEN, '', '[1] 1', '    B: 2', '    C: 3', '', CLOSE))
  })

  test('both pipelines pass tables through untouched when table.enabled is false', () => {
    const doc = j('| A | B | C |', '| --- | --- | --- |', '| 1 | 2 | 3 |')
    expect(toPlainText(doc, { table: { enabled: false } })).toBe(doc)
    expect(toPseudoMarkdown(doc, { table: { enabled: false } })).toBe(doc)
  })

  test('structural passthrough: pipe-runs that are not tables are untouched', () => {
    const noDelimiter = j('| a | b |', '| c | d |')
    expect(toPlainText(noDelimiter)).toBe(noDelimiter)
    expect(toPseudoMarkdown(noDelimiter)).toBe(noDelimiter)

    const lone = 'just | a | line'
    expect(toPlainText(lone)).toBe(lone)
  })

  test('deterministic: same input twice produces byte-identical output', () => {
    const doc = j(
      '| A | B | C |',
      '| --- | --- | --- |',
      '| 1 | **x** | y |',
      '| 2 | | z |',
    )
    expect(toPlainText(doc)).toBe(toPlainText(doc))
    expect(JSON.stringify(toPlainText(doc))).toBe(JSON.stringify(toPlainText(doc)))
  })
})

describe('decorateTable standalone', () => {
  test('table → strategy-aware block, non-table → unchanged, whitespace-only → empty', () => {
    const block = decorateTable(j('| A | B | C |', '| --- | --- | --- |', '| 1 | **b** | x |'))
    expect(block).toBe(j(OPEN, '', '[1] 1', '    B: b', '    C: x', '', CLOSE))

    // Two columns → compact selection on the standalone path too.
    const twoCol = decorateTable(j('| Property | Value |', '| --- | --- |', '| Version | 1.2.0 |'))
    expect(twoCol).toBe(j('┌─ Properties ──────', '', 'Property  ─ Version', 'Value     ─ 1.2.0', '', '└───────────────────'))

    const nonTable = j('| a | b |', '| c | d |')
    expect(decorateTable(nonTable)).toBe(nonTable)

    expect(decorateTable('   \n\t  ')).toBe('')
    expect(decorateTable('| just one | line |')).toBe('| just one | line |')
  })

  test('decorateTable handles escaped pipes the same way', () => {
    const out = decorateTable(j('| A | B | C |', '| --- | --- | --- |', '| a \\| b | c | d |'))
    expect(out).toBe(j(OPEN, '', '[1] a | b', '    B: c', '    C: d', '', CLOSE))
  })
})

describe('splitRow unit seam', () => {
  test('escaped pipe is a literal pipe inside one cell, not a delimiter', () => {
    expect(splitRow('| a \\| b | c |')).toEqual(['a | b', 'c'])
    expect(splitRow('a \\| b')).toEqual(['a | b'])
  })

  test('boundary pipes are dropped; interior empty cells are preserved', () => {
    expect(splitRow('| x | y |')).toEqual(['x', 'y'])
    expect(splitRow('| | x |')).toEqual(['', 'x'])
    expect(splitRow('a | b')).toEqual(['a', 'b'])
    expect(splitRow('|  x  |  y  |')).toEqual(['x', 'y'])
  })
})
