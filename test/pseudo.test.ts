import { describe, expect, it } from 'vitest';
import { toPseudoMarkdown } from '../src/index.js';

// ┄ code frames: labeled top `┄┄┄┄┄ lang ┄┄┄┄┄`, bare top/bottom ┄×15.
const CODE15 = '┄'.repeat(15);
// Table frame: 8×═ + ` ✧･ﾟ ` (U+2727 U+FF65 U+FF9F) + 8×═; open === close.
const TFRAME = '\u2550'.repeat(8) + ' \u2727\uFF65\uFF9F ' + '\u2550'.repeat(8);
const compactTop = (label: string): string => `┌─ ${label} ${'─'.repeat(6)}`;
const compactBottom = (top: string): string => `└${'─'.repeat(top.length - 1)}`;
// U+200B zero-width space: the auto-linker guard around synthesized URL wraps.
const ZWSP = '\u200B';
/** Pseudo-path overline override: every content char followed by U+0336. */
const overline = (s: string): string => [...s].map((c) => `${c}\u0336`).join('');

describe('toPseudoMarkdown — input guards', () => {
  it('returns empty for empty string', () => {
    expect(toPseudoMarkdown('')).toBe('');
  });

  it('returns empty for null and undefined', () => {
    expect(toPseudoMarkdown(null as never)).toBe('');
    expect(toPseudoMarkdown(undefined as never)).toBe('');
  });

  it('returns empty for non-string input', () => {
    expect(toPseudoMarkdown(7 as never)).toBe('');
  });

  it('returns empty for whitespace-only input', () => {
    expect(toPseudoMarkdown('   ')).toBe('');
    expect(toPseudoMarkdown('\t\n')).toBe('');
    expect(toPseudoMarkdown('   \n  ')).toBe('');
  });

  it('passes plain text through', () => {
    expect(toPseudoMarkdown('hello world')).toBe('hello world');
  });
});

describe('toPseudoMarkdown — headings (preserved)', () => {
  it('keeps the hash marks and normalizes the separator, title trimmed', () => {
    expect(toPseudoMarkdown('# Title')).toBe('# Title');
    expect(toPseudoMarkdown('# Keep CAPS')).toBe('# Keep CAPS');
    expect(toPseudoMarkdown('##    Spaced\ttitle ')).toBe('## Spaced\ttitle');
    expect(toPseudoMarkdown('###### deep')).toBe('###### deep');
  });

  it('drops a heading line with an empty title', () => {
    expect(toPseudoMarkdown('#\t')).toBe('');
    expect(toPseudoMarkdown('keep\n# \nme')).toBe('keep\n\nme');
  });

  it('treats 7+ hash marks as not a heading', () => {
    expect(toPseudoMarkdown('####### seven')).toBe('####### seven');
  });
});

describe('toPseudoMarkdown — horizontal rules (preserved)', () => {
  it('normalizes matched rule runs to --- by default', () => {
    expect(toPseudoMarkdown('before\n---\nafter')).toBe('before\n---\nafter');
    expect(toPseudoMarkdown('***')).toBe('---');
    expect(toPseudoMarkdown('___')).toBe('---');
    expect(toPseudoMarkdown('----------')).toBe('---');
    expect(toPseudoMarkdown('--- ---')).toBe('---');
    expect(toPseudoMarkdown('   ---')).toBe('---');
  });

  it('rejects 4+ leading spaces (indented-code territory) and 2-char runs', () => {
    expect(toPseudoMarkdown('before\n    ---\nafter')).toBe('before\n    ---\nafter');
    expect(toPseudoMarkdown('--')).toBe('--');
  });

  it('decorates on override', () => {
    expect(toPseudoMarkdown('---', { hruleMode: 'decorate' })).toBe('─────');
  });
});

describe('toPseudoMarkdown — blockquotes (preserved)', () => {
  it('keeps > lines untouched, depth markers included', () => {
    expect(toPseudoMarkdown('> quoted text')).toBe('> quoted text');
    expect(toPseudoMarkdown('>> nested')).toBe('>> nested');
    expect(toPseudoMarkdown('> > spaced')).toBe('> > spaced');
  });

  it('bars quotes with ┃ on override', () => {
    expect(toPseudoMarkdown('> quoted text', { blockquotes: 'bar' })).toBe('┃ quoted text');
    expect(toPseudoMarkdown('>> nested', { blockquotes: 'bar' })).toBe('┃ ┃ nested');
  });
});

describe('toPseudoMarkdown — lists (level-normalized)', () => {
  it('normalizes unordered list markers to "- "', () => {
    expect(toPseudoMarkdown('- item 1\n- item 2')).toBe('- item 1\n- item 2');
    expect(toPseudoMarkdown('* star\n+ plus')).toBe('- star\n- plus');
  });

  it('normalizes indent to 2 spaces per level, capped at level 3', () => {
    expect(toPseudoMarkdown('- a\n  - b\n     - c\n        - d')).toBe('- a\n  - b\n    - c\n      - d');
  });

  it('keeps ordered lists and their numbers (ordered: preserve)', () => {
    expect(toPseudoMarkdown('1. first\n2. second')).toBe('1. first\n2. second');
  });

  it('re-pads ordered lists at 2 spaces per detected level', () => {
    expect(toPseudoMarkdown('1. a\n     9. b')).toBe('1. a\n    9. b');
  });
});

describe('toPseudoMarkdown — emphasis (normalized and preserved)', () => {
  it('preserves bold and italic', () => {
    expect(toPseudoMarkdown('**bold**')).toBe('**bold**');
    expect(toPseudoMarkdown('*italic*')).toBe('*italic*');
  });

  it('normalizes underscore delimiters to asterisks', () => {
    expect(toPseudoMarkdown('__bold__')).toBe('**bold**');
    expect(toPseudoMarkdown('_italic_')).toBe('*italic*');
    expect(toPseudoMarkdown('___both___')).toBe('***both***');
    expect(toPseudoMarkdown('***both***')).toBe('***both***');
  });
});

describe('toPseudoMarkdown — strikethrough (preserved)', () => {
  it('keeps ~~ markers by default', () => {
    expect(toPseudoMarkdown('~~deleted~~')).toBe('~~deleted~~');
    expect(toPseudoMarkdown('a ~~b~~ c')).toBe('a ~~b~~ c');
  });

  it('overlines on override', () => {
    expect(toPseudoMarkdown('~~gone~~', { strikethrough: 'overline' })).toBe(overline('gone'));
    expect(toPseudoMarkdown('~~two words~~', { strikethrough: 'overline' })).toBe(overline('two words'));
  });

  it('strips markers on override', () => {
    expect(toPseudoMarkdown('~~gone~~', { strikethrough: 'strip' })).toBe('gone');
  });
});

describe('toPseudoMarkdown — images (raw by default)', () => {
  it('leaves images as raw markdown by default', () => {
    expect(toPseudoMarkdown('![alt text](https://example.com/img.png)')).toBe(
      '![alt text](https://example.com/img.png)',
    );
    expect(toPseudoMarkdown('![](https://example.com/i.png)')).toBe('![](https://example.com/i.png)');
  });

  it('decorates images on override like links (guarded alt, bare URL for empty alt)', () => {
    expect(toPseudoMarkdown('![alt text](https://example.com/img.png)', { links: 'decorated' })).toBe(
      `alt text (${ZWSP}https://example.com/img.png${ZWSP})`,
    );
    expect(toPseudoMarkdown('![](https://example.com/i.png)', { links: 'decorated' })).toBe('https://example.com/i.png');
    expect(toPseudoMarkdown('![p](https://example.com/i.png)', { links: 'urlOnly' })).toBe('https://example.com/i.png');
  });
});

describe('toPseudoMarkdown — links (verbatim by default)', () => {
  it('preserves links unchanged', () => {
    expect(toPseudoMarkdown('[link text](https://example.com)')).toBe('[link text](https://example.com)');
  });

  it('supports all three link modes as overrides (details in options suite)', () => {
    expect(toPseudoMarkdown('[t](https://x.com)', { links: 'verbatim' })).toBe('[t](https://x.com)');
    expect(toPseudoMarkdown('[t](https://x.com)', { links: 'decorated' })).toBe(`t (${ZWSP}https://x.com${ZWSP})`);
    expect(toPseudoMarkdown('[t](https://x.com)', { links: 'urlOnly' })).toBe('https://x.com');
  });
});

describe('toPseudoMarkdown — code fences (verbatim by default)', () => {
  it('preserves a simple code block', () => {
    expect(toPseudoMarkdown('before\n```\ncode here\n```\nafter')).toBe('before\n```\ncode here\n```\nafter');
  });

  it('preserves a code block with language tag', () => {
    expect(toPseudoMarkdown('```js\nconst x = 1;\n```')).toBe('```js\nconst x = 1;\n```');
  });

  it('preserves multiple code blocks', () => {
    expect(toPseudoMarkdown('```js\nfirst\n```\nmiddle\n```python\nsecond\n```')).toBe(
      '```js\nfirst\n```\nmiddle\n```python\nsecond\n```',
    );
  });

  it('restores URLs inside a code block without token leaks', () => {
    const out = toPseudoMarkdown('```\nhttps://example.com/test\n```');
    expect(out).toContain('https://example.com/test');
    expect(out).toContain('```');
    expect(out).not.toMatch(/[\uE000-\uE0FF]/);
  });

  it('restores multiple URLs inside a code block', () => {
    const input = '```\nhttps://a.com\nhttps://b.com\nhttps://c.com\n```';
    expect(toPseudoMarkdown(input)).toBe(input);
  });

  it('handles inline code inside a code block', () => {
    expect(toPseudoMarkdown('```\nuse `backtick` here\n```')).toBe('```\nuse `backtick` here\n```');
  });

  it('renders ┄-framed blocks when codeBlock is overridden (details in options suite)', () => {
    expect(toPseudoMarkdown('```\nc\n```', { codeBlock: 'decorated' })).toBe(`${CODE15}\nc\n${CODE15}`);
    expect(toPseudoMarkdown('```js\nx\n```', { codeBlock: 'decorated' })).toBe(`┄┄┄┄┄ js ┄┄┄┄┄\nx\n${CODE15}`);
  });
});

describe('toPseudoMarkdown — inline code (verbatim by default)', () => {
  it('preserves simple inline code', () => {
    expect(toPseudoMarkdown('use `console.log` to debug')).toBe('use `console.log` to debug');
  });

  it('preserves multiple inline code spans', () => {
    expect(toPseudoMarkdown('use `foo` and `bar` and `baz`')).toBe('use `foo` and `bar` and `baz`');
  });

  it('restores 15+ inline code spans with no sentinel leak', () => {
    const input = Array.from({ length: 15 }, (_, i) => `\`code${i}\``).join(' and ');
    const out = toPseudoMarkdown(input);
    expect(out).toBe(input);
    expect(out).not.toMatch(/[\uE000-\uE0FF]/);
  });

  it('restores a URL inside inline code without token leaks', () => {
    expect(toPseudoMarkdown('see `https://example.com` here')).toBe('see `https://example.com` here');
  });

  it('preserves unicode inline code', () => {
    expect(toPseudoMarkdown('use `日本語コード` here')).toBe('use `日本語コード` here');
  });

  it('renders corner brackets on override', () => {
    expect(toPseudoMarkdown('use `x` here', { inlineCode: 'corner' })).toBe('use 『x』 here');
  });
});

describe('toPseudoMarkdown — tables (decorated, auto strategy)', () => {
  it('renders a two-column table as a compact key-value box', () => {
    const top = compactTop('Names');
    expect(toPseudoMarkdown('| Name | Age |\n| --- | --- |\n| Alice | 30 |')).toBe(
      `${top}\n\nName  ─ Alice\nAge   ─ 30\n\n${compactBottom(top)}`,
    );
  });

  it('renders a 3+-column table as a record block', () => {
    expect(toPseudoMarkdown('| A | B | C |\n| --- | --- | --- |\n| k | 1 | 2 |')).toBe(
      `${TFRAME}\n\n[1] k\n    B: 1\n    C: 2\n\n${TFRAME}`,
    );
  });

  it('runs cell content through the pseudo inline pass (emphasis kept, strike preserved)', () => {
    expect(toPseudoMarkdown('| A | B | C |\n| --- | --- | --- |\n| k | **b** | ~~s~~ |')).toBe(
      `${TFRAME}\n\n[1] k\n    B: **b**\n    C: ~~s~~\n\n${TFRAME}`,
    );
  });

  it('keeps links verbatim inside cells', () => {
    expect(toPseudoMarkdown('| A | B | C |\n| --- | --- | --- |\n| k | [d](https://y.io) | x |')).toBe(
      `${TFRAME}\n\n[1] k\n    B: [d](https://y.io)\n    C: x\n\n${TFRAME}`,
    );
  });

  it('passes a pipe run without a delimiter row through untouched', () => {
    expect(toPseudoMarkdown('| a |\n| b |')).toBe('| a |\n| b |');
  });
});

describe('toPseudoMarkdown — cleanup', () => {
  it('converts escaped quotes', () => {
    expect(toPseudoMarkdown('say \\"hello\\"')).toBe('say "hello"');
  });

  it('cleans up excessive newlines', () => {
    expect(toPseudoMarkdown('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims the final output', () => {
    expect(toPseudoMarkdown('\ttrim me\t')).toBe('trim me');
  });

  it('normalizes CRLF inside verbatim fences', () => {
    expect(toPseudoMarkdown('```js\r\nlet x = 1\r\n```')).toBe('```js\nlet x = 1\n```');
  });
});

describe('toPseudoMarkdown — determinism', () => {
  it('is byte-identical across repeated calls on a kitchen-sink document', () => {
    const input = [
      '# Report',
      'Intro **bold** and `code()`.',
      '- one',
      '  - two',
      '> quoted',
      '>> deeper',
      '---',
      '~~gone~~',
      '```ts',
      'const k = 1;',
      '```',
      '| N | V |',
      '| --- | --- |',
      '| a | 1 |',
    ].join('\n');
    expect(toPseudoMarkdown(input)).toBe(toPseudoMarkdown(input));
  });
});
