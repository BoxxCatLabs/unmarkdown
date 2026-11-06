import { describe, expect, it } from 'vitest';
import { analyze } from '../src/index.js';

describe('analyze — residual markdown detection', () => {
  it('detects bold, italic, and inline code', () => {
    expect(analyze('**x**').hadResidualMarkdown).toBe(true);
    expect(analyze('__x__').hadResidualMarkdown).toBe(true);
    expect(analyze('*x*').hadResidualMarkdown).toBe(true);
    expect(analyze('_x_').hadResidualMarkdown).toBe(true);
    expect(analyze('`c`').hadResidualMarkdown).toBe(true);
  });

  it('detects a heading line', () => {
    expect(analyze('# h').hadResidualMarkdown).toBe(true);
    expect(analyze('###### deep').hadResidualMarkdown).toBe(true);
    expect(analyze('intro\n## section\nmore').hadResidualMarkdown).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(analyze('plain text').hadResidualMarkdown).toBe(false);
    expect(analyze('two words\nsecond line').hadResidualMarkdown).toBe(false);
  });

  it('returns false for bare URLs', () => {
    expect(analyze('https://example.com').hadResidualMarkdown).toBe(false);
    expect(analyze('see https://example.com/page?q=1 end').hadResidualMarkdown).toBe(false);
  });

  it('returns false for markdown-lookalikes that are not residual markdown', () => {
    expect(analyze('#hashtag').hadResidualMarkdown).toBe(false);
    expect(analyze('a * b').hadResidualMarkdown).toBe(false);
  });

  it('returns false for empty and whitespace-only input', () => {
    expect(analyze('').hadResidualMarkdown).toBe(false);
    expect(analyze('   ').hadResidualMarkdown).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(analyze(null as never).hadResidualMarkdown).toBe(false);
    expect(analyze(undefined as never).hadResidualMarkdown).toBe(false);
    expect(analyze(42 as never).hadResidualMarkdown).toBe(false);
  });

  it('returns the documented result shape', () => {
    expect(analyze('# h')).toStrictEqual({ hadResidualMarkdown: true });
    expect(analyze('plain')).toStrictEqual({ hadResidualMarkdown: false });
  });
});

describe('analyze — reference-style markdown (unconsumed)', () => {
  it('detects reference definition lines', () => {
    expect(analyze('[docs]: https://example.com').hadResidualMarkdown).toBe(true);
    expect(analyze('  [docs]: https://example.com').hadResidualMarkdown).toBe(true);
    expect(analyze('intro\n[docs]: https://example.com\nmore').hadResidualMarkdown).toBe(true);
    expect(analyze('[docs]: https://example.com "Title"').hadResidualMarkdown).toBe(true);
  });

  it('detects reference-style link uses including the collapsed form', () => {
    expect(analyze('see [Docs][docs]').hadResidualMarkdown).toBe(true);
    expect(analyze('see [Docs][]').hadResidualMarkdown).toBe(true);
  });

  it('does not flag inline links or bracket lookalikes', () => {
    expect(analyze('[Docs](https://example.com)').hadResidualMarkdown).toBe(false);
    expect(analyze('see [1] and [2] here').hadResidualMarkdown).toBe(false);
  });

  it('does not flag code-block-indented definition lines (4 spaces)', () => {
    expect(analyze('    [docs]: https://example.com').hadResidualMarkdown).toBe(false);
  });
});
