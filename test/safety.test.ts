import { describe, expect, it } from 'vitest';
import { toPlainText, toPseudoMarkdown } from '../src/index.js';
import { isDelimiterRow, isPipeRow, splitRow } from '../src/table/parse.js';

// ┄ code frames: labeled top `┄┄┄┄┄ lang ┄┄┄┄┄`, bare top/bottom ┄×15.
const CODE15 = '┄'.repeat(15);

/** True when `s` contains any codepoint of the sentinel pool U+E000–U+E0FF. */
const hasPoolChar = (s: string): boolean => /[\uE000-\uE0FF]/.test(s);

describe('PUA sentinels in input (dynamic allocation)', () => {
  it('passes U+E000 through intact and allocates around it (plain)', () => {
    const out = toPlainText('\uE000 only **b**');
    expect(out).toBe('\uE000 only b');
    expect(out.includes('\uE000')).toBe(true);
    // no sentinel from the rest of the pool may leak
    expect(out).not.toMatch(/[\uE001-\uE0FF]/);
  });

  it('passes U+E000 through intact (pseudo)', () => {
    const out = toPseudoMarkdown('\uE000 only **b**');
    expect(out).toBe('\uE000 only **b**');
    expect(out).not.toMatch(/[\uE001-\uE0FF]/);
  });

  it('collides safely when the first three pool codepoints are already used', () => {
    const input = '\uE000\uE001\uE002 see https://a.com/x end';
    expect(toPlainText(input)).toBe(input);
    expect(toPseudoMarkdown(input)).toBe(input);
    expect(toPlainText(input)).not.toMatch(/[\uE003-\uE0FF]/);
  });

  it('throws an explicit error when fewer than 3 pool codepoints remain', () => {
    // 254 of the 256 U+E000–U+E0FF codepoints used → only 2 free → pool exhausted
    const exhausted = Array.from({ length: 254 }, (_, i) => String.fromCodePoint(0xe000 + i)).join('');
    expect(() => toPlainText(exhausted)).toThrow(/sentinel pool exhausted/);
    expect(() => toPseudoMarkdown(exhausted)).toThrow(/sentinel pool exhausted/);
  });
});

describe('sentinel non-leak on PUA-free input', () => {
  const battery: string[] = [
    '# Title\n\nSome **bold** and *italic* and ~~gone~~ text.',
    'url https://example.com/a?b=1&c=2#frag and https://other.io/x',
    '[label](https://example.com) and ![img](https://img.example/i.png)',
    'code `inline x` and ```js\nblock()\n``` end',
    '- a\n- b\n  - c\n1. one\n2. two',
    '> deep\n>> deeper\n>>> deepest',
    '| N | V |\n| --- | --- |\n| a | b |',
    'say \\"q\\" a\n\n\n\n\nb   ',
    '````\n```inner\n```\n````',
    '```\n| a |\n| --- |\n| b |\n```',
    'check this out https://example.com/page?q=1 end',
  ];

  it.each(battery.map((input, i) => [i, input] as const))('battery case %i leaks no sentinel (plain)', (_i, input) => {
    expect(hasPoolChar(toPlainText(input))).toBe(false);
  });

  it.each(battery.map((input, i) => [i, input] as const))('battery case %i leaks no sentinel (pseudo)', (_i, input) => {
    expect(hasPoolChar(toPseudoMarkdown(input))).toBe(false);
  });
});

describe('weird unicode never throws', () => {
  it('passes a lone surrogate through on both pipelines', () => {
    expect(toPlainText('\uD800 alone')).toBe('\uD800 alone');
    expect(toPseudoMarkdown('\uD800 tail')).toBe('\uD800 tail');
    expect(toPlainText('**\uD800**')).toBe('\uD800');
  });

  it('passes ZWJ emoji sequences through intact', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
    expect(toPlainText(`family ${family} photo`)).toBe(`family ${family} photo`);
    expect(toPseudoMarkdown(`# ${family} T`)).toBe(`# ${family} T`);
  });

  it('passes combining marks through intact', () => {
    expect(toPlainText('cafe\u0301 **b**')).toBe('cafe\u0301 b');
    expect(toPseudoMarkdown('cafe\u0301 *b*')).toBe('cafe\u0301 *b*');
  });

  it('handles a 10k+ single-line input deterministically', () => {
    const long = `${'x'.repeat(10000)} https://example.com/long ${'y'.repeat(500)}`;
    const a = toPlainText(long);
    expect(a).toBe(long.trim());
    expect(a.includes('https://example.com/long')).toBe(true);
    expect(a).toBe(toPlainText(long));
    expect(toPseudoMarkdown(long)).toBe(toPseudoMarkdown(long));
  });

  it('handles a very long fenced body deterministically', () => {
    const input = `before\n\`\`\`\n${'line\n'.repeat(2000)}\`\`\`\nafter`;
    const plain = toPlainText(input);
    expect(plain.startsWith(`before\n${CODE15}\n`)).toBe(true);
    expect(plain.includes(`${CODE15}\nline`)).toBe(true);
    expect(plain).toBe(toPlainText(input));
    expect(toPseudoMarkdown(input)).toBe(toPseudoMarkdown(input));
  });
});

describe('unclosed and nested fences', () => {
  it('passes an unclosed fence through raw on both pipelines', () => {
    expect(toPlainText('```\nnot closed')).toBe('```\nnot closed');
    expect(toPseudoMarkdown('```js\nnot closed')).toBe('```js\nnot closed');
  });

  it('lets a 4+-backtick outer fence win over inner 3-backtick fences (body verbatim)', () => {
    // The outer fence consumes inner ``` blocks verbatim; the plain path
    // frames the WHOLE body as one code block.
    expect(toPlainText('````\n```js\nq()\n```\n````')).toBe(`${CODE15}\n\`\`\`js\nq()\n\`\`\`\n${CODE15}`);
    expect(toPseudoMarkdown('````\n```js\nq()\n```\n````')).toBe('````\n```js\nq()\n```\n````');
  });

  it('never misparses pipe rows inside a fence as a table', () => {
    const expected = `${CODE15}\n| a |\n| --- |\n| b |\n${CODE15}`;
    expect(toPlainText('```\n| a |\n| --- |\n| b |\n```')).toBe(expected);
    expect(toPseudoMarkdown('```\n| a |\n| --- |\n| b |\n```')).toBe('```\n| a |\n| --- |\n| b |\n```');
  });
});

describe('escaped pipe vs pipe — splitRow unit tests (src/table/parse.ts)', () => {
  it('splits on unescaped pipes and drops boundary artifacts', () => {
    expect(splitRow('| a | b |')).toEqual(['a', 'b']);
    expect(splitRow('a | b')).toEqual(['a', 'b']);
    expect(splitRow('|  single  |')).toEqual(['single']);
  });

  it('treats \\| as a literal pipe inside a cell', () => {
    expect(splitRow('| a \\| b | c |')).toEqual(['a | b', 'c']);
    expect(splitRow('| a \\| b |')).toEqual(['a | b']);
  });

  it('preserves interior empty cells and trims cells', () => {
    expect(splitRow('| x |  | y |')).toEqual(['x', '', 'y']);
    expect(splitRow('|  | a |')).toEqual(['', 'a']);
  });

  it('recognizes pipe rows with up to 3 leading spaces', () => {
    expect(isPipeRow('| x')).toBe(true);
    expect(isPipeRow(' | x')).toBe(true);
    expect(isPipeRow('  | x')).toBe(true);
    expect(isPipeRow('   | x')).toBe(true);
    expect(isPipeRow('    | x')).toBe(false);
    expect(isPipeRow('nope')).toBe(false);
  });

  it('recognizes GFM delimiter rows only', () => {
    expect(isDelimiterRow('| --- | --- |')).toBe(true);
    expect(isDelimiterRow('| :-- | --: |')).toBe(true);
    expect(isDelimiterRow('| :-: | --- |')).toBe(true);
    expect(isDelimiterRow('| - |')).toBe(true);
    expect(isDelimiterRow('| a | b |')).toBe(false);
    expect(isDelimiterRow('---')).toBe(false);
    expect(isDelimiterRow('|')).toBe(false);
  });
});

describe('escaped pipes end-to-end', () => {
  it('renders an escaped pipe cell as literal content in the compact box', () => {
    const top = '┌─ Cmds ──────';
    expect(toPlainText('| Cmd | Out |\n| --- | --- |\n| a \\| b | c |')).toBe(
      `${top}\n\nCmd  ─ a | b\nOut  ─ c\n\n└─────────────`,
    );
  });
});

describe('determinism', () => {
  const kitchenSink = [
    '# Report',
    '',
    'Intro https://a.com?p=1 text.',
    '',
    '- one',
    '  - two',
    '1. ordered',
    '',
    '> quoted',
    '>> deeper',
    '',
    '---',
    '',
    '**bold** *it* ~~gone~~ `code()`',
    '',
    '![img](https://i.x/p.png)',
    '',
    '[lbl](https://l.io)',
    '',
    '```ts',
    'const k = 1;',
    '```',
    '',
    '| N | V |',
    '| --- | --- |',
    '| a | 1 |',
    '',
    'say \\"hi\\"',
    '',
    '',
    '',
    'tail   ',
  ].join('\n');

  it('produces byte-identical output across repeated calls on both pipelines', () => {
    expect(toPlainText(kitchenSink)).toBe(toPlainText(kitchenSink));
    expect(toPseudoMarkdown(kitchenSink)).toBe(toPseudoMarkdown(kitchenSink));
  });

  it('leaks no sentinel codepoint into either kitchen-sink output', () => {
    expect(hasPoolChar(toPlainText(kitchenSink))).toBe(false);
    expect(hasPoolChar(toPseudoMarkdown(kitchenSink))).toBe(false);
  });

  it('keeps protected spans byte-identical in both kitchen-sink outputs', () => {
    const plain = toPlainText(kitchenSink);
    const pseudo = toPseudoMarkdown(kitchenSink);
    expect(plain).toContain('https://a.com?p=1');
    expect(plain).toContain('『code()』');
    expect(plain).toContain('┌─ Ns ──────'); // 2-col table → compact box on plain too
    expect(pseudo).toContain('```ts\nconst k = 1;\n```');
    expect(pseudo).toContain('https://a.com?p=1');
    expect(pseudo).toContain('┌─ Ns ──────'); // pseudo tables stay enabled by default
  });

  it('keeps every source URL recoverable from both outputs', () => {
    const plain = toPlainText(kitchenSink);
    const pseudo = toPseudoMarkdown(kitchenSink);
    for (const url of ['https://i.x/p.png', 'https://l.io']) {
      expect(plain).toContain(url);
      expect(pseudo).toContain(url);
    }
  });
});
