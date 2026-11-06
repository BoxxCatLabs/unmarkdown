/**
 * Fenced-code decoration suite — dedicated `┄` frames with the language
 * label on the opening line (feedback doc §4) via the public pipelines,
 * plus the documented `renderDecoratedCode` unit seam. Body lines carry no
 * added indent. Expectations are exact strings, never snapshots.
 */

import { describe, expect, it } from 'vitest'
import { toPlainText, toPseudoMarkdown } from '../src/index.js'
import { renderDecoratedCode } from '../src/code/decorate.js'
import { resolveOptions } from '../src/options.js'

const H = '┄'
/** Closing frame and unlabeled opening frame: `bottomRun` × '┄'. */
const BOTTOM = H.repeat(15)
const topFor = (label: string, run = 5): string => `${H.repeat(run)} ${label} ${H.repeat(run)}`
const j = (...lines: string[]): string => lines.join('\n')

describe('decorated code blocks — plain path (toPlainText)', () => {
  it('shows the language label on the opening frame by default', () => {
    const out = toPlainText(j('```js', 'const x = 1', '```'))
    expect(out).toBe(j('┄┄┄┄┄ js ┄┄┄┄┄', 'const x = 1', '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄'))
    expect(out.split('\n')[0]).toBe(topFor('js'))
    expect(out.split('\n')[2]).toBe(BOTTOM)
  })

  it('fence without language gets the bare frame on both lines', () => {
    const out = toPlainText(j('```', 'const x = 1', '```'))
    expect(out).toBe(j(BOTTOM, 'const x = 1', BOTTOM))
    const lines = out.split('\n')
    expect(lines[0]).toBe(lines[lines.length - 1])
  })

  it('label is the first whitespace token of the info string', () => {
    const out = toPlainText(j('```js title="demo"', 'x = 1', '```'))
    expect(out).toBe(j(topFor('js'), 'x = 1', BOTTOM))
    expect(out).not.toContain('title')
  })

  it('code.label: false suppresses the label', () => {
    const out = toPlainText(j('```js', 'const x = 1', '```'), {
      code: { frame: '┄', topRun: 5, bottomRun: 15, label: false },
    })
    expect(out).toBe(j(BOTTOM, 'const x = 1', BOTTOM))
    expect(out).not.toContain('js')
  })

  it('body lines carry no added indent; frame lines are exact', () => {
    const out = toPlainText(j('```', 'a = 1', 'b = 2', '```'))
    expect(out).toBe(j(BOTTOM, 'a = 1', 'b = 2', BOTTOM))
    const lines = out.split('\n')
    expect(lines[0]).toBe(BOTTOM)
    expect(lines[lines.length - 1]).toBe(BOTTOM)
  })

  it('custom CodeFrameOptions swap the frame and run lengths', () => {
    const out = toPlainText(j('```js', 'const x = 1', '```'), {
      code: { frame: '=', topRun: 3, bottomRun: 4, label: true },
    })
    expect(out).toBe(j('=== js ===', 'const x = 1', '===='))
  })

  it('multi-fence documents produce independent labeled blocks in order, prose intact', () => {
    const out = toPlainText(
      j('```js', 'a()', '```', '', 'prose between', '', '```py', 'b()', '```'),
    )
    expect(out).toBe(
      j(topFor('js'), 'a()', BOTTOM, '', 'prose between', '', topFor('py'), 'b()', BOTTOM),
    )
  })

  it('4+-backtick outer fence wins over inner 3-backtick lines: indented as content, nothing re-tokenized', () => {
    const out = toPlainText(j('````', '```js', 'inner()', '```', 'after', '````'))
    expect(out).toBe(j(BOTTOM, '```js', 'inner()', '```', 'after', BOTTOM))
  })

  it('interior blank lines are preserved as truly empty lines', () => {
    const out = toPlainText(j('```', 'a', '', '', 'b', '```'))
    expect(out).toBe(j(BOTTOM, 'a', '', '', 'b', BOTTOM))
  })

  it('relative indentation is preserved: fence indent stripped, deeper indent kept', () => {
    const out = toPlainText(j('```js', 'if (x) {', '    y()', '}', '```'))
    expect(out).toBe(j(topFor('js'), 'if (x) {', '    y()', '}', BOTTOM))
  })

  it('tabs are preserved verbatim inside the body', () => {
    const out = toPlainText(j('```', 'function f() {', '\treturn 1', '}', '```'))
    expect(out).toBe(j(BOTTOM, 'function f() {', '\treturn 1', '}', BOTTOM))
  })

  it('CRLF input is normalized; output uses LF only', () => {
    const out = toPlainText('```js\r\nconst x = 1\r\n```\r\n')
    expect(out).toBe(j(topFor('js'), 'const x = 1', BOTTOM))
    expect(out).not.toContain('\r')
  })

  it('codeBlock: verbatim keeps the raw fence byte-identically', () => {
    const out = toPlainText(j('```js', 'const x = 1', '```'), { codeBlock: 'verbatim' })
    expect(out).toBe('```js\nconst x = 1\n```')
  })

  it('fence-indented blocks: leading spaces before the fence are stripped, body emitted unprefixed', () => {
    const out = toPlainText(j('  ```js', '  const x = 1', '  ```'))
    expect(out).toBe(j(topFor('js'), 'const x = 1', BOTTOM))

    const nested = toPlainText(j('  ```', '  if (x) {', '    y()', '  }', '  ```'))
    expect(nested).toBe(j(BOTTOM, 'if (x) {', '  y()', '}', BOTTOM))
  })

  it('unclosed fence passes through raw', () => {
    const doc = j('```js', 'const x = 1')
    expect(toPlainText(doc)).toBe(doc)
  })

  it('empty fence body renders the frame with one blank line between separators', () => {
    const out = toPlainText(j('```js', '```'))
    expect(out).toBe(j(topFor('js'), '', BOTTOM))
  })

  it('trailing whitespace after the closing fence is consumed', () => {
    const out = toPlainText('```js\nx\n```   \n')
    expect(out).toBe(j(topFor('js'), 'x', BOTTOM))
  })

  it('URLs and inline code inside fences are restored byte-identically', () => {
    const out = toPlainText(
      j('```js', 'const u = "https://example.com/a?b=1"', 'const t = `tick`', '```'),
    )
    expect(out).toBe(
      j(
        topFor('js'),
        'const u = "https://example.com/a?b=1"',
        'const t = `tick`',
        BOTTOM,
      ),
    )
    expect(out).toContain('https://example.com/a?b=1')
    expect(out).toContain('`tick`')
  })

  it('prose around the fence survives, blank runs collapse to one empty line', () => {
    const out = toPlainText(j('top', '', '```', 'x = 1', '```', '', 'bottom'))
    expect(out).toBe(j('top', '', BOTTOM, 'x = 1', BOTTOM, '', 'bottom'))
  })

  it('long info string shrinks the side runs to fit the profile width (standard: 40)', () => {
    const lang = 'verylongcustomlanguageformat01' // 30 display columns
    const out = toPlainText(j('```' + lang, 'x', '```'))
    expect(out).toBe(j(topFor(lang, 4), 'x', BOTTOM))
    expect(out.split('\n')[0].length).toBeLessThanOrEqual(40)
  })

  it('maxWidth caps the labeled top line; the closing frame keeps bottomRun', () => {
    const out = toPlainText(j('```js', 'x', '```'), { maxWidth: 12 })
    expect(out).toBe(j(topFor('js', 4), 'x', BOTTOM))
    expect(out.split('\n')[2]).toBe(BOTTOM)
  })

  it('label wider than any run keeps a single frame char per side', () => {
    const out = toPlainText(j('```js', 'x', '```'), { maxWidth: 5 })
    expect(out).toBe(j(topFor('js', 1), 'x', BOTTOM))
  })

  it('glyphs: ascii renders the code frame with dashes', () => {
    const out = toPlainText(j('```js', 'const x = 1', '```'), { glyphs: 'ascii' })
    expect(out).toBe(j('----- js -----', 'const x = 1', '---------------'))
  })

  it('rendering is deterministic across repeated calls', () => {
    const doc = j('```js', 'const x = 1', '', 'y()', '```')
    expect(toPlainText(doc)).toBe(toPlainText(doc))
  })
})

describe('decorated code blocks — pseudo path (toPseudoMarkdown)', () => {
  it('default is verbatim: backtick fences kept for native-Markdown surfaces', () => {
    const out = toPseudoMarkdown(j('```js', 'const x = 1', '```'))
    expect(out).toBe('```js\nconst x = 1\n```')
  })

  it('codeBlock: decorated opts in on the pseudo path', () => {
    const out = toPseudoMarkdown(j('```js', 'const x = 1', '```'), { codeBlock: 'decorated' })
    expect(out).toBe(j(topFor('js'), 'const x = 1', BOTTOM))
  })

  it('rendering is deterministic across repeated calls', () => {
    const doc = j('```js', 'const x = 1', '```')
    const opts = { codeBlock: 'decorated' } as const
    expect(toPseudoMarkdown(doc, opts)).toBe(toPseudoMarkdown(doc, opts))
  })
})

describe('renderDecoratedCode unit seam', () => {
  it('frames the body with bare bottomRun runs, body lines unprefixed', () => {
    const out = renderDecoratedCode({ indent: '', lang: '', body: 'const x = 1' }, resolveOptions('plain'))
    expect(out).toBe(j(BOTTOM, 'const x = 1', BOTTOM))
  })

  it('renders the language label from the fence info string', () => {
    const fenced = { indent: '', lang: 'ts', body: 'x' }
    expect(renderDecoratedCode(fenced, resolveOptions('plain'))).toBe(
      j(topFor('ts'), 'x', BOTTOM),
    )
  })

  it('label is only the first token of a multi-token info string', () => {
    const out = renderDecoratedCode({ indent: '', lang: 'js title="x" meta', body: 'x' }, resolveOptions('plain'))
    expect(out).toBe(j(topFor('js'), 'x', BOTTOM))
  })

  it('label: false falls back to bare bottomRun runs', () => {
    const opts = resolveOptions('plain', { code: { frame: '┄', topRun: 5, bottomRun: 15, label: false } })
    expect(renderDecoratedCode({ indent: '', lang: 'ts', body: 'x' }, opts)).toBe(
      j(BOTTOM, 'x', BOTTOM),
    )
  })

  it('custom CodeFrameOptions set the frame and run lengths', () => {
    const opts = resolveOptions('plain', { code: { frame: '~', topRun: 2, bottomRun: 3, label: true } })
    expect(renderDecoratedCode({ indent: '', lang: 'rs', body: 'x' }, opts)).toBe(
      j('~~ rs ~~', 'x', '~~~'),
    )
  })

  it('leading/trailing blank lines trimmed; interior blanks kept as empty lines', () => {
    const out = renderDecoratedCode({ indent: '', lang: '', body: '\n\na\n\n\nb\n\n' }, resolveOptions('plain'))
    expect(out).toBe(j(BOTTOM, 'a', '', '', 'b', BOTTOM))
  })

  it('labeled top line shrinks to the largest fitting run, minimum one', () => {
    const fenced = { indent: '', lang: 'js', body: 'x' }
    const fits = resolveOptions('plain', { maxWidth: 6 })
    expect(renderDecoratedCode(fenced, fits)).toBe(j(topFor('js', 1), 'x', BOTTOM))
    const overflowing = resolveOptions('plain', { maxWidth: 5 })
    expect(renderDecoratedCode(fenced, overflowing)).toBe(j(topFor('js', 1), 'x', BOTTOM))
  })

  it('pure: repeated calls with the same resolved options are identical and unmutated', () => {
    const fenced = { indent: '', lang: 'js', body: 'x' }
    const opts = resolveOptions('plain')
    const first = renderDecoratedCode(fenced, opts)
    expect(renderDecoratedCode(fenced, opts)).toBe(first)
    expect(opts.code).toEqual({ frame: '┄', topRun: 5, bottomRun: 15, label: true })
  })
})
