import { describe, expect, it } from 'vitest';
import { displayWidth, toPlainText, toPseudoMarkdown } from '../src/index.js';
import type { PlainTextOptions } from '../src/index.js';

// Deterministic fixtures for docs/unmarkdown-feedback.md §11 (quality matrix).
// Every expectation is an inline literal; no snapshots. Structural helpers only.

const j = (...lines: string[]): string => lines.join('\n');

// U+200B — the auto-linker guard synthesized around URLs in decorated links.
const ZWSP = '\u200B';
const CODE15 = '┄'.repeat(15);
const TFRAME = '════════ ✧･ﾟ ════════';

/**
 * Kitchen-sink fixture: H1/H2/H3, emphasis + strikethrough + inline code,
 * inline + reference links, nested bullets, tasks, nested quotes, ordered
 * sub-numbering, hrule, fenced code, 3-column table, CJK, ZWJ-family emoji.
 * Every paragraph is sized so the decorated plain output fits the default
 * 40-column budget (or carries a sentinel URL that keeps it whole), which
 * is what makes the idempotence cases feasible per §11.
 */
const KITCHEN_SINK = j(
  '# Project Atlas',
  '',
  'Brief **intro**: ~~gone~~ `pinned`.',
  'See [the docs](https://example.com/docs) and [spec][ref].',
  '',
  '[ref]: https://example.com/spec',
  '',
  '## Setup',
  '',
  '- install first',
  '  - run the installer',
  '    - confirm the license',
  '',
  '- [ ] write tests',
  '- [x] ship it',
  '',
  '> quoted wisdom',
  '> > deeper quote',
  '',
  '1. first step',
  '2. second step',
  '   1. inner alpha',
  '   2. inner beta',
  '',
  '---',
  '',
  '```ts',
  'const answer = 42;',
  '',
  'const doubled = answer * 2;',
  '```',
  '',
  '| Name | Role | Base |',
  '| --- | --- | --- |',
  '| Ada | Architect | 10 |',
  '| Grace | Admiral | 20 |',
  '',
  '中文段落：宽度按两个列计。',
  '',
  'Family photo 👨‍👩‍👧‍👦 launched 🚀',
);

const WRAP_HEAVY = j(
  'the quick brown fox jumps over the lazy dog and keeps running through the meadow',
  '',
  'pack my box with five dozen liquor jugs while the sleepy zebra quietly watches',
  '',
  '中文长段落需要在簇边界断行而绝不截断任何字符内容',
  '',
  'Check https://example.com/a/long/path/that/exceeds/any/profile/budget now',
);

const TABLE_DOC = j(
  '| File | Size |',
  '| --- | --- |',
  '| report.pdf | 12 KB |',
  '| notes.txt | 3 KB |',
  '',
  '| Item | Ref | Qty |',
  '| --- | --- | --- |',
  '| guide | [docs](https://example.com/d) | `x` |',
  '| chart | [png](https://example.com/p.png) | 2 |',
);

const CODE_DOC = j(
  '```js',
  'const alpha = 1;',
  '',
  '',
  '  const beta = alpha * 2;',
  'const longLine = "aaaaaaaaaabbbbbbcccccdddddddeeeeeeffffffgggggghhhhhhiiiiii";',
  '```',
);

const TASKS_QUOTES = j(
  '# Chores',
  '',
  '- [ ] sweep the porch',
  '- [x] water the ferns',
  '- [-] archive old mail',
  '',
  '> first level note',
  '> > second level note',
  '',
  '1. sweep',
  '   - under the rug',
  '2. mop',
);

describe('§11 quality — determinism', () => {
  it('repeated plain calls with defaults are byte-identical', () => {
    const first = toPlainText(KITCHEN_SINK);
    for (let i = 0; i < 4; i++) expect(toPlainText(KITCHEN_SINK)).toBe(first);
  });

  it('repeated plain calls with custom options are byte-identical', () => {
    const opts = { glyphs: 'ascii', profile: 'compact' } as const;
    const first = toPlainText(KITCHEN_SINK, opts);
    for (let i = 0; i < 4; i++) expect(toPlainText(KITCHEN_SINK, opts)).toBe(first);
  });

  it('repeated pseudo calls are byte-identical', () => {
    const first = toPseudoMarkdown(KITCHEN_SINK);
    for (let i = 0; i < 2; i++) expect(toPseudoMarkdown(KITCHEN_SINK)).toBe(first);
    expect(toPseudoMarkdown(WRAP_HEAVY)).toBe(toPseudoMarkdown(WRAP_HEAVY));
  });

  it('an empty options object resolves to the same bytes as defaults', () => {
    expect(toPlainText(KITCHEN_SINK, {})).toBe(toPlainText(KITCHEN_SINK));
  });
});

describe('§11 quality — information preservation', () => {
  const out = toPlainText(KITCHEN_SINK);

  it('preserves heading and prose content', () => {
    expect(out).toContain('Project Atlas');
    expect(out).toContain('Setup');
    expect(out).toContain('Brief intro');
    expect(out).toContain('pinned');
    // Emphasis and strikethrough are stripped to their meaningful text.
    expect(out).toContain('gone');
    expect(out).not.toContain('~~');
    expect(out).not.toContain('**');
  });

  it('preserves link text and both inline and reference-resolved URLs', () => {
    expect(out).toContain('the docs');
    expect(out).toContain(`(${ZWSP}https://example.com/docs${ZWSP})`);
    expect(out).toContain('spec');
    expect(out).toContain(`(${ZWSP}https://example.com/spec${ZWSP})`);
    // The definition line itself is consumed, not emitted.
    expect(out).not.toContain('[ref]:');
  });

  it('preserves every list, task, quote, and ordered item text', () => {
    for (const unit of [
      'install first',
      'run the installer',
      'confirm the license',
      'write tests',
      'ship it',
      'quoted wisdom',
      'deeper quote',
      'first step',
      'second step',
      'inner alpha',
      'inner beta',
    ]) {
      expect(out).toContain(unit);
    }
    expect(out).toContain('☐ write tests');
    expect(out).toContain('☑ ship it');
  });

  it('preserves code body lines verbatim', () => {
    expect(out).toContain('const answer = 42;');
    expect(out).toContain('const doubled = answer * 2;');
  });

  it('preserves every table cell value', () => {
    for (const unit of ['Ada', 'Architect', 'Grace', 'Admiral', 'Base: 10', 'Base: 20']) {
      expect(out).toContain(unit);
    }
  });

  it('preserves CJK text and emoji', () => {
    expect(out).toContain('中文段落：宽度按两个列计。');
    expect(out).toContain('Family photo');
    expect(out).toContain('👨‍👩‍👧‍👦');
    expect(out).toContain('launched');
    expect(out).toContain('🚀');
  });

  it('never emits truncation artifacts at any width', () => {
    const cases: PlainTextOptions[] = [{}, { profile: 'compact' }, { profile: 'comfortable' }, { maxWidth: 16 }];
    for (const opts of cases) {
      const squeezed = toPlainText(KITCHEN_SINK, opts);
      expect(squeezed).not.toContain('…');
      // Every CJK character survives even when the run must wrap.
      for (const ch of '中文段落：宽度按两个列计。') expect(squeezed).toContain(ch);
      expect(squeezed).toContain('Ada');
      expect(squeezed).toContain('Architect');
      expect(squeezed).toContain('https://example.com/docs');
      expect(squeezed).toContain('👨‍👩‍👧‍👦');
    }
  });
});

describe('§11 quality — heading integrity (one output row per heading)', () => {
  it('every level 1–6 renders exactly one row under compact and standard', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const src = `${'#'.repeat(level)} Tier`;
      for (const profile of ['compact', 'standard', 'comfortable'] as const) {
        const out = toPlainText(src, { profile });
        const rows = out.split('\n');
        expect(rows, `level ${level} at ${profile}`).toHaveLength(1);
        expect(rows[0]).toContain('Tier');
      }
    }
  });

  it('H1 framing fits the width: exact bytes at an exact-fit width', () => {
    const out = toPlainText('# Release Notes', { maxWidth: 20 });
    expect(out).toBe('━━ Release Notes ━━');
    expect(out.split('\n')).toHaveLength(1);
  });

  it('H1 over width degrades to the bare title, still exactly one row', () => {
    const title = 'A Very Long Heading Indeed';
    const out = toPlainText(`# ${title}`, { maxWidth: 10 });
    expect(out).toBe(title);
    expect(out.split('\n')).toHaveLength(1);
  });

  it('CJK H1 uses width-2 math: bare below the two-run floor at maxWidth 12, bare at maxWidth 8', () => {
    // 8-wide title: 8 + 6 > 12, so even the floored two-run frame cannot fit → bare title.
    expect(toPlainText('# 中文标题', { maxWidth: 12 })).toBe('中文标题');
    // 8-wide title in an 8-wide budget: bare floor, one row remains.
    expect(toPlainText('# 中文标题', { maxWidth: 8 })).toBe('中文标题');
    // Width-2 math still frames when it fits: k = min(4, floor((15 - 8 - 2) / 2)) = 2
    // (width-1 CJK counting would yield k = 4 here, so this pins the column math).
    expect(toPlainText('# 中文标题', { maxWidth: 15 })).toBe('━━ 中文标题 ━━');
    // Bare floor keeps exactly one row even when the budget sits between.
    const squeezed = toPlainText('# 中文标题', { maxWidth: 11 });
    expect(squeezed).toBe('中文标题');
    expect(squeezed.split('\n')).toHaveLength(1);
  });

  it('kitchen-sink headings stay single rows under all three profiles', () => {
    for (const profile of ['compact', 'standard', 'comfortable'] as const) {
      const out = toPlainText(KITCHEN_SINK, { profile });
      expect(out.split('\n').filter((line) => line.includes('Project Atlas'))).toHaveLength(1);
      expect(out.split('\n').filter((line) => line.includes('Setup'))).toHaveLength(1);
    }
  });
});

describe('§11 quality — width awareness', () => {
  it('wrapped prose lines respect displayWidth ≤ width without content loss', () => {
    const src = 'the quick brown fox jumps over the lazy dog and again';
    const out = toPlainText(src, { maxWidth: 24 });
    const lines = out.split('\n');
    expect(out).toBe(j('the quick brown fox', 'jumps over the lazy dog', 'and again'));
    for (const line of lines) expect(displayWidth(line)).toBeLessThanOrEqual(24);
    expect(lines.join(' ')).toBe(src);
  });

  it('a line carrying an unsplittable URL overflows whole, never split', () => {
    const src = 'See https://example.com/a/very/long/path/that/exceeds/budget here';
    const out = toPlainText(src, { maxWidth: 20 });
    expect(out).toBe(src);
    expect(displayWidth(out)).toBeGreaterThan(20);
  });

  it('CJK runs wrap two columns per character, between whole clusters', () => {
    const out = toPlainText('一二三四五六七八九十', { maxWidth: 12 });
    expect(out).toBe(j('一二三四五六', '七八九十'));
    for (const line of out.split('\n')) expect(displayWidth(line)).toBeLessThanOrEqual(12);
    expect(out.split('\n').join('')).toBe('一二三四五六七八九十');
  });

  it('emoji count 2: a line with emoji wraps earlier than code points suggest', () => {
    const src = 'five 🚀🚀🚀🚀🚀';
    // 10 code points would fit a 12-column budget; display width is 15.
    expect([...src].length).toBeLessThanOrEqual(12);
    expect(displayWidth(src)).toBe(15);
    const out = toPlainText(src, { maxWidth: 12 });
    expect(out).toBe(j('five', '🚀🚀🚀🚀🚀'));
  });

  it('wrap-heavy document keeps every prose line inside the budget', () => {
    const out = toPlainText(WRAP_HEAVY);
    for (const line of out.split('\n')) {
      if (line.includes('https://')) continue; // unsplittable URL overflows whole
      expect(displayWidth(line)).toBeLessThanOrEqual(40);
    }
    expect(out.split('\n').length).toBeGreaterThan(4);
  });
});

describe('§11 quality — code integrity', () => {
  it('renders the frame byte-exactly; blank interior lines survive as empty lines even doubled', () => {
    const src = j('```js', 'const a = 1;', '', '', '  const b = a + 1;', '```');
    expect(toPlainText(src)).toBe(
      j('┄┄┄┄┄ js ┄┄┄┄┄', 'const a = 1;', '', '', '  const b = a + 1;', CODE15),
    );
  });

  it('never interprets markdown inside the body: emphasis, links, and ATX stay verbatim', () => {
    const body = ['**bold** and ~~gone~~', '[x](https://example.com/x)', '# No Heading'];
    const src = j('```md', ...body, '```');
    const out = toPlainText(src);
    const region = out.split('\n').slice(1, -1);
    expect(region).toEqual(body);
    expect(out).toContain('**bold**');
    expect(out).toContain('[x](https://example.com/x)');
    expect(out).toContain('# No Heading');
  });

  it('never wraps or glyph-substitutes long body lines', () => {
    const longLine = 'const veryLong = "aaaaaaaaaabbbbbbcccccdddddddeeeeeeffffffgggggghhhhhh";';
    const out = toPlainText(j('```js', longLine, '```'));
    expect(out.split('\n')).toContain(longLine);
    expect(out).not.toContain('•');
  });

  it('strips the fence indent only: bodies emit at column 0, relative indent kept', () => {
    const src = j('- item with code:', '', '  ```js', '  const a = 1;', '    const deeper = 2;', '  ```');
    const out = toPlainText(src);
    const lines = out.split('\n');
    expect(lines).toContain('const a = 1;');
    expect(lines).toContain('  const deeper = 2;');
  });

  it('CODE_DOC round-trips the whole block through the pipeline unchanged', () => {
    const out = toPlainText(CODE_DOC);
    expect(out.split('\n')).toEqual([
      '┄┄┄┄┄ js ┄┄┄┄┄',
      'const alpha = 1;',
      '',
      '',
      '  const beta = alpha * 2;',
      'const longLine = "aaaaaaaaaabbbbbbcccccdddddddeeeeeeffffffgggggghhhhhhiiiiii";',
      CODE15,
    ]);
  });
});

describe('§11 quality — nested structures', () => {
  it('bullet depth 1/2/3: marker + indent = 2 × (depth − 1)', () => {
    const src = j('- alpha', '  - beta', '    - gamma');
    expect(toPlainText(src)).toBe(j('• alpha', '  ◦ beta', '    ◦ gamma'));
  });

  it('ordered lists renumber at depth 1 and letter (a., b.) deeper', () => {
    const src = j('1. first', '2. second', '   1. inner alpha', '   2. inner beta');
    expect(toPlainText(src)).toBe(j('1. first', '2. second', '  a. inner alpha', '  b. inner beta'));
  });

  it('nested blockquotes repeat ┃ per depth', () => {
    expect(toPlainText(j('> outer', '> > inner'))).toBe(j('┃ outer', '┃ ┃ inner'));
    expect(toPlainText(j('> a', '> > b', '> > > c'))).toBe(j('┃ a', '┃ ┃ b', '┃ ┃ ┃ c'));
  });

  it('record tables preserve markdown in cells: decorated links and inline code survive', () => {
    const src = j(
      '| Item | Ref | Kind |',
      '| --- | --- | --- |',
      '| guide | [docs](https://example.com/d) | `x` |',
    );
    expect(toPlainText(src)).toBe(
      j(
        TFRAME,
        '',
        '[1] guide',
        `    Ref: docs (${ZWSP}https://example.com/d${ZWSP})`,
        '    Kind: 『x』',
        '',
        TFRAME,
      ),
    );
  });

  it('compact 2-column boxes keep decorated cell content in key-value pairs', () => {
    const src = j(
      '| Guide | Where |',
      '| --- | --- |',
      '| api | [docs](https://example.com/d) |',
    );
    expect(toPlainText(src)).toBe(
      j('┌─ Guides ──────', '', 'Guide  ─ api', `Where  ─ docs (${ZWSP}https://example.com/d${ZWSP})`, '', '└───────────────'),
    );
  });
});

describe('§11 quality — unicode safety', () => {
  it('combining sequences never split: e+U+0301 stays one cluster on wrapped lines', () => {
    const src = 'xxxxxxxxxx cafe\u0301 xxxxxxxxxx yyyyyyyyyy';
    expect(displayWidth('cafe\u0301')).toBe(4);
    const out = toPlainText(src, { maxWidth: 10 });
    expect(out).toBe(j('xxxxxxxxxx', 'cafe\u0301', 'xxxxxxxxxx', 'yyyyyyyyyy'));
    for (const line of out.split('\n')) expect(line.startsWith('\u0301')).toBe(false);
  });

  it('a ZWJ family emoji is one 2-column cluster and is never split by wrapping', () => {
    const family = '👨‍👩‍👧‍👦';
    expect(displayWidth(family)).toBe(2);
    const out = toPlainText(`ok ${family} end`, { maxWidth: 4 });
    expect(out).toBe(j('ok', family, 'end'));
    expect(out).toContain(family);
  });

  it('CJK cluster boundaries: a combining mark stays attached at a wrap break', () => {
    const src = '中\u0301文文文文文文文文文';
    const out = toPlainText(src, { maxWidth: 12 });
    expect(out).toBe(j('中\u0301文文文文文', '文文文文'));
    expect(out.split('\n').join('')).toBe(src);
    for (const line of out.split('\n')) expect(displayWidth(line)).toBeLessThanOrEqual(12);
  });

  it('astral-plane characters are iterated as one code point and stay intact', () => {
    expect(displayWidth('𝕏')).toBe(1);
    const out = toPlainText('𝕏 marks the spot', { maxWidth: 8 });
    expect(out).toBe(j('𝕏 marks', 'the spot'));
  });
});

describe('§11 quality — configurability', () => {
  it('bullet and bulletNested overrides replace the glyph at each depth', () => {
    const src = j('- alpha', '  - beta');
    expect(toPlainText(src, { bullet: '→', bulletNested: '↳' })).toBe(j('→ alpha', '  ↳ beta'));
  });

  it('quotePrefix override replaces the bar', () => {
    expect(toPlainText('> quoted', { quotePrefix: '| ' })).toBe('| quoted');
  });

  it('inlineCode mode changes rendering: bracket, verbatim, corner', () => {
    expect(toPlainText('use `x` here', { inlineCode: 'bracket' })).toBe('use ⦗ x ⦘ here');
    expect(toPlainText('use `x` here', { inlineCode: 'verbatim' })).toBe('use `x` here');
    expect(toPlainText('use `x` here', { inlineCode: 'corner' })).toBe('use 『x』 here');
  });

  it('table strategy override forces records for a 2-column table', () => {
    const src = j('| File | Size |', '| --- | --- |', '| report.pdf | 12 KB |');
    expect(toPlainText(src, { table: { strategy: 'record' } })).toBe(
      j(TFRAME, '', '[1] report.pdf', '    Size: 12 KB', '', TFRAME),
    );
  });

  it('hrule override replaces the decorated run', () => {
    expect(toPlainText('---', { hrule: '~*~' })).toBe('~*~');
  });

  it('code frame override changes frame, runs, and label', () => {
    const src = j('```js', 'const a = 1', '```');
    expect(toPlainText(src, { code: { frame: '*', topRun: 3, bottomRun: 7 } })).toBe(
      j('*** js ***', 'const a = 1', '*'.repeat(7)),
    );
    expect(toPlainText(src, { code: { frame: '*', bottomRun: 7, label: false } })).toBe(
      j('*'.repeat(7), 'const a = 1', '*'.repeat(7)),
    );
  });

  it('per-level heading overrides merge field-wise and change the row', () => {
    expect(toPlainText('## Setup', { headings: { 2: { prefix: '§ ', suffix: ' §' } } })).toBe('§ Setup §');
    expect(toPlainText('### Subsection', { headings: { 3: { suffix: ' ✦' } } })).toBe('◆ Subsection ✦');
  });

  it("glyphs: 'ascii' flips the whole bundle at once", () => {
    const src = j(
      '# Doc',
      '## Part',
      '- item',
      '- [ ] todo',
      '- [x] done',
      '> noted',
      '---',
      '```js',
      'const a = 1',
      '```',
    );
    const ascii = toPlainText(src, { glyphs: 'ascii' });
    expect(ascii).toBe(
      j(
        '==== Doc ====',
        '[ Part ]',
        '- item',
        '[ ] todo',
        '[x] done',
        '| noted',
        '-----',
        '----- js -----',
        'const a = 1',
        '-'.repeat(15),
      ),
    );
    const unicode = toPlainText(src);
    expect(unicode).not.toBe(ascii);
    expect(unicode).toContain('•');
    expect(ascii).not.toContain('•');
  });
});

describe("§11 quality — graceful degradation (glyphs: 'ascii')", () => {
  const ASCII_DOC = j(
    '# Doc',
    '## Part',
    '### Detail',
    '- item',
    '  - nested item',
    '1. first',
    '2. second',
    '- [ ] todo',
    '- [x] done',
    '> noted',
    '---',
    '```js',
    'const a = 1',
    '```',
    '',
    'Visit https://example.com/docs today',
    '',
    '| Name | Role | Base |',
    '| --- | --- | --- |',
    '| Ada | Architect | 10 |',
  );

  // Fully-ASCII contract: every bundle member (table frames, headings,
  // bullets, quote prefix, tasks, code frame, hrule) and the compact box
  // glyphs resolve to pure ASCII under `glyphs: 'ascii'` (§11 requirement 9,
  // "Graceful degradation | ASCII alternatives are available"), so ASCII
  // input never yields non-ASCII decoration.
  it('ASCII input text yields a fully ASCII output: every code point < 128', () => {
    const out = toPlainText(ASCII_DOC, { glyphs: 'ascii' });
    expect(out).toMatch(/^[\x20-\x7E\n]*$/);
    for (const unit of ['Ada', 'Architect', 'https://example.com/docs', 'todo', 'noted']) {
      expect(out).toContain(unit);
    }
  });
});

describe('§11 quality — idempotence', () => {
  it('kitchen sink: toPlainText(toPlainText(x)) === toPlainText(x)', () => {
    const once = toPlainText(KITCHEN_SINK);
    expect(toPlainText(once)).toBe(once);
  });

  it('kitchen sink at compact profile is stable under reprocessing', () => {
    const once = toPlainText(KITCHEN_SINK, { profile: 'compact' });
    expect(toPlainText(once, { profile: 'compact' })).toBe(once);
  });

  it('wrap-heavy document does not compound wrapping', () => {
    const once = toPlainText(WRAP_HEAVY);
    expect(toPlainText(once)).toBe(once);
  });

  it('table document does not re-render decorated blocks', () => {
    const once = toPlainText(TABLE_DOC);
    expect(toPlainText(once)).toBe(once);
  });

  it('code document body is not re-decorated or re-wrapped', () => {
    const once = toPlainText(CODE_DOC);
    expect(toPlainText(once)).toBe(once);
  });

  it('tasks and quotes document does not compound glyphs or bars', () => {
    const once = toPlainText(TASKS_QUOTES);
    expect(toPlainText(once)).toBe(once);
  });
});
