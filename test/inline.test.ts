import { describe, expect, it } from 'vitest';
import { toPlainText, toPseudoMarkdown } from '../src/index.js';

// U+200B zero-width space: the auto-linker guard around synthesized URL wraps.
const ZWSP = '\u200B';
// Combining overline: pseudo-path strikethrough, one per content char.
const COMBINING_OVERLINE = '\u0336';
// Default hrule glyph: five box-drawing light horizontal runs.
const HRULE = '\u2500\u2500\u2500\u2500\u2500';

describe('toPlainText — blockquotes', () => {
  it('prefixes quoted lines with the default ┃ bar', () => {
    expect(toPlainText('> quoted statement')).toBe('┃ quoted statement');
    expect(toPlainText('> first line\n> second line')).toBe('┃ first line\n┃ second line');
  });

  it('repeats the bar per nesting depth', () => {
    expect(toPlainText('> > deep quote')).toBe('┃ ┃ deep quote');
    expect(toPlainText('>> compact quote')).toBe('┃ ┃ compact quote');
  });

  it('honors a custom quotePrefix', () => {
    expect(toPlainText('> q\n>> qq', { quotePrefix: '» ' })).toBe('» q\n» » qq');
  });

  it('leaves > lines raw in preserve mode', () => {
    expect(toPlainText('> raw line\n> another', { blockquotes: 'preserve' })).toBe(
      '> raw line\n> another',
    );
  });

  it('preserves by default on the pseudo pipeline and bars on explicit override', () => {
    expect(toPseudoMarkdown('> kept as-is')).toBe('> kept as-is');
    expect(toPseudoMarkdown('> q', { blockquotes: 'bar' })).toBe('┃ q');
  });
});

describe('inline code modes', () => {
  it('plain defaults to corner 『』 delimiters', () => {
    expect(toPlainText('run `npm test` now')).toBe('run 『npm test』 now');
  });

  it('corner output keeps code content untouched by inline rules', () => {
    expect(toPlainText('keep `**not bold**` intact')).toBe('keep 『**not bold**』 intact');
  });

  it('bracket mode renders ⦗ code ⦘', () => {
    expect(toPlainText('run `npm test`', { inlineCode: 'bracket' })).toBe('run ⦗ npm test ⦘');
  });

  it('verbatim mode keeps backticks', () => {
    expect(toPlainText('run `npm test` now', { inlineCode: 'verbatim' })).toBe(
      'run `npm test` now',
    );
  });

  it('pseudo defaults to verbatim and honors the corner override', () => {
    expect(toPseudoMarkdown('value `x` here')).toBe('value `x` here');
    expect(toPseudoMarkdown('value `x` here', { inlineCode: 'corner' })).toBe('value 『x』 here');
  });
});

describe('strikethrough modes are honored', () => {
  it('plain defaults to strip: bare content', () => {
    expect(toPlainText('this is ~~gone~~ text')).toBe('this is gone text');
    expect(toPlainText('a ~~x~~ b ~~y~~ c')).toBe('a x b y c');
  });

  it('brackets override wraps content in [ ]', () => {
    expect(toPlainText('~~gone~~', { strikethrough: 'brackets' })).toBe('[gone]');
  });

  it('overline override applies U+0336 per content char', () => {
    expect(toPlainText('~~ab~~', { strikethrough: 'overline' })).toBe(
      `a${COMBINING_OVERLINE}b${COMBINING_OVERLINE}`,
    );
  });

  it('preserve override keeps and normalizes tilde runs', () => {
    expect(toPlainText('~~kept~~', { strikethrough: 'preserve' })).toBe('~~kept~~');
    expect(toPlainText('~~~x~~~', { strikethrough: 'preserve' })).toBe('~~x~~');
  });

  it('pseudo defaults to preserve and honors explicit overrides', () => {
    expect(toPseudoMarkdown('~~kept~~')).toBe('~~kept~~');
    expect(toPseudoMarkdown('~~gone~~', { strikethrough: 'strip' })).toBe('gone');
    expect(toPseudoMarkdown('~~ab~~', { strikethrough: 'brackets' })).toBe('[ab]');
    expect(toPseudoMarkdown('~~ab~~', { strikethrough: 'overline' })).toBe(
      `a${COMBINING_OVERLINE}b${COMBINING_OVERLINE}`,
    );
  });
});

describe('reference-style links', () => {
  it('resolves the full [label][ref] form like an inline link (plain decorated)', () => {
    const out = toPlainText('See [Docs][docs] today.\n\n[docs]: https://example.com', {
      wrap: false,
    });
    expect(out).toBe(`See Docs (${ZWSP}https://example.com${ZWSP}) today.`);
  });

  it('resolves the collapsed [label][] form against the label', () => {
    const out = toPlainText('See [Docs][] today.\n\n[Docs]: https://example.com', {
      wrap: false,
    });
    expect(out).toBe(`See Docs (${ZWSP}https://example.com${ZWSP}) today.`);
  });

  it('consumes definition lines wherever they appear', () => {
    const out = toPlainText('[docs]: https://example.com\n\nRead [Docs][docs] now', {
      wrap: false,
    });
    expect(out).toBe(`Read Docs (${ZWSP}https://example.com${ZWSP}) now`);
    expect(out).not.toContain('[docs]:');
  });

  it('leaves unresolved refs verbatim', () => {
    expect(toPlainText('See [Docs][missing] here')).toBe('See [Docs][missing] here');
    expect(toPlainText('See [Docs][] here')).toBe('See [Docs][] here');
  });

  it('renders each repeated use inline without duplicating the definition', () => {
    const out = toPlainText('A [D][docs] and B [D][docs]\n\n[docs]: https://x.io', {
      wrap: false,
    });
    expect(out).toBe(`A D (${ZWSP}https://x.io${ZWSP}) and B D (${ZWSP}https://x.io${ZWSP})`);
  });

  it('consumes definition titles in double-quoted, single-quoted, and parenthesized forms', () => {
    const dbl = toPlainText('[docs]: https://example.com "Docs Site"\n\nRead [Docs][docs]', {
      wrap: false,
    });
    expect(dbl).toBe(`Read Docs (${ZWSP}https://example.com${ZWSP})`);
    expect(dbl).not.toContain('Docs Site');
    expect(toPlainText("[docs]: https://example.com 'Docs Site'\n\nRead [Docs][docs]", {
      wrap: false,
    })).toBe(`Read Docs (${ZWSP}https://example.com${ZWSP})`);
    expect(toPlainText('[docs]: https://example.com (Docs Site)\n\nRead [Docs][docs]', {
      wrap: false,
    })).toBe(`Read Docs (${ZWSP}https://example.com${ZWSP})`);
  });

  it('consumes indented (≤3 spaces) definition lines but not code-block-indented ones', () => {
    expect(toPlainText('  [docs]: https://x.io\n\nUse [Docs][docs]', { wrap: false })).toBe(
      `Use Docs (${ZWSP}https://x.io${ZWSP})`,
    );
    expect(toPlainText('    [docs]: https://x.io\n\nUse [Docs][docs]', { wrap: false })).toBe(
      '    [docs]: https://x.io\n\nUse [Docs][docs]',
    );
  });

  it('renders resolved refs as bare URLs in urlOnly mode', () => {
    expect(
      toPlainText('See [Docs][docs] now\n\n[docs]: https://x.io', {
        links: 'urlOnly',
        wrap: false,
      }),
    ).toBe('See https://x.io now');
  });

  it('rewrites resolved refs to inline syntax in verbatim mode (pseudo default)', () => {
    expect(toPseudoMarkdown('See [Docs][docs] now.\n\n[docs]: https://x.io')).toBe(
      'See [Docs](https://x.io) now.',
    );
  });

  it('renders a ref whose label equals its destination as a bare URL', () => {
    expect(toPlainText('Open [https://x.io][s]\n\n[s]: https://x.io', { wrap: false })).toBe(
      'Open https://x.io',
    );
  });

  it('does not consume definition lines inside code fences', () => {
    const out = toPlainText('```\n[docs]: https://x.io\n```\n\nUse [Docs][docs]', {
      wrap: false,
    });
    expect(out).toContain('[Docs][docs]');
    expect(out).toContain('[docs]: https://x.io');
  });

  it('honors guardUrlParens: false on resolved refs', () => {
    expect(
      toPlainText('See [Docs][docs]\n\n[docs]: https://x.io', {
        guardUrlParens: false,
        wrap: false,
      }),
    ).toBe('See Docs (https://x.io)');
  });
});

describe('horizontal rules', () => {
  it('decorates with opts.hrule by default on the plain pipeline', () => {
    expect(toPlainText('above\n\n---\n\nbelow')).toBe(`above\n\n${HRULE}\n\nbelow`);
  });

  it('preserve mode keeps normalized three-dash rules on plain', () => {
    expect(toPlainText('above\n\n---\n\nbelow', { hruleMode: 'preserve' })).toBe(
      'above\n\n---\n\nbelow',
    );
    expect(toPlainText('***', { hruleMode: 'preserve' })).toBe('---');
  });

  it('pseudo defaults to preserve and honors decorate overrides', () => {
    expect(toPseudoMarkdown('---')).toBe('---');
    expect(toPseudoMarkdown('---', { hruleMode: 'decorate' })).toBe(HRULE);
    expect(toPseudoMarkdown('***', { hruleMode: 'decorate', hrule: '✦✦✦' })).toBe('✦✦✦');
  });
});
