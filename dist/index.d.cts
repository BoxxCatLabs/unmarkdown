/**
 * Unicode display-width measurement: how many terminal columns a string
 * occupies in a monospace chat surface. Pure, deterministic, dependency-free;
 * range tables are hardcoded and probed by binary search.
 *
 * Rules (feedback doc §8 "Unicode display width"):
 * - Default column width is 1; astral-safe (iterates code points, not UTF-16 units).
 * - Zero width: combining marks (Mn/Me/Mc), format controls Cf (ZWSP U+200B,
 *   ZWJ U+200D, BOM U+FEFF, …), variation selectors (U+FE00–FE0F,
 *   U+E0100–E01EF), C0/C1 controls.
 * - Width 2: East Asian Wide/Fullwidth (Hangul Jamo, CJK, kana, Hangul
 *   syllables, compatibility ideographs, vertical/fullwidth forms, CJK
 *   extensions) and emoji-presentation bases.
 * - Emoji sequences: VS16 (U+FE0F) after an emoji base keeps 2; skin-tone
 *   modifiers absorb into the base; ZWJ-joined constituents collapse into one
 *   2-column glyph. Regional indicators count 1 each, so a flag pair is 2.
 *
 * Documented approximation: mobile renderers compose emoji ZWJ sequences into
 * a single glyph (one 2-column cell); most terminals do too, but legacy ones
 * sum the constituents. We measure the mobile rendering. Ligature-forming
 * text (Arabic shaping, fi/ff ligatures) is also measured per code point,
 * which can overcount by the number of joined glyphs.
 */
/** Target display widths — not truncation limits (feedback doc §8). */
type WidthProfile = 'compact' | 'standard' | 'comfortable';
declare const WIDTH_PROFILES: Record<WidthProfile, number>;
/**
 * Display width of `s` in monospace columns. Zero for an empty string;
 * O(n) over code points; deterministic pure function.
 *
 * Regional indicators (U+1F1E6–U+1F1FF) fall through to the width-1 default,
 * so a flag pair measures 2 while a lone indicator measures 1.
 */
declare function displayWidth(s: string): number;

/**
 * User-facing options, pipeline defaults, and validation.
 *
 * `resolveOptions` is the single place defaults are applied, in layers:
 *
 * 1. Pipeline defaults — each pipeline (`plain`, `pseudo`) starts from its own
 *    style defaults. When the caller passes `glyphs: 'ascii'`, the unicode
 *    glyph bundle (headings, bullets, quote prefix, task checkboxes, code
 *    frame, table frames, hrule) is swapped for the ASCII bundle first.
 * 2. Explicit user layer — every key the caller passes wins over the
 *    pipeline defaults.
 *
 * Validation throws `TypeError` (message prefix `unmarkdown: `) on unknown
 * keys, invalid enums, and malformed values so typos fail loud instead of
 * silently no-oping.
 *
 * `wrap` is consumed by the plain pipeline only; it is reserved for future use
 * in other pipelines and surfaces.
 */

/** Heading levels, keyed by ATX depth. */
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
interface HeadingLevelStyle {
    prefix?: string;
    suffix?: string;
    frame?: string;
}
interface TaskGlyphs {
    pending: string;
    done: string;
    cancelled: string;
}
interface CodeFrameOptions {
    frame: string;
    topRun: number;
    bottomRun: number;
    label: boolean;
}
interface TableOptions {
    open: string;
    close: string;
    emptyCell: string;
    enabled: boolean;
    strategy: 'auto' | 'record' | 'compact';
    twoColumnLabel?: string;
}
interface PlainTextOptions {
    /** Width profile; ignored when `maxWidth` is set. */
    profile?: WidthProfile;
    /** Explicit column budget; overrides `profile`. */
    maxWidth?: number;
    /**
     * Word-wrap prose to the resolved `width`. Consumed by the plain pipeline
     * only; reserved for future use in other pipelines and surfaces.
     */
    wrap?: boolean;
    /** `decorate` applies the per-level style; `preserve` keeps raw ATX text. */
    headingMode?: 'decorate' | 'preserve';
    /** Deepest decorated heading level (1–6); deeper levels stay raw. */
    headingDepth?: number;
    /** Per-level style overrides, merged field-wise over the glyph bundle. */
    headings?: Partial<Record<HeadingLevel, HeadingLevelStyle>>;
    bullet?: string;
    bulletNested?: string;
    ordered?: 'render' | 'preserve';
    /** Task checkbox glyphs; partial objects merge over the defaults. */
    tasks?: Partial<TaskGlyphs>;
    blockquotes?: 'bar' | 'preserve';
    quotePrefix?: string;
    inlineCode?: 'verbatim' | 'corner' | 'bracket';
    strikethrough?: 'strip' | 'brackets' | 'overline' | 'preserve';
    hruleMode?: 'decorate' | 'preserve';
    hrule?: string;
    links?: 'decorated' | 'urlOnly' | 'verbatim';
    guardUrlParens?: boolean;
    codeBlock?: 'decorated' | 'verbatim';
    code?: Partial<CodeFrameOptions>;
    glyphs?: 'unicode' | 'ascii';
    table?: Partial<TableOptions>;
}
interface ResolvedHeadingStyle {
    prefix: string;
    suffix: string;
    frame: string;
}
/** Fully concrete resolution of {@link PlainTextOptions} for one pipeline call. */
interface ResolvedOptions {
    profile: WidthProfile;
    /** Resolved numeric width: `maxWidth ?? WIDTH_PROFILES[profile]`. */
    width: number;
    wrap: boolean;
    headingMode: 'decorate' | 'preserve';
    headingDepth: number;
    headings: Record<HeadingLevel, ResolvedHeadingStyle>;
    bullet: string;
    bulletNested: string;
    ordered: 'render' | 'preserve';
    tasks: TaskGlyphs;
    blockquotes: 'bar' | 'preserve';
    quotePrefix: string;
    inlineCode: 'verbatim' | 'corner' | 'bracket';
    strikethrough: 'strip' | 'brackets' | 'overline' | 'preserve';
    hruleMode: 'decorate' | 'preserve';
    hrule: string;
    links: 'decorated' | 'urlOnly' | 'verbatim';
    guardUrlParens: boolean;
    codeBlock: 'decorated' | 'verbatim';
    code: CodeFrameOptions;
    glyphs: 'unicode' | 'ascii';
    table: TableOptions;
}
/** Separator strings are byte-exact per docs/table-to-markdown.md and docs/unmarkdown-feedback.md (8 `═` each side of ` ✧･ﾟ `). */
declare const DEFAULT_TABLE_OPTIONS: TableOptions;
type PipelineName = 'plain' | 'pseudo';
/**
 * Resolve the effective options for one pipeline call, in layer order:
 * pipeline defaults (re-skinned by the `glyphs` bundle) → explicit user keys.
 * `plain` is the default pipeline. Throws `TypeError` (prefix `unmarkdown: `)
 * on unknown keys, invalid enums, and malformed values.
 */
declare function resolveOptions(pipeline?: PipelineName, user?: PlainTextOptions): ResolvedOptions;

/**
 * Plain pipeline (`toPlainText`) — presentation format for surfaces that
 * cannot render Markdown at all: headings framed/decorated per level
 * (H1 width-aware `━━`, single line guaranteed), bullets `•`/`◦` with
 * normalized indent, ordered lists re-rendered (`1.`, nested `a.`), task
 * checkboxes as glyphs, blockquotes bar-prefixed `┃`, hrules decorated
 * `─────`, inline code corner-bracketed `『』`, strikethrough stripped,
 * links/images ZWSP-guarded, code fences `┄`-framed, tables rendered as
 * record blocks (auto strategy: compact two-column boxes where they fit).
 */

declare function toPlainText(input: string, options?: PlainTextOptions): string;

/**
 * Pseudo-markdown pipeline (`toPseudoMarkdown`) — for surfaces with native
 * Markdown rendering: headings kept as `## Title`, emphasis normalized and
 * preserved, strikethrough `~~kept~~`, blockquotes `>`-prefixed per depth,
 * hrules normalized to `---`, lists level-normalized; inline code, code
 * fences and links stay verbatim by default, tables render as record blocks
 * (auto strategy).
 */

declare function toPseudoMarkdown(input: string, options?: PlainTextOptions): string;

/**
 * Standalone entry: decorate `input` only when it parses as exactly one
 * table (all lines pipe-rows, 2nd line a delimiter row); otherwise return
 * the original input unchanged. Cells run through the plain-path inline
 * pass (link/image decoration, emphasis stripping, plain-path strikethrough
 * and inline-code styles, `\"` unescape); the block layout follows
 * `opts.table.strategy` exactly like the in-text path.
 */
declare function decorateTable(input: string, userOpts?: PlainTextOptions): string;

/**
 * Pure residual-markdown detection — the stateless replacement for boxxcat's
 * module-level `lastHadMarkdown` side effect. True when the input still
 * contains a heading line, bold, italic, inline code, or unconsumed
 * reference-style markdown: a `[ref]: url` definition line or a
 * `[label][ref]` / `[label][]` use (collapsed form included). No
 * transforms, no state.
 */
declare function analyze(input: string): {
    hadResidualMarkdown: boolean;
};

export { DEFAULT_TABLE_OPTIONS, type PipelineName, type PlainTextOptions, type ResolvedOptions, type TableOptions, WIDTH_PROFILES, type WidthProfile, analyze, decorateTable, displayWidth, resolveOptions, toPlainText, toPseudoMarkdown };
