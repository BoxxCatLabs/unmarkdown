import { describe, expect, it } from 'vitest'
import { transformHeadings } from '../src/core/headings'
import type { HeadingLevel, HeadingOptions, HeadingStyle } from '../src/core/headings'

// Glyph bundle per contract: defaults for all six levels.
const DEFAULT_HEADINGS: Record<HeadingLevel, HeadingStyle> = {
  1: { frame: '━' },
  2: { prefix: '【 ', suffix: ' 】' },
  3: { prefix: '◆ ' },
  4: { prefix: '◇ ' },
  5: { prefix: '▸ ' },
  6: { prefix: '› ' },
}

function opts(overrides: Partial<HeadingOptions> = {}): HeadingOptions {
  return {
    headingMode: 'decorate',
    headingDepth: 6,
    width: 40,
    headings: DEFAULT_HEADINGS,
    inlineCode: 'corner',
    strikethrough: 'strip',
    links: 'decorated',
    guardUrlParens: true,
    ...overrides,
  }
}

describe('transformHeadings', () => {
  describe('decorate mode — default glyphs', () => {
    it('caps H1 frame runs at 4 per side', () => {
      // 'Alpha' = 5 cols → k = min(4, floor((40 - 5 - 2) / 2)) = 4 (cap, not fill-to-width)
      expect(transformHeadings('# Alpha', opts())).toBe(
        `${'━'.repeat(4)} Alpha ${'━'.repeat(4)}`,
      )
    })

    it('renders levels 2–6 with prefix (+suffix) styles', () => {
      expect(transformHeadings('## Beta', opts())).toBe('【 Beta 】')
      expect(transformHeadings('### Gamma', opts())).toBe('◆ Gamma')
      expect(transformHeadings('#### Delta', opts())).toBe('◇ Delta')
      expect(transformHeadings('##### Epsilon', opts())).toBe('▸ Epsilon')
      expect(transformHeadings('###### Zeta', opts())).toBe('› Zeta')
    })

    it('transforms every level inside one document', () => {
      const input = '# Alpha\n## Beta\ntext\n### Gamma'
      expect(transformHeadings(input, opts())).toBe(
        `${'━'.repeat(4)} Alpha ${'━'.repeat(4)}\n【 Beta 】\ntext\n◆ Gamma`,
      )
    })
  })

  describe('H1 framing vs resolved width', () => {
    const title = 'Getting Started' // 15 cols

    it('frames at width 21 → `━━ Getting Started ━━`', () => {
      expect(transformHeadings('# Getting Started', opts({ width: 21 }))).toBe(
        '━━ Getting Started ━━',
      )
    })

    it('emits the bare title at width 16: even the 2-run floor cannot fit (k=1 no longer exists)', () => {
      // t + 6 = 21 > 16, so the floored two-run frame does not fit → bare title.
      expect(transformHeadings('# Getting Started', opts({ width: 16 }))).toBe(
        'Getting Started',
      )
    })

    it('steps to k=3 at the 31-col title boundary (W=40)', () => {
      // t = 31 → k = min(4, floor((40 - 31 - 2) / 2)) = 3; row = 39 cols.
      const t31 = 'Getting Started'.padEnd(31, '.')
      expect(transformHeadings(`# ${t31}`, opts())).toBe(`━━━ ${t31} ━━━`)
    })

    it('steps to k=2 at the 33-col title boundary (W=40)', () => {
      // t = 33 → k = min(4, floor((40 - 33 - 2) / 2)) = 2; row = 39 cols.
      const t33 = 'Getting Started'.padEnd(33, '.')
      expect(transformHeadings(`# ${t33}`, opts())).toBe(`━━ ${t33} ━━`)
    })

    it('emits the bare title at the 35-col boundary (W=40): t + 6 > W', () => {
      const t35 = 'Getting Started'.padEnd(35, '.')
      const out = transformHeadings(`# ${t35}`, opts())
      expect(out).toBe(t35)
      expect(out.includes('\n')).toBe(false)
    })

    it('emits the bare title when title width ≥ W', () => {
      expect(transformHeadings('# Getting Started', opts({ width: 15 }))).toBe(title)
      expect(transformHeadings('# Getting Started', opts({ width: 14 }))).toBe(title)
    })

    it('never wraps, truncates, or drops the long title', () => {
      const out = transformHeadings('# Getting Started', opts({ width: 5 }))
      expect(out).toBe(title)
      expect(out).toContain('Getting Started')
    })
  })

  describe('H2–H6 fit degradation to bare title', () => {
    // '【 Long Heading Here 】' → 2 + 1 + 17 + 1 + 2 = 23 cols (lenticular brackets are wide)
    it('degrades H2 to bare title when decoration exceeds W', () => {
      expect(transformHeadings('## Long Heading Here', opts({ width: 20 }))).toBe(
        'Long Heading Here',
      )
      expect(transformHeadings('## Long Heading Here', opts({ width: 22 }))).toBe(
        'Long Heading Here',
      )
    })

    it('keeps H2 decoration on an exact fit (displayWidth === W)', () => {
      expect(transformHeadings('## Long Heading Here', opts({ width: 23 }))).toBe(
        '【 Long Heading Here 】',
      )
      expect(transformHeadings('## Hi', opts({ width: 8 }))).toBe('【 Hi 】')
      expect(transformHeadings('## Hi', opts({ width: 7 }))).toBe('Hi')
    })

    it('degrades H3–H6 prefixes when prefix+title exceeds W', () => {
      // '◆ Gamma' = 7 cols
      expect(transformHeadings('### Gamma', opts({ width: 6 }))).toBe('Gamma')
      // '› Zeta' = 6 cols (`›` is 1 column) — fits at width 6; bare-title boundary is width 5
      expect(transformHeadings('###### Zeta', opts({ width: 6 }))).toBe('› Zeta')
      expect(transformHeadings('###### Zeta', opts({ width: 5 }))).toBe('Zeta')
      expect(transformHeadings('###### Zeta', opts({ width: 7 }))).toBe('› Zeta')
    })
  })

  describe('CJK title width math (displayWidth, not code points)', () => {
    it('frames H1 using terminal columns (CJK = 2 cols)', () => {
      // '你好世界' = 8 cols, not 4 code points → k = min(4, floor((21 - 8 - 2) / 2)) = 4 (capped)
      expect(transformHeadings('# 你好世界', opts({ width: 21 }))).toBe(
        `${'━'.repeat(4)} 你好世界 ${'━'.repeat(4)}`,
      )
    })

    it('emits the bare CJK title when title width ≥ W', () => {
      expect(transformHeadings('# 你好世界', opts({ width: 8 }))).toBe('你好世界')
    })

    it('applies column width to H2 fit checks', () => {
      // '【 你好世界 】' = 2 + 1 + 8 + 1 + 2 = 14 cols (8 code points would fit anywhere ≥ 8)
      expect(transformHeadings('## 你好世界', opts({ width: 14 }))).toBe('【 你好世界 】')
      expect(transformHeadings('## 你好世界', opts({ width: 13 }))).toBe('你好世界')
    })
  })

  describe('rule 8 — inline Markdown normalized before measuring', () => {
    it('strips emphasis before framing: `# **Getting Started**` at width 21 → `━━ Getting Started ━━`', () => {
      // Normalized title is 15 cols (not the 19-col raw `**Getting Started**`),
      // so k = floor((21 - 15 - 2) / 2) = 2.
      expect(transformHeadings('# **Getting Started**', opts({ width: 21 }))).toBe(
        '━━ Getting Started ━━',
      )
    })

    it('renders inline code per the corner mode (plain default) and fits it', () => {
      // 'See 『docs』' = 12 display cols (『』 are wide) → k = min(4, floor((40 - 12 - 2) / 2)) = 4 (capped).
      expect(transformHeadings('# See `docs`', opts())).toBe(
        `${'━'.repeat(4)} See 『docs』 ${'━'.repeat(4)}`,
      )
    })

    it('renders inline code per the verbatim and bracket modes', () => {
      expect(transformHeadings('## See `docs`', opts({ inlineCode: 'verbatim' }))).toBe(
        '【 See `docs` 】',
      )
      expect(transformHeadings('## See `docs`', opts({ inlineCode: 'bracket' }))).toBe(
        '【 See ⦗ docs ⦘ 】',
      )
    })

    it('applies strikethrough per mode before framing', () => {
      // 'old plan' = 8 cols → k = min(4, floor((21 - 8 - 2) / 2)) = 4 (capped)
      expect(transformHeadings('# ~~old~~ plan', opts({ width: 21 }))).toBe(
        '━━━━ old plan ━━━━',
      )
      // '[old] plan' = 10 cols → k = floor((21 - 10 - 2) / 2) = 4
      expect(transformHeadings('# ~~old~~ plan', opts({ width: 21, strikethrough: 'brackets' }))).toBe(
        '━━━━ [old] plan ━━━━',
      )
    })

    it('sizes an H1 frame on the decorated link width, not the raw markdown', () => {
      // Raw title '[Docs](/a/b)' is 12 code points; the decorated form
      // 'Docs (␣/a/b␣)' is 11 display columns (ZWSP is zero-width) → k = 4.
      expect(transformHeadings('# [Docs](/a/b)', opts({ width: 21 }))).toBe(
        '━━━━ Docs (\u200B/a/b\u200B) ━━━━',
      )
    })

    it('degrades to the bare title when the decorated link width exhausts the row', () => {
      expect(transformHeadings('# [Docs](/a/b)', opts({ width: 11 }))).toBe(
        'Docs (\u200B/a/b\u200B)',
      )
    })

    it('renders links per the urlOnly mode before framing', () => {
      // '/a/b' = 4 cols → k = min(4, floor((21 - 4 - 2) / 2)) = 4 (capped)
      expect(transformHeadings('# [Docs](/a/b)', opts({ width: 21, links: 'urlOnly' }))).toBe(
        '━━━━ /a/b ━━━━',
      )
    })

    it('renders images per the links mode before framing', () => {
      // 'logo (␣/img.png␣)' = 15 cols → k = floor((21 - 15 - 2) / 2) = 2; exact row fit.
      expect(transformHeadings('# ![logo](/img.png)', opts({ width: 21 }))).toBe(
        '━━ logo (\u200B/img.png\u200B) ━━',
      )
    })

    it('keeps rendered inline output free of markdown markers the inline pass could re-match', () => {
      // Composite title 'See 『docs』 and bold and gone' = 30 cols → k = floor((40 - 30 - 2) / 2) = 4.
      const out = transformHeadings('# See `docs` and **bold** and ~~gone~~', opts({ width: 40 }))
      expect(out).toBe(`${'━'.repeat(4)} See 『docs』 and bold and gone ${'━'.repeat(4)}`)
      expect(out).not.toContain('`')
      expect(out).not.toContain('**')
      expect(out).not.toContain('~~')
    })

    it('leaves preserve-mode titles verbatim markdown, unnormalized and unmeasured', () => {
      const preserve = opts({ headingMode: 'preserve' })
      expect(transformHeadings('# **T**', preserve)).toBe('# **T**')
      expect(transformHeadings('## ~~x~~ y', preserve)).toBe('## ~~x~~ y')
      expect(transformHeadings('# See `docs`', preserve)).toBe('# See `docs`')
    })
  })

  describe('preserve mode (pseudo)', () => {
    const preserve = opts({ headingMode: 'preserve' })

    it('normalizes separator runs and trims the title', () => {
      expect(transformHeadings('##  Title  ', preserve)).toBe('## Title')
    })

    it('keeps the hash count', () => {
      expect(transformHeadings('####  Deep', preserve)).toBe('#### Deep')
      expect(transformHeadings('# One', preserve)).toBe('# One')
    })

    it('ignores per-level glyphs', () => {
      expect(transformHeadings('## Beta', preserve)).toBe('## Beta')
      expect(transformHeadings('### Gamma', preserve)).toBe('### Gamma')
    })

    it('still drops empty titles', () => {
      expect(transformHeadings('# ', preserve)).toBe('')
    })

    it('still honors the depth cutoff', () => {
      expect(transformHeadings('### x', opts({ headingMode: 'preserve', headingDepth: 2 }))).toBe(
        '### x',
      )
    })
  })

  describe('edge behavior', () => {
    it('drops lines with empty/whitespace-only titles', () => {
      expect(transformHeadings('para\n# \ntext', opts())).toBe('para\n\ntext')
      expect(transformHeadings('para\n## \t\ntext', opts())).toBe('para\n\ntext')
    })

    it('passes more than six hash marks through untouched', () => {
      expect(transformHeadings('####### Seven', opts())).toBe('####### Seven')
    })

    it('leaves a bare `#` without separator untouched', () => {
      expect(transformHeadings('#', opts())).toBe('#')
      expect(transformHeadings('#nospace', opts())).toBe('#nospace')
    })

    it('leaves inline `#` untouched', () => {
      expect(transformHeadings('text # not a heading', opts())).toBe('text # not a heading')
    })

    it('passes lines beyond headingDepth through undecorated', () => {
      const o = opts({ headingDepth: 3 })
      expect(transformHeadings('#### Deep', o)).toBe('#### Deep')
      expect(transformHeadings('### Edge', o)).toBe('◆ Edge')
    })
  })

  describe('determinism', () => {
    it('returns equal output for repeated calls with the same options', () => {
      const input = '# Alpha\n## Beta\n### Gamma\n# 你好世界'
      const o = opts({ width: 21 })
      const first = transformHeadings(input, o)
      expect(transformHeadings(input, o)).toBe(first)
      expect(transformHeadings(input, opts({ width: 21 }))).toBe(first)
    })
  })
})
