# unmarkdown

A width-aware Markdown → plain-text presentation engine for chat surfaces that cannot render Markdown — chat-app text messages, SMS, push notifications. It treats plain text as a presentation format, not degraded Markdown: headings are framed per level and never exceed one row, tables become vertical records, code blocks get lightweight frames, and prose wraps to a configurable display-width budget without ever splitting a URL or a grapheme cluster.

Zero runtime dependencies; every export is a pure function with no module-level state, so the same input plus the same options always produces byte-identical output.

Two pipelines share one staged core — normalize → protect → table pass → wrap → line pass → inline pass → restore → cleanup — and differ only in the rule set bound at each stage:

- `toPlainText` — for plain-text surfaces: Markdown syntax removed, headings framed per level, links ZWSP-guarded, code fenced in `┄` frames, tables rendered as compact boxes or numbered records, prose wrapped to the width profile. This is the default pipeline.
- `toPseudoMarkdown` — for surfaces that render native Markdown: supported Markdown preserved and normalized (emphasis delimiters, list indents, reference links resolved), with the same table rendering.

## Install

```sh
npm install unmarkdown
```

Requires Node ≥ 18. Ships dual ESM + CJS builds with TypeScript types via an `exports` map (`import` / `require` / `types`); the package is side-effect free.

## Quick start

```ts
import { toPlainText } from 'unmarkdown'

const out = toPlainText(input)
```

Input:

````text
# Release 2.4

**New**: offline queue and one-tap retry.

## Checklist

- [x] Ship the uploader
- [ ] Write release notes

Full notes: [changelog](https://example.com/changelog)

| ID | Task | Owner |
| --- | --- | --- |
| TASK-001 | Fix navigation links | Shane |
| TASK-002 | Update documentation | Agent |

```js
const x = 1
```
````

`toPlainText(input)` (byte-for-byte; default `standard` profile = 40 columns):

```text
━━━━ Release 2.4 ━━━━

New: offline queue and one-tap
retry.

【 Checklist 】

☑ Ship the uploader
☐ Write release notes

Full notes: changelog (​https://example.com/changelog​)

════════ ✧･ﾟ ════════

[1] TASK-001
    Task: Fix navigation links
    Owner: Shane

[2] TASK-002
    Task: Update documentation
    Owner: Agent

════════ ✧･ﾟ ════════

┄┄┄┄┄ js ┄┄┄┄┄
const x = 1
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

Prose wraps to the resolved width. The same intro sentence under `profile: 'compact'` (32 columns) and `profile: 'comfortable'` (60 columns):

```text
【 Getting Started 】

Install the package and run the
setup script to configure your
environment for offline queues.
```

```text
【 Getting Started 】

Install the package and run the setup script to configure
your environment for offline queues.
```

The invisible characters flanking the URL in the changelog line are U+200B zero-width spaces (`guardUrlParens`): mobile auto-linkers otherwise swallow the closing `)` into the link, and the guard keeps the wrap intact.

## API

```ts
import {
  toPlainText,
  toPseudoMarkdown,
  decorateTable,
  analyze,
  resolveOptions,
  displayWidth,
  WIDTH_PROFILES,
} from 'unmarkdown'

toPlainText(input: string, options?: PlainTextOptions): string
toPseudoMarkdown(input: string, options?: PlainTextOptions): string
decorateTable(tableMarkdown: string, options?: PlainTextOptions): string
analyze(input: string): { hadResidualMarkdown: boolean }
resolveOptions(pipeline?: 'plain' | 'pseudo', options?: PlainTextOptions): ResolvedOptions
displayWidth(s: string): number
WIDTH_PROFILES: Record<WidthProfile, number>  // { compact: 32, standard: 40, comfortable: 60 }
```

- Non-string, empty, or whitespace-only input returns `''` from all entry points (`analyze` returns `{ hadResidualMarkdown: false }` for non-string input).
- `toPlainText` — the headline pipeline: per-level heading frames, emphasis stripped, links and code fences decorated, tables rendered as records/compact boxes, prose wrapped.
- `toPseudoMarkdown` — for surfaces that render native Markdown: emphasis, links, inline code, and fences preserved as Markdown (normalized where inconsistent), while reference links are resolved and tables are decorated.
- `decorateTable` — standalone table entry point. Renders only when the input parses as exactly one GFM table (every line a pipe row, second line a delimiter row); otherwise the input is returned unchanged. Cells run through the plain-path inline pass.
- `analyze` — pure residual-Markdown detection: true when the input still contains a heading line, bold, italic, inline code, or unconsumed reference-style Markdown (a `[ref]: url` definition or a `[label][ref]` use). No transforms, no state.
- `resolveOptions` — the option resolution the pipelines use; `pipeline` defaults to `'plain'`, so calling it with no pipeline yields the plain-pipeline defaults.
- `displayWidth` — the Unicode display-width measure (terminal columns) that drives framing and wrapping; `WidthProfile` is the `'compact' | 'standard' | 'comfortable'` union and `WIDTH_PROFILES` its width table.

Also exported: `DEFAULT_TABLE_OPTIONS` and the types `PlainTextOptions`, `TableOptions`, `ResolvedOptions`, `PipelineName`, `WidthProfile`.

## Rules

Every construct, per pipeline. In decorated link/image output the invisible characters flanking the URL are literal U+200B guards (see `guardUrlParens` in [Options](#options)).

### `toPlainText`

**Headings.** Each ATX level has its own style: H1 is framed with `━` runs capped at 4 per side and floored at 2 (degrading to the bare title when even that doesn't fit), H2 gets `【 】` brackets, H3–H6 get the prefixes `◆`, `◇`, `▸`, `›`. Inline Markdown in the title is normalized before measuring (`# **Release** 2.4` frames on the rendered text). Casing is preserved; an empty title drops the whole line; depths deeper than `headingDepth` pass through raw.

```text
## Installation             →  【 Installation 】
### Requirements            →  ◆ Requirements
#### Runtime Requirements   →  ◇ Runtime Requirements
##### Supported Platforms   →  ▸ Supported Platforms
###### Additional Notes     →  › Additional Notes
```

The H1 frame caps each side's `━` run at 4 and floors it at 2, and **the heading always stays on one row** — decoration shrinks before the title ever wraps or truncates. At the default width the frame takes the full 4 runs per side:

```text
━━━━ Getting Started ━━━━
```

As the width budget tightens, the runs shrink toward the 2-per-side floor — under `maxWidth: 21` the framed form still fits:

```text
━━ Getting Started ━━
```

Below that (e.g. `maxWidth: 16`) even the floor run no longer fits, and decoration is dropped entirely — the bare title is the degradation floor (the title itself is never wrapped, truncated, or modified):

```text
Getting Started
```

H2–H6 degrade the same way: if the decorated form would exceed the width, the bare title is emitted.

**Lists.** `-`, `*`, and `+` markers all render as `•` (nested: `◦`), with indentation normalized to two spaces per level:

```text
• first
• second
  ◦ nested one
  ◦ nested two
• third
```

**Ordered lists.** Renumbered from 1 in sequence (`1.`, `2.`, …); nested levels use letters (`a.`, `b.`, cycling after `z.`). Source numbers are replaced by the normalized sequence; a blank line does not reset the counter, but an unordered item or prose does:

```text
1. first
2. second
  a. sub
  b. sub
3. third
```

**Task lists.** GFM checkboxes become glyphs: `- [ ]` → `☐`, `- [x]`/`- [X]` → `☑`, replacing the bullet (configurable via `tasks`):

```text
☑ Ship the uploader
☐ Write release notes
```

**Blockquotes.** `┃ ` repeated per `>` depth (spaces between markers don't change depth):

```text
┃ first
┃ second
┃ ┃ nested
```

**Inline code.** Backticks render as corner brackets by default: `` Set `x = 1` here `` → `Set 『x = 1』 here`.

**Emphasis and strikethrough.** Bold/italic stripped to their content; `~~x~~` stripped as well (`strikethrough: 'brackets'` → `[x]`, `'overline'` → U+0336 after each character):

```text
~~gone~~ and **bold** and *it*  →  gone and bold and it
```

**Links, bare URLs, reference links.** `[text](url)` → `text (U+200B url U+200B)`; images follow the same mode. A link whose text equals its URL collapses to the bare URL, and bare URLs pass through untouched — no parens, no guard (the URL itself stays byte-clean; the ZWSP guards are never inserted *inside* a URL). Reference definitions (`[ref]: url`) are consumed, and `[label][ref]` / collapsed `[label][]` uses resolve exactly like inline links:

```text
Docs: guide (​https://example.com/guide​)
Repo: https://example.com/repo
Self: https://example.com/repo
Shot: screenshot (​https://example.com/s.png​)
```

Input with definitions:

```text
Read the [spec][ts-spec] first.

[ts-spec]: https://example.com/spec
```

Output — the definition line is consumed, the use resolves:

```text
Read the spec (​https://example.com/spec​) first.
```

**Escapes.** `\"quoted\"` → `"quoted"`.

**Horizontal rules.** `---`, `***`, and `___` runs render as `─────` (`hruleMode: 'preserve'` normalizes them to `---` instead).

**Code blocks and tables.** Fenced code becomes a `┄` frame ([Code blocks](#code-blocks)); tables become compact boxes or numbered records ([Tables](#tables)).

**Prose wrapping.** On by default (`wrap: true`), prose wraps greedily to the resolved width with Markdown-aware break points:

- A space is a break point only when no `[` or `(` is unclosed before it, an even number of `**`/`__`/`~~` marker pairs precede it, and an even number of backticks precede it. Otherwise the construct stays whole and its line may overflow rather than break mid-construct.
- Lines containing protected tokens (URLs, fenced code, inline code), decorated table regions, and source-syntax lines — headings, list items, blockquotes, rules, indented code, reference definitions — are never wrapped. This is what guarantees a heading, however long, stays on exactly one output row.
- Widths measure the raw source text (a conservative budget: decoration never makes a line longer than its source).
- An unbroken CJK run wider than the budget breaks between grapheme clusters; combining marks, variation selectors, and ZWJ stay attached to their base cluster, and a cluster is never split.
- Continuation lines are flush left; interior space runs collapse; nothing is ever truncated. Tokens with no safe break (long URLs, whole constructs) take their own line and overflow.

```text
这是一段比较长的中文散文，需要在宽度预算
内换行，而每个汉字都是两个显示列。
```

### `toPseudoMarkdown`

For surfaces whose renderer draws native Markdown. What is **preserved verbatim**: headings (`## Ship log`), emphasis delimiters, links, inline code, images, and fenced code blocks. What is **normalized**: emphasis delimiter runs, list markers/indents, thematic breaks, tilde runs, and reference links (resolved to inline form). Tables are decorated exactly as on the plain path.

| Construct | Input | Output |
| --- | --- | --- |
| Headings | `## Ship log` | `## Ship log` |
| Bold / italic | `__bold__ and _it_ and ***both***` | `**bold** and *it* and ***both***` |
| Strikethrough | `~~~gone~~~` | `~~gone~~` |
| Blockquote | `> quoted`<br>`>> deep` | `> quoted`<br>`>> deep` |
| Horizontal rule | `***` | `---` |
| Bullets | `* loose`<br>`    - deep`<br>`        - deeper` | `- loose`<br>`    - deep`<br>`      - deeper` |
| Ordered lists | `    3. third` | `    3. third` |
| Tasks | `- [x] done`<br>`- [ ] todo` | `- [x] done`<br>`- [ ] todo` |
| Links | `[Guide](https://example.com/guide)` | `[Guide](https://example.com/guide)` |
| Reference links | `Read [spec][] first.`<br><br>`[spec]: https://example.com/spec` | `Read [spec](https://example.com/spec) first.` |
| Inline code | `` `x = 1` `` | `` `x = 1` `` |
| Images | `![shot](https://example.com/s.png)` | `![shot](https://example.com/s.png)` |
| Escaped quotes | `\"quoted\"` | `"quoted"` |

List levels are `min(⌊indent/2⌋, 3)`, re-padded at two spaces per level; markers normalize to `- ` and ordered numbers are kept. Fenced code stays verbatim by default (that pipeline targets surfaces whose renderer draws them):

````text
```js
const x = 1
```
````

## Tables

Both pipelines render GFM tables with the same **auto strategy**: a table with exactly two columns renders as a compact key-value box; anything else renders as numbered record blocks. `table.strategy: 'record'` or `'compact'` forces one presentation — a forced `'compact'` on a non-2-column table safely falls back to records.

A table is a maximal run of consecutive pipe rows whose second line is a delimiter row, detected after code-fence protection (fences containing `|` lines are never misparsed). Tables are not recognized inside blockquotes.

**Record blocks** (three or more columns; or forced). Input:

```text
| ID | Task | Owner |
| --- | --- | --- |
| TASK-001 | Fix navigation links | Shane |
| TASK-002 | Update documentation | Agent |
```

Output:

```text
════════ ✧･ﾟ ════════

[1] TASK-001
    Task: Fix navigation links
    Owner: Shane

[2] TASK-002
    Task: Update documentation
    Owner: Agent

════════ ✧･ﾟ ════════
```

- The first column becomes the record heading, prefixed with a 1-based index: `[n] value`; an empty first cell yields `[n]` alone.
- Remaining columns render as four-space-indented `Header: Value` pairs, one per line, in original column order — no renames, drops, truncation, or grouping. An empty header falls back to the column's 1-based position.
- Exactly one opening and one closing separator; records are separated by a blank line.

**Compact boxes** (exactly two columns; label = pluralized first header, or `table.twoColumnLabel`). Input `| Property | Value |` rows render as:

```text
┌─ Properties ──────

Property  ─ Version
Value     ─ 1.2.0
Property  ─ License
Value     ─ MIT

└───────────────────
```

```text
┌─ Settings ──────

Property  ─ Version
Value     ─ 1.2.0
Property  ─ License
Value     ─ MIT

└─────────────────
```

Each data row contributes `Key  ─ Value` pairs (keys padded to the widest key); the bottom rule matches the top line's display width.

**Edge behavior.** Empty cells render as `(empty)`; ragged rows are padded/truncated to the header width, never dropped; `\|` inside a cell is a literal pipe; `<br>` variants and literal newlines inside a cell collapse to a single space; cell content runs through the active pipeline's inline pass; a table with no data rows renders just the frame pair. Input:

```text
| A | B |
| --- | --- |
| one | |
| two |
| | three |
```

Output:

```text
┌─ As ──────

A  ─ one
B  ─ (empty)
A  ─ two
B  ─ (empty)
A  ─ (empty)
B  ─ three

└───────────
```

Input `| A | B |` followed by its delimiter row (no data rows):

```text
┌─ As ──────

└───────────
```

## Code blocks

With `codeBlock: 'decorated'` (the plain-path default), a fence becomes a `┄` frame: the language label sits **in the opening separator**, the closing separator is a bare run, and body lines are emitted verbatim at **zero indent** — the fence's own leading indent is stripped (spaces only; tabs are content), relative indentation beyond it is preserved, interior blank lines survive as truly empty lines, and leading/trailing blank lines of the body are trimmed:

````text
```js
function f() {
  return 1
}
```
````

```text
┄┄┄┄┄ js ┄┄┄┄┄
function f() {
  return 1
}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

The label is the first whitespace-separated token of the fence info string. `code.label: false` drops it (both separators become bare runs):

```text
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
function f() {
  return 1
}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

A labeled opening line wider than the resolved width shrinks its side runs toward one. Content is never otherwise transformed — URLs and inline code inside a fence pass through byte-identically — and a fence's interior blank lines are preserved:

````text
```ts
  indented first
nested
```
````

```text
┄┄┄┄┄ ts ┄┄┄┄┄
  indented first
nested
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

`codeBlock: 'verbatim'` (the pseudo-path default) keeps the original backtick fence untouched.

## Options

All options are optional; unknown keys throw a `TypeError` at call time, as do wrong types, invalid enum values, non-positive-integer `maxWidth`, `headingDepth` outside 1–6, and negative `code.topRun`/`code.bottomRun`. Validation failures carry an `unmarkdown: ` message prefix.

| Option | Type | Plain default | Pseudo default | Effect |
| --- | --- | --- | --- | --- |
| `profile` | `'compact' \| 'standard' \| 'comfortable'` | `'standard'` | `'standard'` | Display-width target (32 / 40 / 60 columns) driving heading frames, code-frame shrink, and prose wrapping. Ignored when `maxWidth` is set |
| `maxWidth` | `number` | — | — | Explicit column budget (positive integer); overrides `profile` |
| `wrap` | `boolean` | `true` | `false` | Width-aware prose wrapping; consumed by the plain pipeline only |
| `headingMode` | `'decorate' \| 'preserve'` | `'decorate'` | `'preserve'` | Per-level styles vs raw ATX text (whitespace-normalized) |
| `headingDepth` | `number` (1–6) | `6` | `6` | Deepest decorated heading level; deeper headings pass through raw |
| `headings` | `Partial<Record<1 \| 2 \| 3 \| 4 \| 5 \| 6, { prefix?, suffix?, frame? }>>` | H1 `frame: '━'`; H2 `prefix: '【 '`, `suffix: ' 】'`; H3–H6 `prefix: '◆ ' / '◇ ' / '▸ ' / '› '` | same | Per-level style overrides, merged field-wise over the glyph bundle |
| `bullet` | `string` | `'•'` | `'•'` | Top-level unordered marker (pseudo normalizes markers to `- ` instead) |
| `bulletNested` | `string` | `'◦'` | `'◦'` | Nested unordered marker |
| `ordered` | `'render' \| 'preserve'` | `'render'` | `'preserve'` | Renumber `1.` / `a.` vs keep numbers and normalize indent only |
| `tasks` | `Partial<{ pending: string; done: string; cancelled: string }>` | `'☐' / '☑' / '☒'` | same | Task checkbox glyphs; partial objects merge over the defaults |
| `blockquotes` | `'bar' \| 'preserve'` | `'bar'` | `'preserve'` | Prefix with `quotePrefix` per depth vs keep `>` markers |
| `quotePrefix` | `string` | `'┃ '` | `'┃ '` | Blockquote prefix, repeated per depth |
| `inlineCode` | `'verbatim' \| 'corner' \| 'bracket'` | `'corner'` | `'verbatim'` | Backticks vs `『code』` vs `⦗ code ⦘` (U+2997/U+2998) around the code |
| `strikethrough` | `'strip' \| 'brackets' \| 'overline' \| 'preserve'` | `'strip'` | `'preserve'` | Bare content vs `[x]` vs U+0336 after each char vs `~~x~~` normalized and kept |
| `hruleMode` | `'decorate' \| 'preserve'` | `'decorate'` | `'preserve'` | Replace rules with `hrule` vs normalize to `---` |
| `hrule` | `string` | `'─────'` | `'─────'` | Replacement for `---`/`***`/`___` runs |
| `links` | `'decorated' \| 'urlOnly' \| 'verbatim'` | `'decorated'` | `'verbatim'` | `decorated`: `text (url)` with ZWSP guards, bare URL when text ≡ url; `urlOnly`: bare URL; `verbatim`: untouched. Images follow the same mode |
| `guardUrlParens` | `boolean` | `true` | `true` | U+200B between each paren and the URL in synthesized wraps; never inserted inside a URL |
| `codeBlock` | `'decorated' \| 'verbatim'` | `'decorated'` | `'verbatim'` | Fence rendering, per [Code blocks](#code-blocks) |
| `code` | `Partial<{ frame: string; topRun: number; bottomRun: number; label: boolean }>` | `'┄'`, `5`, `15`, `true` | same | Frame glyph, label side-run count, closing-run count, label visibility |
| `glyphs` | `'unicode' \| 'ascii'` | `'unicode'` | `'unicode'` | Glyph bundle swap, per the table below |
| `table.open` / `table.close` | `string` | `'════════ ✧･ﾟ ════════'` | same | Record-block separators |
| `table.emptyCell` | `string` | `'(empty)'` | same | Placeholder for empty cells |
| `table.enabled` | `boolean` | `true` | `true` | `false` skips table decoration inside the pipelines |
| `table.strategy` | `'auto' \| 'record' \| 'compact'` | `'auto'` | `'auto'` | `auto`: compact box for exactly 2 columns, records otherwise; forced values pin one presentation |
| `table.twoColumnLabel` | `string` | — (pluralized first header) | same | Compact box label override |

### `glyphs: 'ascii'`

One key swaps every decorative Unicode glyph for an ASCII bundle (per-call, both pipelines):

| Glyph | Unicode | ASCII |
| --- | --- | --- |
| H1 frame | `━` | `=` |
| H2 brackets | `【 】` | `[ ]` |
| H3–H6 prefixes | `◆ ◇ ▸ ›` | `:: ;; ~> ..` |
| Bullets | `•` / `◦` | `-` |
| Quote prefix | `┃ ` | `\| ` |
| Task checkboxes | `☐ ☑ ☒` | `[ ] [x] [-]` |
| Horizontal rule | `─────` | `-----` |
| Code frame | `┄` | `-` |
| Record separators | `════════ ✧･ﾟ ════════` | `----------` |

Compact box corners use `┌`/`└` with `─` rules under the Unicode bundle and `+` with `-` rules under `glyphs: 'ascii'`. A full document under `glyphs: 'ascii'`:

```text
==== Title ====

[ Section ]

- one
  - nested

| quoted

-----

+- As ------

A  - 1
B  - 2

+-----------

----- js -----
const x = 1
---------------

[ ] pending
[x] done
```

## Behavior notes & limitations

- **Not a CommonMark parser.** Transforms are line-based and the emphasis pass is a naive regex; block constructs outside the supported catalog pass through untouched. Full CommonMark parsing is a non-goal.
- **Indented (4-space) code blocks are not recognized** — only backtick fences. Four-or-more-backtick outer fences consume inner three-backtick blocks verbatim; unclosed fences pass through raw.
- **Tables are not recognized inside blockquotes.**
- **LaTeX conversion is out of scope.**
- **Deterministic.** Same input + same options → byte-identical output; no clock, randomness, or module state. Identical behavior is pinned by tests.
- **No content loss.** Every table cell, code line, and record field appears in the output; nothing is truncated or silently dropped (wrapping may *re-flow* prose, but never removes it). The one exception: ragged table rows wider than their header are truncated to the header width, so cells beyond the last header column do not appear (see [Tables](#tables)).
- **Idempotence, with a caveat.** Decorated constructs no longer look like Markdown, so re-running `toPlainText` over its own output is byte-stable for the supported catalog. The exception: a heading degraded to its bare title (narrow width budget) is indistinguishable from prose on reprocessing and will be wrapped like any prose line. Output is information-preserving, not reversible — feeding one pipeline's output through the *other* applies that pipeline's rules (e.g. the plain path strips pseudo-preserved emphasis).
- **Width is a documented approximation.** `displayWidth` measures terminal columns as a proxy for mobile rendering: CJK/fullwidth and emoji count 2 columns (ZWJ-joined sequences and skin-tone modifiers count once; a regional-indicator flag pair is 2), combining marks and zero-width/format controls count 0. Legacy terminals that sum ZWJ constituents, and ligature-forming scripts measured per code point, can differ from what a phone actually shows.
- **Protected spans pass through byte-identically.** URLs, fenced code, and inline code are tokenized behind sentinels allocated from unused `U+E000–U+E0FF` codepoints (inputs that already contain such characters are safe — sentinels are chosen only from codepoints absent from the input), and sentinels never leak into output.
- **Safe on plain prose.** Text without Markdown maps to itself through `toPlainText` (modulo newline/whitespace cleanup and the default width-profile wrapping — pass `wrap: false` to leave line breaks exactly as authored).
- **License.** MIT.

## License

[MIT](./LICENSE) (SPDX: `MIT`). Copyright (c) 2026 Shane Hu.
