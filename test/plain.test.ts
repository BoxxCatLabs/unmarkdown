import { describe, expect, it } from 'vitest';
import { toPlainText } from '../src/index.js';

// ┄ code frames: labeled top `┄┄┄┄┄ lang ┄┄┄┄┄` (topRun 5), bare ┄×15 (bottomRun).
const CODE15 = '┄'.repeat(15);
const codeTop = (lang: string): string => `┄┄┄┄┄ ${lang} ┄┄┄┄┄`;
// Table frame: 8×═ + ` ✧･ﾟ ` (U+2727 U+FF65 U+FF9F) + 8×═; open === close.
const TFRAME = '\u2550'.repeat(8) + ' \u2727\uFF65\uFF9F ' + '\u2550'.repeat(8);
const compactTop = (label: string): string => `┌─ ${label} ${'─'.repeat(6)}`;
const compactBottom = (top: string): string => `└${'─'.repeat(top.length - 1)}`;
// U+200B zero-width space: the auto-linker guard around synthesized URL wraps.
const ZWSP = '\u200B';

describe('toPlainText — input guards', () => {
  it('returns empty for empty string', () => {
    expect(toPlainText('')).toBe('');
  });

  it('returns empty for null and undefined', () => {
    expect(toPlainText(null as never)).toBe('');
    expect(toPlainText(undefined as never)).toBe('');
  });

  it('returns empty for non-string input', () => {
    expect(toPlainText(42 as never)).toBe('');
  });

  it('returns empty for whitespace-only input', () => {
    expect(toPlainText('   ')).toBe('');
    expect(toPlainText('   \n  ')).toBe('');
    expect(toPlainText('\t\n')).toBe('');
  });

  it('passes plain text through', () => {
    expect(toPlainText('hello world')).toBe('hello world');
  });

  it('maps markdown-free prose with URLs to itself', () => {
    const prose = 'hello https://example.com world';
    expect(toPlainText(prose)).toBe(prose);
  });
});

describe('toPlainText — headings (decorated, single line)', () => {
  it('frames h1 with capped runs and goes bare below the two-run floor', () => {
    expect(toPlainText('# Getting Started', { maxWidth: 21 })).toBe('━━ Getting Started ━━');
    expect(toPlainText('# Getting Started', { maxWidth: 16 })).toBe('Getting Started');
    const run = '━'.repeat(4); // default standard profile: width 40, title 'Doc' → k capped at 4
    expect(toPlainText('# Doc')).toBe(`${run} Doc ${run}`);
  });

  it('drops h1 decoration when the title fills the width', () => {
    expect(toPlainText('# Getting Started', { maxWidth: 15 })).toBe('Getting Started');
    expect(toPlainText('# Getting Started', { maxWidth: 14 })).toBe('Getting Started');
  });

  it('decorates h2-h6 with per-level glyphs', () => {
    expect(toPlainText('## Section')).toBe('【 Section 】');
    expect(toPlainText('### Subsection')).toBe('◆ Subsection');
    expect(toPlainText('#### Detail')).toBe('◇ Detail');
    expect(toPlainText('##### Minor')).toBe('▸ Minor');
    expect(toPlainText('###### Notes')).toBe('› Notes');
  });

  it('never wraps or truncates: oversized decorations degrade to the bare title', () => {
    const long = 'A section title far wider than the standard display width allows';
    expect(toPlainText(`## ${long}`)).toBe(long);
    expect(toPlainText(`### ${long}`)).toBe(long);
    const framed = toPlainText(`# ${long}`, { maxWidth: 20 });
    expect(framed).toBe(long);
    expect(framed.includes('\n')).toBe(false);
  });

  it('trims inner whitespace between hash marks and title', () => {
    expect(toPlainText('###    Spaced\ttitle ')).toBe('◆ Spaced\ttitle');
  });

  it('drops a heading line with an empty title', () => {
    expect(toPlainText('#   ')).toBe('');
    expect(toPlainText('keep\n# \nme')).toBe('keep\n\nme');
  });

  it('treats a bare # as not a heading', () => {
    expect(toPlainText('#')).toBe('#');
  });

  it('treats 7+ hash marks as not a heading', () => {
    expect(toPlainText('####### seven')).toBe('####### seven');
  });

  it('ignores # that is not at line start', () => {
    expect(toPlainText('no heading # here')).toBe('no heading # here');
  });

  it('passes headingDepth through: deeper levels stay raw', () => {
    expect(toPlainText('# h1', { headingDepth: 1, maxWidth: 10 })).toBe('━━━ h1 ━━━');
    expect(toPlainText('## h2', { headingDepth: 1 })).toBe('## h2');
    expect(toPlainText('### h3', { headingDepth: 3 })).toBe('◆ h3');
    expect(toPlainText('#### Deep', { headingDepth: 3 })).toBe('#### Deep');
  });
});

describe('toPlainText — bullets and lists', () => {
  it('converts unordered list markers to •', () => {
    expect(toPlainText('- item')).toBe('• item');
    expect(toPlainText('* item')).toBe('• item');
    expect(toPlainText('+ item')).toBe('• item');
  });

  it('normalizes nesting: ◦ per level, indent = 2 × (depth − 1), uncapped', () => {
    expect(toPlainText('- a\n  * b\n   + c')).toBe('• a\n  ◦ b\n  ◦ c');
    expect(toPlainText('- a\n    - b\n        - c')).toBe('• a\n    ◦ b\n        ◦ c');
  });

  it('renders ordered numbers at depth 1 and letters deeper', () => {
    expect(toPlainText('1. First step\n2. Second step\n   1. Substep\n   2. Substep\n3. Third step')).toBe(
      '1. First step\n2. Second step\n  a. Substep\n  b. Substep\n3. Third step',
    );
    expect(toPlainText('1. first\n2. second')).toBe('1. first\n2. second');
  });

  it('renumbers depth-1 items sequentially (ordered: render)', () => {
    expect(toPlainText('3. third\n4. fourth')).toBe('1. third\n2. fourth');
  });

  it('renders task checkboxes as glyphs', () => {
    expect(toPlainText('- [x] shipped')).toBe('☑ shipped');
    expect(toPlainText('- [X] shipped')).toBe('☑ shipped');
    expect(toPlainText('- [ ] todo item')).toBe('☐ todo item');
  });

  it('leaves non-task brackets as literal bullet content', () => {
    expect(toPlainText('- [-] dropped')).toBe('• [-] dropped');
    expect(toPlainText('- [y] odd')).toBe('• [y] odd');
  });

  it('does not convert a marker without a following space', () => {
    expect(toPlainText('-dash nospace')).toBe('-dash nospace');
  });
});

describe('toPlainText — emphasis and strikethrough', () => {
  it('strips bold markers', () => {
    expect(toPlainText('**bold**')).toBe('bold');
    expect(toPlainText('__bold__')).toBe('bold');
  });

  it('strips italic markers', () => {
    expect(toPlainText('*italic*')).toBe('italic');
    expect(toPlainText('_italic_')).toBe('italic');
  });

  it('strips triple emphasis to content', () => {
    expect(toPlainText('***both***')).toBe('both');
  });

  it('strips mixed emphasis in one line', () => {
    expect(toPlainText('a **b** c *d* e __f__ g _h_ i ***j*** k')).toBe('a b c d e f g h i j k');
  });

  it('strips strikethrough markers entirely', () => {
    expect(toPlainText('~~deleted~~')).toBe('deleted');
    expect(toPlainText('~~a b~~')).toBe('a b');
  });
});

describe('toPlainText — blockquotes (bar)', () => {
  it('prefixes each quoted line with ┃', () => {
    expect(toPlainText('> quoted text')).toBe('┃ quoted text');
    expect(toPlainText('> q1\n> q2')).toBe('┃ q1\n┃ q2');
  });

  it('repeats ┃ per nesting depth', () => {
    expect(toPlainText('>> nested')).toBe('┃ ┃ nested');
    expect(toPlainText('>>> deep')).toBe('┃ ┃ ┃ deep');
    expect(toPlainText('> > spaced')).toBe('┃ ┃ spaced');
  });
});

describe('toPlainText — horizontal rules (decorated)', () => {
  it('converts --- to ─────', () => {
    expect(toPlainText('before\n---\nafter')).toBe('before\n─────\nafter');
  });

  it('converts *** and ___ variants', () => {
    expect(toPlainText('***')).toBe('─────');
    expect(toPlainText('___')).toBe('─────');
  });

  it('normalizes longer runs and internal spacing', () => {
    expect(toPlainText('----------')).toBe('─────');
    expect(toPlainText('--- ---')).toBe('─────');
  });

  it('accepts up to 3 leading spaces; rejects 4+ and 2-char runs', () => {
    expect(toPlainText('   ---')).toBe('─────');
    expect(toPlainText('before\n    ---\nafter')).toBe('before\n    ---\nafter');
    expect(toPlainText('--')).toBe('--');
  });
});

describe('toPlainText — escapes, cleanup, line endings', () => {
  it('converts escaped quotes', () => {
    expect(toPlainText('say \\"hello\\"')).toBe('say "hello"');
  });

  it('collapses 3+ newlines to two', () => {
    expect(toPlainText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims the final output', () => {
    expect(toPlainText('  padded  ')).toBe('padded');
  });

  it('normalizes CRLF and lone CR to LF', () => {
    expect(toPlainText('### H\r\n\r\rbody')).toBe('◆ H\n\nbody');
    expect(toPlainText('a\rb')).toBe('a\nb');
  });
});

describe('toPlainText — links (decorated default)', () => {
  it('decorates links with ZWSP-guarded parens', () => {
    expect(toPlainText('[docs](https://example.com/a)')).toBe(`docs (${ZWSP}https://example.com/a${ZWSP})`);
  });

  it('renders a bare URL when link text equals the URL', () => {
    expect(toPlainText('[https://x.com](https://x.com)')).toBe('https://x.com');
    expect(toPlainText('[ https://x.com ](https://x.com)')).toBe('https://x.com');
  });

  it('preserves URLs byte-identically through decoration', () => {
    const url = 'https://example.com/search?q=hello%20world&lang=en#top';
    expect(toPlainText(`link [l](${url}) end`)).toBe(`link l (${ZWSP}${url}${ZWSP}) end`);
  });
});

describe('toPlainText — images', () => {
  it('converts images to guarded alt + url', () => {
    expect(toPlainText('![pic](https://i.x.com/a.png)')).toBe(`pic (${ZWSP}https://i.x.com/a.png${ZWSP})`);
  });

  it('renders a bare URL for an empty or whitespace-only alt', () => {
    expect(toPlainText('![](https://example.com/i.png)')).toBe('https://example.com/i.png');
    expect(toPlainText('![  ](https://example.com/i.png)')).toBe('https://example.com/i.png');
  });
});

describe('toPlainText — inline code (corner brackets)', () => {
  it('wraps inline code in 『』', () => {
    expect(toPlainText('use `console.log` to debug')).toBe('use 『console.log』 to debug');
  });

  it('preserves multiple inline code spans', () => {
    expect(toPlainText('use `foo` and `bar` and `baz`')).toBe('use 『foo』 and 『bar』 and 『baz』');
  });

  it('preserves unicode inline code', () => {
    expect(toPlainText('use `日本語コード` here')).toBe('use 『日本語コード』 here');
  });

  it('restores a URL inside inline code without token leaks', () => {
    expect(toPlainText('see `https://example.com` here')).toBe('see 『https://example.com』 here');
  });
});

describe('toPlainText — code fences (┄ frames)', () => {
  it('frames a labeled code block with an unindented body', () => {
    expect(toPlainText('```JavaScript\nconst greeting = "Hello";\nconsole.log(greeting);\n```')).toBe(
      `${codeTop('JavaScript')}\nconst greeting = "Hello";\nconsole.log(greeting);\n${CODE15}`,
    );
  });

  it('omits the label when the fence has no info string', () => {
    expect(toPlainText('```\ncode here\n```')).toBe(`${CODE15}\ncode here\n${CODE15}`);
  });

  it('renders multiple fenced blocks and keeps text between them', () => {
    expect(toPlainText('```js\nfirst\n```\nmiddle\n```python\nsecond\n```')).toBe(
      `${codeTop('js')}\nfirst\n${CODE15}\nmiddle\n${codeTop('python')}\nsecond\n${CODE15}`,
    );
  });

  it('strips the fence indent and preserves relative indentation', () => {
    expect(toPlainText('  ```\n  deep\n    deeper\n  ```')).toBe(`${CODE15}\ndeep\n  deeper\n${CODE15}`);
  });

  it('keeps tabs inside the body verbatim', () => {
    expect(toPlainText('```\n\tone\n\t\ttwo\n```')).toBe(`${CODE15}\n\tone\n\t\ttwo\n${CODE15}`);
  });

  it('preserves interior blank lines and trims leading/trailing blanks', () => {
    expect(toPlainText('```\na\n\nb\n```')).toBe(`${CODE15}\na\n\nb\n${CODE15}`);
    expect(toPlainText('```\n\n\nmid\n\n\n```')).toBe(`${CODE15}\nmid\n${CODE15}`);
  });

  it('restores URLs inside a fenced body byte-identically', () => {
    expect(toPlainText('```\nhttps://example.com/test\n```')).toBe(`${CODE15}\nhttps://example.com/test\n${CODE15}`);
    expect(toPlainText('```\nhttps://a.com\nhttps://b.com\nhttps://c.com\n```')).toBe(
      `${CODE15}\nhttps://a.com\nhttps://b.com\nhttps://c.com\n${CODE15}`,
    );
  });

  it('keeps inline code inside a fenced body verbatim', () => {
    expect(toPlainText('```\nuse `backtick` here\n```')).toBe(`${CODE15}\nuse \`backtick\` here\n${CODE15}`);
  });

  it('normalizes CRLF inside fences', () => {
    expect(toPlainText('```js\r\nlet x = 1\r\n```')).toBe(`${codeTop('js')}\nlet x = 1\n${CODE15}`);
  });
});

describe('toPlainText — tables (auto strategy)', () => {
  it('renders 3+-column tables as record blocks: [n] title + 4-space pairs, one pair per line', () => {
    const input =
      '| Task | Status | Priority |\n| --- | --- | --- |\n| Authentication | Done | High |\n| Notifications | In Progress | Medium |';
    expect(toPlainText(input)).toBe(
      `${TFRAME}\n\n[1] Authentication\n    Status: Done\n    Priority: High\n\n[2] Notifications\n    Status: In Progress\n    Priority: Medium\n\n${TFRAME}`,
    );
  });

  it('renders two-column tables as compact key-value boxes', () => {
    const input = '| Property | Value |\n| --- | --- |\n| Version | 1.2.0 |\n| License | MIT |\n| Runtime | Node.js |';
    const top = compactTop('Properties');
    expect(toPlainText(input)).toBe(
      `${top}\n\nProperty  ─ Version\nValue     ─ 1.2.0\nProperty  ─ License\nValue     ─ MIT\nProperty  ─ Runtime\nValue     ─ Node.js\n\n${compactBottom(top)}`,
    );
  });

  it('renders single-column tables as bare [n] headings', () => {
    expect(toPlainText('| Only |\n| --- |\n| v1 |\n| v2 |')).toBe(`${TFRAME}\n\n[1] v1\n\n[2] v2\n\n${TFRAME}`);
  });

  it('emits the frame pair with a blank line when there are no data rows', () => {
    const top = compactTop('as');
    expect(toPlainText('| a | b |\n| --- | --- |')).toBe(`${top}\n\n${compactBottom(top)}`);
    expect(toPlainText('| a | b | c |\n| --- | --- | --- |')).toBe(`${TFRAME}\n\n${TFRAME}`);
  });

  it('treats \\| inside a cell as a literal pipe', () => {
    const top = compactTop('Cmds');
    expect(toPlainText('| Cmd | Out |\n| --- | --- |\n| a \\| b | c |')).toBe(
      `${top}\n\nCmd  ─ a | b\nOut  ─ c\n\n${compactBottom(top)}`,
    );
  });

  it('pads short rows and truncates long rows to the header width', () => {
    const top = compactTop('As');
    expect(toPlainText('| A | B |\n| --- | --- |\n| 1 |')).toBe(
      `${top}\n\nA  ─ 1\nB  ─ (empty)\n\n${compactBottom(top)}`,
    );
    expect(toPlainText('| A | B |\n| --- | --- |\n| 1 | 2 | 3 |')).toBe(
      `${top}\n\nA  ─ 1\nB  ─ 2\n\n${compactBottom(top)}`,
    );
  });

  it('renders an empty first cell as a bare [n] title', () => {
    expect(toPlainText('| H | X | Y |\n| --- | --- | --- |\n|  | x | y |')).toBe(
      `${TFRAME}\n\n[1]\n    X: x\n    Y: y\n\n${TFRAME}`,
    );
  });

  it('renders an empty value cell as (empty)', () => {
    expect(toPlainText('| H | X | Y |\n| --- | --- | --- |\n| Ann | | z |')).toBe(
      `${TFRAME}\n\n[1] Ann\n    X: (empty)\n    Y: z\n\n${TFRAME}`,
    );
  });

  it('falls back to the 1-based column position for an empty pair-column header', () => {
    expect(toPlainText('| H | | X |\n| --- | --- | --- |\n| r | v1 | v2 |')).toBe(
      `${TFRAME}\n\n[1] r\n    2: v1\n    X: v2\n\n${TFRAME}`,
    );
  });

  it('preprocesses cells through the inline pass (bold/strike stripped)', () => {
    expect(toPlainText('| A | B | C |\n| --- | --- | --- |\n| k | **bold** v | ~~gone~~ |')).toBe(
      `${TFRAME}\n\n[1] k\n    B: bold v\n    C: gone\n\n${TFRAME}`,
    );
    const top = compactTop('As');
    expect(toPlainText('| A | B |\n| --- | --- |\n| k | a<br>b |')).toBe(
      `${top}\n\nA  ─ k\nB  ─ a b\n\n${compactBottom(top)}`,
    );
  });

  it('shields cells from the block passes (# and - stay content)', () => {
    expect(toPlainText('| A | B | C |\n| --- | --- | --- |\n| # hash | - dash | x |')).toBe(
      `${TFRAME}\n\n[1] # hash\n    B: - dash\n    C: x\n\n${TFRAME}`,
    );
  });

  it('never misparses pipe rows inside a fenced block as a table', () => {
    expect(toPlainText('```\n| a |\n| --- |\n| b |\n```')).toBe(
      `${CODE15}\n| a |\n| --- |\n| b |\n${CODE15}`,
    );
  });

  it('renders decorated links inside cells with BOTH guard ZWSPs', () => {
    expect(toPlainText('| A | B | C |\n| --- | --- | --- |\n| k | [d](https://y.io) | ![p](https://i.x/a.png) |')).toBe(
      `${TFRAME}\n\n[1] k\n    B: d (${ZWSP}https://y.io${ZWSP})\n    C: p (${ZWSP}https://i.x/a.png${ZWSP})\n\n${TFRAME}`,
    );
  });

  it('keeps corner-bracket inline code inside cells', () => {
    expect(toPlainText('| A | B | C |\n| --- | --- | --- |\n| c | use `q` | x |')).toBe(
      `${TFRAME}\n\n[1] c\n    B: use 『q』\n    C: x\n\n${TFRAME}`,
    );
  });

  it('decorates two tables in one document independently', () => {
    expect(toPlainText('| A |\n| --- |\n| 1 |\n\nbetween\n\n| B |\n| --- |\n| 2 |')).toBe(
      `${TFRAME}\n\n[1] 1\n\n${TFRAME}\n\nbetween\n\n${TFRAME}\n\n[1] 2\n\n${TFRAME}`,
    );
  });

  it('passes a lone pipe run without a delimiter row through untouched', () => {
    expect(toPlainText('| a |\n| b |')).toBe('| a |\n| b |');
    expect(toPlainText('| just one line')).toBe('| just one line');
  });
});

describe('toPlainText — determinism', () => {
  it('is byte-identical across repeated calls on a kitchen-sink document', () => {
    const input = [
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
    expect(toPlainText(input)).toBe(toPlainText(input));
  });
});
