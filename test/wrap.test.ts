import { describe, expect, it } from 'vitest';
import { toPlainText } from '../src/plain.js';
import { toPseudoMarkdown } from '../src/pseudo.js';
import { WIDTH_PROFILES, displayWidth } from '../src/core/width.js';
import { wrapProse } from '../src/core/wrap.js';
import type { WrapOptions } from '../src/core/wrap.js';

// Structural stand-in for ResolvedOptions matching the unicode defaults.
const OPTS: WrapOptions = {
  width: 40,
  code: { frame: '┄', topRun: 5, bottomRun: 15, label: true },
  table: { open: '════════ ✧･ﾟ ════════', close: '════════ ✧･ﾟ ════════' },
};

const at = (width: number): WrapOptions => ({ ...OPTS, width });

/** Every output line stays within the budget; joining restores the input. */
function expectWrapped(text: string, out: string, width: number): void {
  const lines = out.split('\n');
  expect(lines.length).toBeGreaterThan(1);
  for (const line of lines) expect(displayWidth(line)).toBeLessThanOrEqual(width);
  expect(lines.join(' ')).toBe(text);
}

describe('wrap — default-on prose wrapping', () => {
  const prose =
    'The quick brown fox jumps over the lazy dog and keeps running far beyond forty columns';

  it('wraps English prose at 40 columns by default, splitting only at spaces', () => {
    expectWrapped(prose, toPlainText(prose), WIDTH_PROFILES.standard);
  });

  it('never merges short lines or intentional breaks', () => {
    const text = 'one\ntwo\nthree';
    expect(toPlainText(text)).toBe('one\ntwo\nthree');
    expect(toPlainText('first\n\nsecond')).toBe('first\n\nsecond');
  });

  it('preserves paragraph structure across the pass', () => {
    const doc = `${prose}\n\nshort tail line`;
    const out = toPlainText(doc);
    expect(out.split('\n\n')).toHaveLength(2);
    expect(out.endsWith('short tail line')).toBe(true);
  });

  it('honor the compact (32) and comfortable (60) profiles', () => {
    const words = ['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10), 'd'.repeat(10), 'e'.repeat(10), 'f'.repeat(10), 'g'.repeat(10), 'h'.repeat(10)];
    const text = words.join(' ');

    const compact = toPlainText(text, { profile: 'compact' });
    const compactLines = compact.split('\n');
    expect(compactLines).toHaveLength(3); // 3+3+2 words at 32 columns
    for (const line of compactLines) {
      expect(displayWidth(line)).toBeLessThanOrEqual(WIDTH_PROFILES.compact);
    }
    expect(compactLines.join(' ')).toBe(text);

    const comfortable = toPlainText(text, { profile: 'comfortable' });
    const comfortableLines = comfortable.split('\n');
    expect(comfortableLines).toHaveLength(2); // 5+3 words at 60 columns
    for (const line of comfortableLines) {
      expect(displayWidth(line)).toBeLessThanOrEqual(WIDTH_PROFILES.comfortable);
    }
    expect(comfortableLines.join(' ')).toBe(text);
  });

  it('does not wrap when wrap:false', () => {
    expect(toPlainText(prose, { wrap: false })).toBe(prose);
  });

  it('never wraps the pseudo pipeline, even with wrap:true', () => {
    expect(toPseudoMarkdown(prose)).toBe(prose);
    expect(toPseudoMarkdown(prose, { wrap: true })).toBe(prose);
  });

  it('is deterministic across runs', () => {
    expect(toPlainText(prose)).toBe(toPlainText(prose));
    expect(wrapProse(prose, OPTS)).toBe(wrapProse(prose, OPTS));
  });
});

describe('wrap — unsplittable tokens', () => {
  it('never wraps a line carrying a protected URL sentinel token', () => {
    // Wrap runs before restore: the URL is a sentinel token, so its line is
    // skipped whole — never measured, never split.
    const url = `https://example.com/${'a'.repeat(40)}`; // exactly 60 columns
    const line = `See ${url} today`;
    expect(toPlainText(line, { maxWidth: 40 })).toBe(line);
  });

  it('puts an 80-column plain token on its own line, unsplit, on a width-20 line', () => {
    const token = 'y'.repeat(80);
    expect(wrapProse(`aa ${token} bb cc`, at(20)).split('\n')).toEqual(['aa', token, 'bb cc']);
  });

  it('counts emoji as two columns when deciding to wrap', () => {
    // 30 + 1 + 5×2 = 41 > 40 only if each emoji is 2 columns.
    const line = `${'x'.repeat(30)} ${'👍'.repeat(5)}`;
    const out = toPlainText(line, { maxWidth: 40 });
    expect(out.split('\n')).toEqual(['x'.repeat(30), '👍'.repeat(5)]);
  });
});

describe('wrap — markdown-aware break points', () => {
  it('never splits inside a bracketed link, even with multi-word link text', () => {
    const line = 'Here is [a link with several words](target) and more prose following it';
    const lines = wrapProse(line, at(20)).split('\n');
    expect(lines).toEqual([
      'Here is',
      '[a link with several words](target)', // over-wide construct: own overflowing line
      'and more prose',
      'following it',
    ]);
    expect(lines.join(' ')).toBe(line);
  });

  it('never splits inside an emphasis run', () => {
    const line = 'This line has **bold text inside markers** plus trailing words to wrap';
    const lines = wrapProse(line, at(20)).split('\n');
    expect(lines).toEqual([
      'This line has',
      '**bold text inside markers**',
      'plus trailing words',
      'to wrap',
    ]);
    expect(lines.join(' ')).toBe(line);
  });

  it('never splits inside backtick inline code', () => {
    const line = 'Run `npm install quickly` then verify the output logs carefully today';
    const lines = wrapProse(line, at(20)).split('\n');
    expect(lines).toEqual([
      'Run',
      '`npm install quickly`',
      'then verify the',
      'output logs',
      'carefully today',
    ]);
    expect(lines.join(' ')).toBe(line);
  });

  it('resumes normal breaking once a construct closes', () => {
    const line = 'a [link](t) then plain words keep wrapping at the twenty column budget here';
    const lines = wrapProse(line, at(20)).split('\n');
    expect(lines.join(' ')).toBe(line);
    for (const l of lines) expect(displayWidth(l)).toBeLessThanOrEqual(20);
    expect(lines).toEqual([
      'a [link](t) then',
      'plain words keep',
      'wrapping at the',
      'twenty column budget',
      'here',
    ]);
  });

  it('measures raw markdown text: a marker-heavy construct overflows whole, never truncates', () => {
    // '**aaaa bbbb cccc dddd**' is 23 RAW columns (markers count), so it
    // takes its own overflowing line and 'tail' wraps after it.
    const line = '**aaaa bbbb cccc dddd** tail';
    expect(wrapProse(line, at(20)).split('\n')).toEqual(['**aaaa bbbb cccc dddd**', 'tail']);
    expect(wrapProse(line, at(20)).split('\n').join(' ')).toBe(line);
  });
});

describe('wrap — CJK runs', () => {
  it('breaks a 30-char CJK run between characters on a width-20 line', () => {
    const run = '中'.repeat(30);
    const out = toPlainText(run, { maxWidth: 20 });
    expect(out.split('\n')).toEqual([run.slice(0, 10), run.slice(10, 20), run.slice(20, 30)]);
    for (const line of out.split('\n')) expect(displayWidth(line)).toBe(20);
    expect(out.split('\n').join('')).toBe(run);
  });

  it('never splits inside a grapheme cluster: combining marks stay with their base', () => {
    const cluster = '中\u0301'; // base + combining acute, 2 columns total
    const run = cluster.repeat(15); // 15 clusters, 30 columns
    const out = toPlainText(run, { maxWidth: 20 });
    const lines = out.split('\n');
    expect(lines).toHaveLength(2); // 10 clusters (20 cols) + 5 clusters
    expect(lines[0]).toBe(cluster.repeat(10));
    expect(lines[1]).toBe(cluster.repeat(5));
    expect(lines.join('')).toBe(run);
  });
});

describe('wrap — sentinel lines skip whole', () => {
  it('never measures or splits a line holding a U+E000–U+E0FF token', () => {
    const line = `before \uE000U0\uE001 after plenty of words to force a wrap at this width`;
    expect(displayWidth(line)).toBeGreaterThan(20);
    expect(wrapProse(line, at(20))).toBe(line);
  });

  it('keeps a fenced code block (a single sentinel line here) byte-identical', () => {
    const body = `const veryLongIdentifier = "${'x'.repeat(60)}"`;
    const proseLine =
      'This opening paragraph carries plenty of words so the wrapping pass must reflow it at the default width.';
    const doc = `${proseLine}\n\n\`\`\`ts\n${body}\n\`\`\`\n\ntrailing prose after the block that definitely must wrap now`;
    const out = toPlainText(doc);
    expect(out).toContain(body);
    expect(out).toContain('┄┄┄┄┄ ts ┄┄┄┄┄');
    expect(out.split('\n')).toContain('┄'.repeat(15));
    expect(out).toContain('trailing prose after the block that\ndefinitely must wrap now');
  });
});

describe('wrap — source-syntax skips pass through byte-identical', () => {
  it('skips an oversized source heading regardless of width', () => {
    const long = `# a heading line that runs far beyond the twenty column budget here`;
    expect(displayWidth(long)).toBeGreaterThan(20);
    expect(wrapProse(long, at(20))).toBe(long);
  });

  it('wraps heading lookalikes: no space after #, or 7+ hash marks', () => {
    const noSpace = '#nospace heading lookalike that must wrap like normal prose here';
    expectWrapped(noSpace, wrapProse(noSpace, at(20)), 20);
    const seven = '####### seven hashes is not an atx heading so the pass reflows it';
    expectWrapped(seven, wrapProse(seven, at(20)), 20);
  });

  it('skips blockquote lines, including indented ones', () => {
    const quote = '> a quoted line that runs far beyond the twenty column wrap budget';
    expect(wrapProse(quote, at(20))).toBe(quote);
    const indented = '  > quoted with indent far beyond the twenty column budget here';
    expect(wrapProse(indented, at(20))).toBe(indented);
  });

  it('skips bullet, ordered, and task list items', () => {
    const bullet = '- a list item with plenty of words exceeding the twenty column width';
    expect(wrapProse(bullet, at(20))).toBe(bullet);
    const ordered = '12. an ordered item with plenty of words exceeding twenty columns';
    expect(wrapProse(ordered, at(20))).toBe(ordered);
    const task = '- [ ] a task item with plenty of words exceeding the twenty column width';
    expect(wrapProse(task, at(20))).toBe(task);
  });

  it('skips thematic breaks of any marker', () => {
    expect(wrapProse('---', at(20))).toBe('---');
    const stars = '* '.repeat(23).trimEnd(); // 45 columns
    expect(wrapProse(stars, at(20))).toBe(stars);
    const dashes = '-'.repeat(60);
    expect(wrapProse(dashes, at(20))).toBe(dashes);
  });

  it('skips indented code blocks', () => {
    const code = '    const deeply = nested.that.exceeds.the.wrap.width.easily.here';
    expect(displayWidth(code)).toBeGreaterThan(20);
    expect(wrapProse(code, at(20))).toBe(code);
  });

  it('skips reference definitions', () => {
    const ref = '[label]: https://example.com/a/very/long/reference/target/path';
    expect(wrapProse(ref, at(20))).toBe(ref);
  });
});

describe('wrap — decorated regions still skip (defensive at this seam)', () => {
  const proseLine =
    'This opening paragraph carries plenty of words so the wrapping pass must reflow it at the default width.';

  it('leaves record table blocks verbatim between open and close frames', () => {
    const value = 'aVeryLongCellValueThatWouldWrapIfItWereProseButMustStayIntactEndsHere';
    const doc = [
      proseLine,
      '',
      '| Key | Value |',
      '| --- | --- |',
      `| alpha | ${value} |`,
      '',
      'closing prose that must wrap around here somewhere',
    ].join('\n');
    const base = toPlainText(doc, { wrap: false, table: { strategy: 'record' } }).split('\n');
    const out = toPlainText(doc, { table: { strategy: 'record' } }).split('\n');
    const frame = '════════ ✧･ﾟ ════════';
    const openBase = base.indexOf(frame);
    const openOut = out.indexOf(frame);
    const closeBase = base.lastIndexOf(frame);
    const closeOut = out.lastIndexOf(frame);
    expect(openOut).toBeGreaterThanOrEqual(0);
    expect(closeOut).toBeGreaterThan(openOut);
    expect(out.slice(openOut, closeOut + 1)).toEqual(base.slice(openBase, closeBase + 1));
    expect(out.some((line) => line.includes(value))).toBe(true);
    // The pass still wrapped the prose around the table.
    expect(out.length).toBeGreaterThan(base.length);
  });

  it('leaves compact table boxes (┌…└) verbatim', () => {
    const value = 'aVeryLongCompactCellValueThatNoWrappingPassMayEverTouchAtAll';
    const doc = [
      proseLine,
      '',
      '| Key | Value |',
      '| --- | --- |',
      `| alpha | ${value} |`,
    ].join('\n');
    const base = toPlainText(doc, { wrap: false, table: { strategy: 'compact' } }).split('\n');
    const out = toPlainText(doc, { table: { strategy: 'compact' } }).split('\n');
    const topOut = out.findIndex((line) => line.startsWith('┌'));
    const bottomOut = out.findIndex((line) => line.startsWith('└'));
    const topBase = base.findIndex((line) => line.startsWith('┌'));
    const bottomBase = base.findIndex((line) => line.startsWith('└'));
    expect(topOut).toBeGreaterThanOrEqual(0);
    expect(bottomOut).toBeGreaterThan(topOut);
    expect(out.slice(topOut, bottomOut + 1)).toEqual(base.slice(topBase, bottomBase + 1));
    expect(out.some((line) => line.includes(value))).toBe(true);
    expect(out.length).toBeGreaterThan(base.length);
  });

  it('keeps decorated code regions verbatim and wraps after they close', () => {
    const text = ['┄┄┄┄┄ js ┄┄┄┄┄', 'x'.repeat(50), '┄'.repeat(15), 'prose that must wrap now'].join('\n');
    expect(wrapProse(text, at(20)).split('\n')).toEqual([
      '┄┄┄┄┄ js ┄┄┄┄┄',
      'x'.repeat(50),
      '┄'.repeat(15),
      'prose that must wrap',
      'now',
    ]);
  });

  it('treats a bare frame run as an unlabeled region opener', () => {
    const text = ['┄'.repeat(15), 'body line'.repeat(6), '┄'.repeat(15), 'prose that must wrap now'].join('\n');
    expect(wrapProse(text, at(20)).split('\n')).toEqual([
      '┄'.repeat(15),
      'body line'.repeat(6),
      '┄'.repeat(15),
      'prose that must wrap',
      'now',
    ]);
  });
});

describe('wrap — pipeline: headings stay exactly one row', () => {
  it('keeps a bare degraded h1 title on one overflowing row', () => {
    expect(toPlainText('# Getting Started', { maxWidth: 15 })).toBe('Getting Started');
    expect(toPlainText('# Getting Started', { maxWidth: 14 })).toBe('Getting Started');
  });

  it('keeps oversized h2/h3 degradations and a degraded framed h1 on one row', () => {
    const long = 'A section title far wider than the standard display width allows';
    expect(toPlainText(`## ${long}`)).toBe(long);
    expect(toPlainText(`### ${long}`)).toBe(long);
    const framed = toPlainText(`# ${long}`, { maxWidth: 20 });
    expect(framed).toBe(long);
    expect(framed.includes('\n')).toBe(false);
  });
});

describe('wrap — pipeline: constructs stay one row while prose wraps', () => {
  const prose =
    'This opening paragraph carries plenty of words so the wrapping pass must reflow it at the default width.';

  it('wraps surrounding prose but keeps quote/list/task/ordered rows whole', () => {
    const doc = [
      prose,
      '',
      '> A quoted line that runs well beyond the forty column width yet must never be wrapped at all.',
      '',
      '- A list item with plenty of words that easily exceeds the forty column wrap width and stays whole.',
      '',
      '- [ ] A task item with plenty of words that easily exceeds the forty column wrap width and stays whole.',
      '',
      '12. An ordered item with plenty of words that easily exceeds the forty column wrap width and stays whole.',
    ].join('\n');
    const lines = toPlainText(doc).split('\n');
    const quote = lines.find((line) => line.startsWith('┃ '))!;
    const bullet = lines.find((line) => line.startsWith('• '))!;
    const task = lines.find((line) => line.startsWith('☐ '))!;
    const ordered = lines.find((line) => line.includes('An ordered item'))!;
    for (const row of [quote, bullet, task, ordered]) {
      expect(displayWidth(row)).toBeGreaterThan(WIDTH_PROFILES.standard);
    }
    // The opening prose DID wrap (three lines at 40 columns).
    expect(lines.length).toBeGreaterThan(doc.split('\n').length);
    expect(lines.slice(0, 3).join(' ')).toBe(prose);
  });
});

describe('wrapProse — unit edge cases', () => {
  it('keeps continuation lines flush left but preserves the first line indent', () => {
    // A 4+-space lead is indented code (skipped); use a shallow indent.
    const out = wrapProse('  aaaa bb cc dd', at(10));
    const lines = out.split('\n');
    expect(lines[0]).toBe('  aaaa bb'); // lead counted against the 10-column budget
    expect(lines[1]).toBe('cc dd'); // flush left, full budget
  });
});
