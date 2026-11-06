import { describe, expect, it } from 'vitest';
import { WIDTH_PROFILES, displayWidth } from '../src/core/width.js';

// Zero-width and joiner characters, spelled as escapes for legibility.
const ZWSP = '\u200B'; // U+200B zero-width space (Cf)
const ZWNJ = '\u200C'; // U+200C zero-width non-joiner (Cf)
const ZWJ = '\u200D'; // U+200D zero-width joiner (Cf)
const VS16 = '\uFE0F'; // U+FE0F emoji variation selector

describe('displayWidth — ASCII and controls', () => {
  it('measures an empty string as 0 columns', () => {
    expect(displayWidth('')).toBe(0);
  });

  it('counts ASCII as one column each', () => {
    expect(displayWidth(`Hello, world!`)).toBe(13);
    expect(displayWidth(`a`)).toBe(1);
  });

  it('gives C0 controls zero width', () => {
    expect(displayWidth(`a\tb\nc`)).toBe(3);
    expect(displayWidth('\u0000\u001F')).toBe(0);
    expect(displayWidth('\u007F\u009F')).toBe(0); // C1 controls too
  });

  it('gives format controls zero width', () => {
    expect(displayWidth(ZWSP)).toBe(0);
    expect(displayWidth(ZWNJ)).toBe(0);
    expect(displayWidth(ZWJ)).toBe(0);
    expect(displayWidth('\uFEFF')).toBe(0);
  });

  it('gives variation selectors zero width', () => {
    expect(displayWidth(VS16)).toBe(0);
    expect(displayWidth('\uFE00')).toBe(0);
    expect(displayWidth('\u{E0100}')).toBe(0);
  });
});

describe('displayWidth — East Asian Wide/Fullwidth', () => {
  it('measures CJK ideographs as two columns', () => {
    expect(displayWidth(`中文`)).toBe(4);
    expect(displayWidth(`日本語`)).toBe(6);
  });

  it('measures mixed ASCII and CJK correctly', () => {
    expect(displayWidth(`a中b`)).toBe(4);
    expect(displayWidth(`a 중 b`)).toBe(6);
  });

  it('measures kana and Hangul as two columns', () => {
    expect(displayWidth(`あ`)).toBe(2);
    expect(displayWidth(`한글`)).toBe(4);
    expect(displayWidth('\u1100')).toBe(2); // Hangul Jamo leading ㄱ
  });

  it('measures fullwidth forms as two columns', () => {
    expect(displayWidth(`！`)).toBe(2); // U+FF01
    expect(displayWidth(`Ａ`)).toBe(2); // U+FF21
    expect(displayWidth('\uFFE6')).toBe(2); // fullwidth won sign
  });

  it('measures halfwidth katakana as one column', () => {
    expect(displayWidth(`ｶ`)).toBe(1); // U+FF76
    expect(displayWidth('\uFF61')).toBe(1); // halfwidth ideographic full stop
    expect(displayWidth(`ｶﾞ`)).toBe(2); // two halfwidth code points
  });

  it('measures astral CJK extensions as two columns', () => {
    expect(displayWidth('\u{20000}')).toBe(2); // CJK ext B 𠀀
    expect(displayWidth('\u{2A700}')).toBe(2); // plane 3 territory
  });
});

describe('displayWidth — combining marks', () => {
  it('measures combining marks as zero width', () => {
    expect(displayWidth(`e\u0301`)).toBe(1); // e + combining acute
    expect(displayWidth(`e\u0301\u0301`)).toBe(1); // stacked marks
    expect(displayWidth('\u0301\u0302')).toBe(0); // marks alone
    expect(displayWidth(`é`)).toBe(1); // precomposed contrast
  });
});

describe('displayWidth — emoji', () => {
  it('measures a solo astral emoji as two columns', () => {
    expect(displayWidth(`😀`)).toBe(2); // U+1F600
    expect(displayWidth(`🐟`)).toBe(2); // U+1F420
    expect(displayWidth('\u231A')).toBe(2); // BMP emoji ⌚
    expect(displayWidth('\u2705')).toBe(2); // ✅
  });

  it('keeps VS16 after an emoji base at width 2', () => {
    expect(displayWidth(`😀${VS16}`)).toBe(2);
    expect(displayWidth('\u2705\uFE0F')).toBe(2);
  });

  it('measures regional indicators at one column each, flag pairs at two', () => {
    expect(displayWidth(`🇰🇷`)).toBe(2); // flag pair
    expect(displayWidth(`🇩🇪🇫🇷`)).toBe(4); // two flags
    expect(displayWidth('\u{1F1E6}')).toBe(1); // lone regional indicator
  });

  it('collapses a ZWJ family emoji into one glyph of width 2', () => {
    expect(displayWidth(`👨${ZWJ}👩${ZWJ}👧${ZWJ}👦`)).toBe(2);
    expect(displayWidth(`👩${ZWJ}💻`)).toBe(2); // woman-technologist
  });

  it('absorbs skin-tone modifiers into the base emoji', () => {
    expect(displayWidth(`👍\u{1F3FD}`)).toBe(2);
  });

  it('does not collapse adjacent unjoined emoji', () => {
    expect(displayWidth(`😀😀`)).toBe(4);
    expect(displayWidth(`😀${ZWJ}x`)).toBe(3); // malformed ZWJ: base stands, text counts
  });
});

describe('displayWidth — determinism', () => {
  it('is deterministic and exact on a long mixed string', () => {
    const unit = `a中${'😀'}\u0301`; // 1 + 2 + 2 + 0 columns
    const s = unit.repeat(1000);
    expect(displayWidth(s)).toBe(5000);
    expect(displayWidth(s)).toBe(displayWidth(s));
  });

  it('handles long URL-ish and CJK-heavy lines', () => {
    const s = `https://example.com/${'경'.repeat(200)}/${'x'.repeat(200)}`;
    expect(displayWidth(s)).toBe(20 + 400 + 1 + 200);
  });
});

describe('WIDTH_PROFILES', () => {
  it('exposes compact / standard / comfortable target widths', () => {
    expect(WIDTH_PROFILES).toEqual({ compact: 32, standard: 40, comfortable: 60 });
  });
});
