/**
 * List transform suite — plain and pseudo passes at the unit seam
 * (src/core/lists.ts). Covers the contract surface: bullet/bulletNested
 * depth selection, normalized 2×(depth−1) indent, ordered render/preserve
 * renumbering semantics, task glyphs, the ASCII glyph bundle, pseudo
 * normalization, and determinism.
 */

import { describe, expect, it } from 'vitest'
import { transformPlainLists, transformPseudoLists } from '../src/core/lists.js'

const j = (...lines: string[]): string => lines.join('\n')

const GLYPHS = { pending: '☐', done: '☑', cancelled: '☒' } as const

const PLAIN = {
  bullet: '•',
  bulletNested: '◦',
  ordered: 'render',
  tasks: GLYPHS,
} as const

describe('plain lists — unordered', () => {
  it('renders the top-level bullet at depth 1 and bulletNested at depth 2', () => {
    expect(transformPlainLists(j('- a', '  - b'), PLAIN)).toBe(j('• a', '  ◦ b'))
  })

  it('renders depth 3 with bulletNested and 4-space normalized indent', () => {
    expect(transformPlainLists(j('- a', '  - b', '    - c'), PLAIN)).toBe(
      j('• a', '  ◦ b', '    ◦ c'),
    )
  })

  it('emits 2 spaces × (depth − 1), not the raw source indent', () => {
    expect(transformPlainLists(j('- a', '   - odd'), PLAIN)).toBe(j('• a', '  ◦ odd'))
  })

  it('normalizes - * + markers to the configured bullet', () => {
    expect(transformPlainLists(j('- a', '* b', '+ c'), PLAIN)).toBe(j('• a', '• b', '• c'))
  })

  it('collapses runs of whitespace after the marker', () => {
    expect(transformPlainLists('-   spaced', PLAIN)).toBe('• spaced')
  })
})

describe('plain lists — ordered render', () => {
  it('renumbers depth 1 sequentially and depth 2 as letters', () => {
    const out = transformPlainLists(j('5. Fifth', '  1. alpha', '  2. beta', '6. Sixth'), PLAIN)
    expect(out).toBe(j('1. Fifth', '  a. alpha', '  b. beta', '2. Sixth'))
  })

  it('restarts letter numbering for each deeper sublist', () => {
    const out = transformPlainLists(j('1. a', '  1. x', '  2. y', '2. b', '  1. z'), PLAIN)
    expect(out).toBe(j('1. a', '  a. x', '  b. y', '2. b', '  a. z'))
  })

  it('keeps numbering across blank lines (loose lists)', () => {
    expect(transformPlainLists(j('1. one', '', '2. two'), PLAIN)).toBe(j('1. one', '', '2. two'))
  })

  it('restarts numbering after prose or unordered items', () => {
    expect(transformPlainLists(j('1. a', 'prose', '2. b'), PLAIN)).toBe(j('1. a', 'prose', '1. b'))
    expect(transformPlainLists(j('1. a', '- bullet', '2. b'), PLAIN)).toBe(
      j('1. a', '• bullet', '1. b'),
    )
  })

  it('cycles letters past z', () => {
    const input = Array.from({ length: 27 }, (_, i) => `  ${i + 1}. n${i + 1}`)
    const expected = [
      ...Array.from({ length: 26 }, (_, i) => `  ${String.fromCharCode(97 + i)}. n${i + 1}`),
      '  a. n27',
    ]
    expect(transformPlainLists(j('1. root', ...input), PLAIN)).toBe(j('1. root', ...expected))
  })
})

describe('plain lists — ordered preserve', () => {
  it('leaves ordered lines byte-identical, including spacing and tabs', () => {
    const src = j('  3.   keep   spacing', '\t9. tabbed')
    expect(transformPlainLists(src, { ...PLAIN, ordered: 'preserve' })).toBe(src)
  })

  it('still transforms bullets while ordered lines stay untouched', () => {
    const out = transformPlainLists(j('1. one', '- bullet', '2. two'), {
      ...PLAIN,
      ordered: 'preserve',
    })
    expect(out).toBe(j('1. one', '• bullet', '2. two'))
  })
})

describe('plain lists — tasks', () => {
  it('renders pending and done glyphs; upper-case X counts as done', () => {
    const out = transformPlainLists(j('- [ ] pending', '- [x] done', '- [X] upper'), PLAIN)
    expect(out).toBe(j('☐ pending', '☑ done', '☑ upper'))
  })

  it('replaces the marker at the bullet position with normalized indent', () => {
    expect(transformPlainLists(j('- [ ] a', '      - [ ] deep'), PLAIN)).toBe(
      j('☐ a', '      ☐ deep'),
    )
  })

  it('leaves non-task bracket lines as plain bullets', () => {
    expect(transformPlainLists(j('- [y] not a task', '- [] neither'), PLAIN)).toBe(
      j('• [y] not a task', '• [] neither'),
    )
  })
})

describe('plain lists — ascii glyph bundle', () => {
  const ASCII = { ...PLAIN, bullet: '-', bulletNested: '-', tasks: { pending: '[ ]', done: '[x]', cancelled: '[-]' } }

  it('renders dashes at every depth', () => {
    expect(transformPlainLists(j('* a', '    + b'), ASCII)).toBe(j('- a', '    - b'))
  })

  it('renders GFM checkboxes as ascii glyph frames', () => {
    expect(transformPlainLists(j('* [ ] todo', '+ [X] shipped'), ASCII)).toBe(
      j('[ ] todo', '[x] shipped'),
    )
  })
})

describe('plain lists — non-list edges', () => {
  it('ignores markers without trailing whitespace', () => {
    const src = j('-not a list', '*neither', '1.also no')
    expect(transformPlainLists(src, PLAIN)).toBe(src)
  })

  it('preserves empty and trailing-newline shapes byte-exactly', () => {
    expect(transformPlainLists('', PLAIN)).toBe('')
    expect(transformPlainLists(j('- a', ''), PLAIN)).toBe(j('• a', ''))
    expect(transformPlainLists('- ', PLAIN)).toBe('• ')
  })

  it('is deterministic across repeated calls', () => {
    const src = j('- a', '  - b', '5. third', '  1. fourth', '- [ ] task')
    const once = transformPlainLists(src, PLAIN)
    expect(transformPlainLists(src, PLAIN)).toBe(once)
    const pseudoOnce = transformPseudoLists(src)
    expect(transformPseudoLists(src)).toBe(pseudoOnce)
  })
})

describe('pseudo lists', () => {
  it('normalizes - * + markers to "- " with 2-space-per-level padding', () => {
    expect(transformPseudoLists(j('- a', '  * b', '      + c'))).toBe(
      j('- a', '  - b', '      - c'),
    )
  })

  it('caps nesting at 3 levels (6 spaces)', () => {
    expect(transformPseudoLists('        - deep')).toBe('      - deep')
  })

  it('keeps ordered numbers but re-pads odd indents', () => {
    expect(transformPseudoLists(j('3. x', '   7. y', '      12. z'))).toBe(
      j('3. x', '  7. y', '      12. z'),
    )
  })

  it('normalizes task items to GFM [ ]/[x] with single spaces', () => {
    expect(transformPseudoLists(j('- [X] ship', '* [ ] plan', '+  [x]  spaced'))).toBe(
      j('- [x] ship', '- [ ] plan', '- [x] spaced'),
    )
  })

  it('leaves non-list lines untouched', () => {
    const src = j('prose line', '-nospace', '')
    expect(transformPseudoLists(src)).toBe(src)
  })
})
