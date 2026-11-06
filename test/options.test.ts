import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE_OPTIONS, resolveOptions } from '../src/options.js';

// Byte-exact record-block frame per docs/unmarkdown-feedback.md: 8 `═` each side of ` ✧･ﾟ `.
const FRAME = '════════ ✧･ﾟ ════════';
const ASCII_FRAME = '----------';

/** Casts an intentionally-invalid options object past the public types (runtime validation is the contract). */
const bad = (o: unknown) => o as never;

const expectTypeError = (run: () => unknown, message: RegExp): void => {
  expect(run).toThrow(TypeError);
  expect(run).toThrow(message);
};

// Resolved per-level heading pins: every field concrete (frame '' = no frame).
const UNICODE_HEADINGS = {
  1: { prefix: '', suffix: '', frame: '━' },
  2: { prefix: '【 ', suffix: ' 】', frame: '' },
  3: { prefix: '◆ ', suffix: '', frame: '' },
  4: { prefix: '◇ ', suffix: '', frame: '' },
  5: { prefix: '▸ ', suffix: '', frame: '' },
  6: { prefix: '› ', suffix: '', frame: '' },
};

const ASCII_HEADINGS = {
  1: { prefix: '', suffix: '', frame: '=' },
  2: { prefix: '[ ', suffix: ' ]', frame: '' },
  3: { prefix: ':: ', suffix: '', frame: '' },
  4: { prefix: ';; ', suffix: '', frame: '' },
  5: { prefix: '~> ', suffix: '', frame: '' },
  6: { prefix: '.. ', suffix: '', frame: '' },
};

const PLAIN_DEFAULTS = {
  profile: 'standard',
  width: 40,
  wrap: true,
  headingMode: 'decorate',
  headingDepth: 6,
  headings: UNICODE_HEADINGS,
  bullet: '•',
  bulletNested: '◦',
  ordered: 'render',
  tasks: { pending: '☐', done: '☑', cancelled: '☒' },
  blockquotes: 'bar',
  quotePrefix: '┃ ',
  inlineCode: 'corner',
  strikethrough: 'strip',
  hruleMode: 'decorate',
  hrule: '─────',
  links: 'decorated',
  guardUrlParens: true,
  codeBlock: 'decorated',
  code: { frame: '┄', topRun: 5, bottomRun: 15, label: true },
  glyphs: 'unicode',
  table: { open: FRAME, close: FRAME, emptyCell: '(empty)', enabled: true, strategy: 'auto' },
};

const PSEUDO_DEFAULTS = {
  ...PLAIN_DEFAULTS,
  wrap: false,
  headingMode: 'preserve',
  ordered: 'preserve',
  blockquotes: 'preserve',
  inlineCode: 'verbatim',
  strikethrough: 'preserve',
  hruleMode: 'preserve',
  links: 'verbatim',
  codeBlock: 'verbatim',
};

const ASCII_BUNDLE = {
  headings: ASCII_HEADINGS,
  bullet: '-',
  bulletNested: '-',
  tasks: { pending: '[ ]', done: '[x]', cancelled: '[-]' },
  quotePrefix: '| ',
  hrule: '-----',
  code: { frame: '-', topRun: 5, bottomRun: 15, label: true },
  glyphs: 'ascii',
  table: { open: ASCII_FRAME, close: ASCII_FRAME, emptyCell: '(empty)', enabled: true, strategy: 'auto' },
};

const PLAIN_ASCII = { ...PLAIN_DEFAULTS, ...ASCII_BUNDLE };
const PSEUDO_ASCII = { ...PSEUDO_DEFAULTS, ...ASCII_BUNDLE };

describe('resolveOptions — plain defaults', () => {
  it('pins every resolved field', () => {
    expect(resolveOptions('plain')).toEqual(PLAIN_DEFAULTS);
  });

  it('defaults the pipeline to plain', () => {
    expect(resolveOptions()).toEqual(resolveOptions('plain'));
  });

  it('exposes the byte-exact default table options', () => {
    expect(DEFAULT_TABLE_OPTIONS).toEqual({ open: FRAME, close: FRAME, emptyCell: '(empty)', enabled: true, strategy: 'auto' });
  });
});

describe('resolveOptions — pseudo defaults', () => {
  it('pins every resolved field', () => {
    expect(resolveOptions('pseudo')).toEqual(PSEUDO_DEFAULTS);
  });

  it('differs from plain exactly on wrap/headingMode/ordered/blockquotes/inlineCode/strikethrough/hruleMode/links/codeBlock', () => {
    const plain = resolveOptions('plain');
    const pseudo = resolveOptions('pseudo');
    expect(pseudo.wrap).toBe(false);
    expect(pseudo.headingMode).toBe('preserve');
    expect(pseudo.ordered).toBe('preserve');
    expect(pseudo.blockquotes).toBe('preserve');
    expect(pseudo.inlineCode).toBe('verbatim');
    expect(pseudo.strikethrough).toBe('preserve');
    expect(pseudo.hruleMode).toBe('preserve');
    expect(pseudo.links).toBe('verbatim');
    expect(pseudo.codeBlock).toBe('verbatim');
    // Everything else is shared with the plain pipeline.
    expect({ ...plain, wrap: false, headingMode: 'preserve', ordered: 'preserve', blockquotes: 'preserve', inlineCode: 'verbatim', strikethrough: 'preserve', hruleMode: 'preserve', links: 'verbatim', codeBlock: 'verbatim' }).toEqual(pseudo);
  });
});

describe('fresh resolution (no shared mutable state)', () => {
  it('returns distinct nested objects on every call', () => {
    const a = resolveOptions('plain');
    const b = resolveOptions('plain');
    expect(a.table).not.toBe(b.table);
    expect(a.tasks).not.toBe(b.tasks);
    expect(a.code).not.toBe(b.code);
    expect(a.headings[1]).not.toBe(b.headings[1]);
    expect(a.table).toEqual(b.table);
    expect(a.tasks).toEqual(b.tasks);
  });

  it('mutating a resolved result never leaks into defaults or later calls', () => {
    const a = resolveOptions('plain');
    a.table.open = 'clobbered';
    a.tasks.pending = 'clobbered';
    a.code.frame = 'clobbered';
    a.headings[2].prefix = 'clobbered';
    expect(DEFAULT_TABLE_OPTIONS.open).toBe(FRAME);
    expect(resolveOptions('plain').table.open).toBe(FRAME);
    expect(resolveOptions('plain').tasks).toEqual({ pending: '☐', done: '☑', cancelled: '☒' });
    expect(resolveOptions('plain').code.frame).toBe('┄');
    expect(resolveOptions('plain').headings[2].prefix).toBe('【 ');
  });
});

describe('glyphs: "ascii" bundle resolution', () => {
  it('pins every resolved field on the plain pipeline', () => {
    expect(resolveOptions('plain', { glyphs: 'ascii' })).toEqual(PLAIN_ASCII);
  });

  it('pins every resolved field on the pseudo pipeline', () => {
    expect(resolveOptions('pseudo', { glyphs: 'ascii' })).toEqual(PSEUDO_ASCII);
  });

  it('explicit user keys beat the bundle', () => {
    const opts = resolveOptions('plain', {
      glyphs: 'ascii',
      bullet: '→',
      tasks: { pending: '·', done: '✓', cancelled: '✗' },
      table: { open: '<<' },
      hrule: '~~~',
      quotePrefix: '» ',
    });
    expect(opts.bullet).toBe('→');
    expect(opts.tasks).toEqual({ pending: '·', done: '✓', cancelled: '✗' });
    expect(opts.table.open).toBe('<<');
    expect(opts.table.close).toBe(ASCII_FRAME);
    expect(opts.hrule).toBe('~~~');
    expect(opts.quotePrefix).toBe('» ');
    // Untouched bundle members stay ascii.
    expect(opts.bulletNested).toBe('-');
    expect(opts.code.frame).toBe('-');
    expect(opts.headings[3].prefix).toBe(':: ');
  });
});

describe('width resolution (profile + maxWidth)', () => {
  it('resolves the standard profile by default', () => {
    expect(resolveOptions('plain').profile).toBe('standard');
    expect(resolveOptions('plain').width).toBe(40);
  });

  it('resolves compact and comfortable profile widths', () => {
    expect(resolveOptions('plain', { profile: 'compact' }).width).toBe(32);
    expect(resolveOptions('pseudo', { profile: 'comfortable' }).width).toBe(60);
  });

  it('maxWidth overrides the profile', () => {
    const opts = resolveOptions('plain', { profile: 'compact', maxWidth: 50 });
    expect(opts.profile).toBe('compact');
    expect(opts.width).toBe(50);
  });

  it('maxWidth alone overrides the default profile width', () => {
    const opts = resolveOptions('pseudo', { maxWidth: 20 });
    expect(opts.profile).toBe('standard');
    expect(opts.width).toBe(20);
  });
});

describe('per-level headings merge (user partial over bundle)', () => {
  it('merges a single field and leaves sibling levels untouched', () => {
    const opts = resolveOptions('plain', { headings: { 1: { frame: '◆' } } });
    expect(opts.headings[1]).toEqual({ prefix: '', suffix: '', frame: '◆' });
    expect(opts.headings[2]).toEqual(UNICODE_HEADINGS[2]);
  });

  it('merges prefix field-wise over the bundle level style', () => {
    const opts = resolveOptions('plain', { headings: { 2: { prefix: '§ ' } } });
    expect(opts.headings[2]).toEqual({ prefix: '§ ', suffix: ' 】', frame: '' });
  });

  it('honors headingDepth overrides', () => {
    expect(resolveOptions('plain', { headingDepth: 3 }).headingDepth).toBe(3);
    expect(resolveOptions('pseudo').headingDepth).toBe(6);
  });
});

describe('tasks option (glyph replacement)', () => {
  it('a tasks object replaces the glyph set wholesale', () => {
    const glyphs = { pending: '·', done: '✓', cancelled: '✗' };
    expect(resolveOptions('plain', { tasks: glyphs })).toEqual({ ...PLAIN_DEFAULTS, tasks: glyphs });
  });

  it('merges partial glyph overrides over the pipeline bundle', () => {
    expect(resolveOptions('plain', { tasks: { pending: '·' } }).tasks).toEqual({
      pending: '·',
      done: '☑',
      cancelled: '☒',
    });
    expect(resolveOptions('pseudo', { glyphs: 'ascii', tasks: { done: '✔' } }).tasks).toEqual({
      pending: '[ ]',
      done: '✔',
      cancelled: '[-]',
    });
  });
});

describe('option validation (fail loud at call time)', () => {
  it('rejects unknown top-level keys on both pipelines', () => {
    expectTypeError(() => resolveOptions('plain', bad({ bogus: 1 })), /unknown option "bogus"/);
    expectTypeError(() => resolveOptions('pseudo', bad({ zebra: true })), /unknown option "zebra"/);
  });

  it('rejects bad profile and strategy values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ profile: 'huge' })), /option "profile" must be one of/);
    expectTypeError(() => resolveOptions('pseudo', bad({ table: { strategy: 'grid' } })), /option "table.strategy" must be one of/);
  });

  it('rejects bad enum values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ headingMode: 'fancy' })), /option "headingMode" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ blockquotes: 'ascii' })), /option "blockquotes" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ ordered: 'keep' })), /option "ordered" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ strikethrough: 'zap' })), /option "strikethrough" must be one of/);
    expectTypeError(() => resolveOptions('pseudo', bad({ inlineCode: 'sparkle' })), /option "inlineCode" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ links: 'fancy' })), /option "links" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ codeBlock: 'maybe' })), /option "codeBlock" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ hruleMode: 'raw' })), /option "hruleMode" must be one of/);
  });

  it('rejects non-string and unknown glyphs values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ glyphs: 7 })), /option "glyphs" must be one of/);
    expectTypeError(() => resolveOptions('plain', bad({ glyphs: 'fancy' })), /option "glyphs" must be one of/);
  });

  it('rejects invalid tasks values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ tasks: 5 })), /option "tasks" must be an object/);
    expectTypeError(() => resolveOptions('plain', bad({ tasks: 'none' })), /option "tasks" must be an object/);
    expectTypeError(() => resolveOptions('plain', bad({ tasks: [] })), /option "tasks" must be an object/);
    expectTypeError(() => resolveOptions('plain', bad({ tasks: { nope: '-' } })), /unknown key "nope" inside tasks\//);
    expectTypeError(() => resolveOptions('plain', bad({ tasks: { done: 3 } })), /option "tasks\.done" must be a string/);
  });

  it('rejects invalid headings values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ headings: 'x' })), /option "headings" must be an object/);
    expectTypeError(() => resolveOptions('plain', bad({ headings: { 7: {} } })), /unknown key "7" inside headings\//);
    expectTypeError(() => resolveOptions('plain', bad({ headings: { 1: 'bold' } })), /option "headings\.1" must be an object/);
    expectTypeError(() => resolveOptions('plain', bad({ headings: { 1: { color: 'red' } } })), /unknown key "color" inside headings\/1\//);
    expectTypeError(() => resolveOptions('plain', bad({ headings: { 2: { prefix: 5 } } })), /option "headings\.2\.prefix" must be a string/);
  });

  it('rejects invalid code values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ code: { pad: 1 } })), /unknown key "pad" inside code\//);
    expectTypeError(() => resolveOptions('plain', bad({ code: { frame: 3 } })), /option "code\.frame" must be a string/);
    expectTypeError(() => resolveOptions('plain', bad({ code: { topRun: -1 } })), /option "code\.topRun" must be a non-negative integer/);
    expectTypeError(() => resolveOptions('plain', bad({ code: { topRun: 1.5 } })), /option "code\.topRun" must be a non-negative integer/);
    expectTypeError(() => resolveOptions('plain', bad({ code: { bottomRun: 'x' } })), /option "code\.bottomRun" must be a non-negative integer/);
    expectTypeError(() => resolveOptions('plain', bad({ code: { label: 'yes' } })), /option "code\.label" must be a boolean/);
  });

  it('rejects invalid table values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ table: { nope: 1 } })), /unknown key "nope" inside table\//);
    expectTypeError(() => resolveOptions('plain', bad({ table: { open: 3 } })), /option "table\.open" must be a string/);
    expectTypeError(() => resolveOptions('plain', bad({ table: { enabled: 'no' } })), /option "table\.enabled" must be a boolean/);
    expectTypeError(() => resolveOptions('plain', bad({ table: { twoColumnLabel: 9 } })), /option "table\.twoColumnLabel" must be a string/);
    expectTypeError(() => resolveOptions('plain', bad({ table: [] })), /option "table" must be an object/);
  });

  it('rejects invalid maxWidth and headingDepth values', () => {
    expectTypeError(() => resolveOptions('plain', bad({ maxWidth: 0 })), /maxWidth/);
    expectTypeError(() => resolveOptions('plain', bad({ maxWidth: -1 })), /maxWidth/);
    expectTypeError(() => resolveOptions('plain', bad({ maxWidth: 2.5 })), /maxWidth/);
    expectTypeError(() => resolveOptions('plain', bad({ maxWidth: '40' })), /maxWidth/);
    expectTypeError(() => resolveOptions('plain', bad({ headingDepth: 0 })), /headingDepth/);
    expectTypeError(() => resolveOptions('pseudo', bad({ headingDepth: 7 })), /headingDepth/);
    expectTypeError(() => resolveOptions('plain', bad({ headingDepth: 2.5 })), /headingDepth/);
  });

  it('rejects non-object options and unknown pipelines', () => {
    expectTypeError(() => resolveOptions('plain', bad('nope')), /options must be an object/);
    expectTypeError(() => resolveOptions(bad('sideways')), /unknown pipeline "sideways"/);
  });

  it('prefixes every validation error with "unmarkdown: "', () => {
    const runs: Array<() => unknown> = [
      () => resolveOptions('plain', bad({ bogus: 1 })),
      () => resolveOptions('plain', bad({ profile: 'huge' })),
      () => resolveOptions('plain', bad({ table: { strategy: 'grid' } })),
      () => resolveOptions('plain', bad({ glyphs: 7 })),
      () => resolveOptions('plain', bad({ tasks: 5 })),
      () => resolveOptions('plain', bad({ headings: { 9: {} } })),
      () => resolveOptions('plain', bad({ code: { topRun: -1 } })),
      () => resolveOptions('plain', bad({ maxWidth: 0 })),
      () => resolveOptions(bad('sideways')),
    ];
    for (const run of runs) {
      let message = '';
      try {
        run();
      } catch (error) {
        if (error instanceof TypeError) message = error.message;
      }
      expect(message.startsWith('unmarkdown: ')).toBe(true);
    }
  });

  it('accepts valid boundary values without throwing', () => {
    expect(() => resolveOptions('plain', { headingDepth: 1 })).not.toThrow();
    expect(() => resolveOptions('plain', { headingDepth: 6 })).not.toThrow();
    expect(() => resolveOptions('plain', { maxWidth: 1 })).not.toThrow();
    expect(() => resolveOptions('plain', { profile: 'compact' })).not.toThrow();
    expect(() => resolveOptions('plain', { tasks: { pending: '·', done: '✓', cancelled: '✗' } })).not.toThrow();
    expect(() => resolveOptions('plain', { table: { strategy: 'record', twoColumnLabel: 'Info' } })).not.toThrow();
    expect(() => resolveOptions('plain', { inlineCode: 'bracket' })).not.toThrow();
    expect(() => resolveOptions('plain', { blockquotes: 'preserve', ordered: 'preserve', strikethrough: 'preserve' })).not.toThrow();
    expect(() => resolveOptions('plain', { code: { frame: '~', topRun: 0, bottomRun: 0, label: false } })).not.toThrow();
    expect(() => resolveOptions('pseudo', { glyphs: 'ascii' })).not.toThrow();
    expect(resolveOptions('plain', { code: { frame: '~', topRun: 0, bottomRun: 0, label: false } }).code).toEqual({
      frame: '~',
      topRun: 0,
      bottomRun: 0,
      label: false,
    });
  });
});
