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

import { WIDTH_PROFILES } from './core/width'
import type { WidthProfile } from './core/width'

/** Heading levels, keyed by ATX depth. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingLevelStyle {
  prefix?: string
  suffix?: string
  frame?: string
}

export interface TaskGlyphs {
  pending: string
  done: string
  cancelled: string
}

export interface CodeFrameOptions {
  frame: string
  topRun: number
  bottomRun: number
  label: boolean
}

export interface TableOptions {
  open: string
  close: string
  emptyCell: string
  enabled: boolean
  strategy: 'auto' | 'record' | 'compact'
  twoColumnLabel?: string
}

export interface PlainTextOptions {
  /** Width profile; ignored when `maxWidth` is set. */
  profile?: WidthProfile
  /** Explicit column budget; overrides `profile`. */
  maxWidth?: number
  /**
   * Word-wrap prose to the resolved `width`. Consumed by the plain pipeline
   * only; reserved for future use in other pipelines and surfaces.
   */
  wrap?: boolean
  /** `decorate` applies the per-level style; `preserve` keeps raw ATX text. */
  headingMode?: 'decorate' | 'preserve'
  /** Deepest decorated heading level (1–6); deeper levels stay raw. */
  headingDepth?: number
  /** Per-level style overrides, merged field-wise over the glyph bundle. */
  headings?: Partial<Record<HeadingLevel, HeadingLevelStyle>>
  bullet?: string
  bulletNested?: string
  ordered?: 'render' | 'preserve'
  /** Task checkbox glyphs; partial objects merge over the defaults. */
  tasks?: Partial<TaskGlyphs>
  blockquotes?: 'bar' | 'preserve'
  quotePrefix?: string
  inlineCode?: 'verbatim' | 'corner' | 'bracket'
  strikethrough?: 'strip' | 'brackets' | 'overline' | 'preserve'
  hruleMode?: 'decorate' | 'preserve'
  hrule?: string
  links?: 'decorated' | 'urlOnly' | 'verbatim'
  guardUrlParens?: boolean
  codeBlock?: 'decorated' | 'verbatim'
  code?: Partial<CodeFrameOptions>
  glyphs?: 'unicode' | 'ascii'
  table?: Partial<TableOptions>
}

export interface ResolvedHeadingStyle {
  prefix: string
  suffix: string
  frame: string
}

/** Fully concrete resolution of {@link PlainTextOptions} for one pipeline call. */
export interface ResolvedOptions {
  profile: WidthProfile
  /** Resolved numeric width: `maxWidth ?? WIDTH_PROFILES[profile]`. */
  width: number
  wrap: boolean
  headingMode: 'decorate' | 'preserve'
  headingDepth: number
  headings: Record<HeadingLevel, ResolvedHeadingStyle>
  bullet: string
  bulletNested: string
  ordered: 'render' | 'preserve'
  tasks: TaskGlyphs
  blockquotes: 'bar' | 'preserve'
  quotePrefix: string
  inlineCode: 'verbatim' | 'corner' | 'bracket'
  strikethrough: 'strip' | 'brackets' | 'overline' | 'preserve'
  hruleMode: 'decorate' | 'preserve'
  hrule: string
  links: 'decorated' | 'urlOnly' | 'verbatim'
  guardUrlParens: boolean
  codeBlock: 'decorated' | 'verbatim'
  code: CodeFrameOptions
  glyphs: 'unicode' | 'ascii'
  table: TableOptions
}

/** Separator strings are byte-exact per docs/table-to-markdown.md and docs/unmarkdown-feedback.md (8 `═` each side of ` ✧･ﾟ `). */
export const DEFAULT_TABLE_OPTIONS: TableOptions = {
  open: '════════ ✧･ﾟ ════════',
  close: '════════ ✧･ﾟ ════════',
  emptyCell: '(empty)',
  enabled: true,
  strategy: 'auto',
}

const ASCII_TABLE_FRAME = '----------'

const DEFAULT_TASK_GLYPHS: TaskGlyphs = { pending: '☐', done: '☑', cancelled: '☒' }
const ASCII_TASK_GLYPHS: TaskGlyphs = { pending: '[ ]', done: '[x]', cancelled: '[-]' }

const DEFAULT_CODE_FRAME: CodeFrameOptions = { frame: '┄', topRun: 5, bottomRun: 15, label: true }
const ASCII_CODE_FRAME: CodeFrameOptions = { frame: '-', topRun: 5, bottomRun: 15, label: true }

const UNICODE_HEADINGS: Record<HeadingLevel, HeadingLevelStyle> = {
  1: { frame: '━' },
  2: { prefix: '【 ', suffix: ' 】' },
  3: { prefix: '◆ ' },
  4: { prefix: '◇ ' },
  5: { prefix: '▸ ' },
  6: { prefix: '› ' },
}

const ASCII_HEADINGS: Record<HeadingLevel, HeadingLevelStyle> = {
  1: { frame: '=' },
  2: { prefix: '[ ', suffix: ' ]' },
  3: { prefix: ':: ' },
  4: { prefix: ';; ' },
  5: { prefix: '~> ' },
  6: { prefix: '.. ' },
}

export type PipelineName = 'plain' | 'pseudo'

const TOP_LEVEL_KEYS: Record<string, true> = {
  profile: true,
  maxWidth: true,
  wrap: true,
  headingMode: true,
  headingDepth: true,
  headings: true,
  bullet: true,
  bulletNested: true,
  ordered: true,
  tasks: true,
  blockquotes: true,
  quotePrefix: true,
  inlineCode: true,
  strikethrough: true,
  hruleMode: true,
  hrule: true,
  links: true,
  guardUrlParens: true,
  codeBlock: true,
  code: true,
  glyphs: true,
  table: true,
}

const HEADING_LEVEL_KEYS: Record<string, true> = { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true }
const HEADING_STYLE_KEYS: Record<string, true> = { prefix: true, suffix: true, frame: true }
const TASK_KEYS: Record<string, true> = { pending: true, done: true, cancelled: true }
const CODE_KEYS: Record<string, true> = { frame: true, topRun: true, bottomRun: true, label: true }
const TABLE_KEYS: Record<string, true> = {
  open: true,
  close: true,
  emptyCell: true,
  enabled: true,
  strategy: true,
  twoColumnLabel: true,
}

const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6]

function fail(message: string): never {
  throw new TypeError(`unmarkdown: ${message}`)
}

function expectString(value: unknown, key: string): asserts value is string {
  if (typeof value !== 'string') fail(`option "${key}" must be a string`)
}

function expectBoolean(value: unknown, key: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(`option "${key}" must be a boolean`)
}

function expectEnum(value: unknown, key: string, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(`option "${key}" must be one of ${allowed.map((v) => `'${v}'`).join(' | ')}`)
  }
}

function readOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined
  expectString(value, key)
  return value
}

function readOptionalBoolean(value: unknown, key: string): boolean | undefined {
  if (value === undefined) return undefined
  expectBoolean(value, key)
  return value
}

function readOptionalNonNegativeInt(value: unknown, key: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`option "${key}" must be a non-negative integer`)
  }
  return value
}

function expectObject(value: unknown, key: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`option "${key}" must be an object`)
}

function concretizeHeading(style: HeadingLevelStyle): ResolvedHeadingStyle {
  return {
    prefix: style.prefix ?? '',
    suffix: style.suffix ?? '',
    frame: style.frame ?? '',
  }
}

type HeadingsOverride = Partial<Record<HeadingLevel, HeadingLevelStyle>>

/** Validate `headings` and return its explicitly-defined per-level keys. */
function resolveHeadingsOverride(raw: PlainTextOptions['headings']): HeadingsOverride {
  if (raw === undefined) return {}
  expectObject(raw, 'headings')
  for (const key of Object.keys(raw)) {
    if (!HEADING_LEVEL_KEYS[key]) fail(`unknown key "${key}" inside headings/`)
  }
  const out: HeadingsOverride = {}
  for (const level of HEADING_LEVELS) {
    const style = raw[level]
    if (style === undefined) continue
    expectObject(style, `headings.${level}`)
    for (const styleKey of Object.keys(style)) {
      if (!HEADING_STYLE_KEYS[styleKey]) fail(`unknown key "${styleKey}" inside headings/${level}/`)
    }
    const resolved: HeadingLevelStyle = {}
    if (style.prefix !== undefined) resolved.prefix = readOptionalString(style.prefix, `headings.${level}.prefix`)
    if (style.suffix !== undefined) resolved.suffix = readOptionalString(style.suffix, `headings.${level}.suffix`)
    if (style.frame !== undefined) resolved.frame = readOptionalString(style.frame, `headings.${level}.frame`)
    out[level] = resolved
  }
  return out
}

/** Validate `tasks` and return its explicitly-defined keys. */
function resolveTasksOverride(raw: PlainTextOptions['tasks']): Partial<TaskGlyphs> | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('option "tasks" must be an object')
  for (const key of Object.keys(raw)) {
    if (!TASK_KEYS[key]) fail(`unknown key "${key}" inside tasks/`)
  }
  const out: Partial<TaskGlyphs> = {}
  if (raw.pending !== undefined) out.pending = readOptionalString(raw.pending, 'tasks.pending')
  if (raw.done !== undefined) out.done = readOptionalString(raw.done, 'tasks.done')
  if (raw.cancelled !== undefined) out.cancelled = readOptionalString(raw.cancelled, 'tasks.cancelled')
  return out
}

/** Validate `code` and return its explicitly-defined keys. */
function resolveCodeOverride(raw: PlainTextOptions['code']): Partial<CodeFrameOptions> {
  if (raw === undefined) return {}
  expectObject(raw, 'code')
  for (const key of Object.keys(raw)) {
    if (!CODE_KEYS[key]) fail(`unknown key "${key}" inside code/`)
  }
  const out: Partial<CodeFrameOptions> = {}
  if (raw.frame !== undefined) out.frame = readOptionalString(raw.frame, 'code.frame')
  if (raw.topRun !== undefined) out.topRun = readOptionalNonNegativeInt(raw.topRun, 'code.topRun')
  if (raw.bottomRun !== undefined) out.bottomRun = readOptionalNonNegativeInt(raw.bottomRun, 'code.bottomRun')
  if (raw.label !== undefined) out.label = readOptionalBoolean(raw.label, 'code.label')
  return out
}

/** Validate `table` and return its explicitly-defined keys. */
function resolveTableOverride(raw: PlainTextOptions['table']): Partial<TableOptions> {
  if (raw === undefined) return {}
  expectObject(raw, 'table')
  for (const key of Object.keys(raw)) {
    if (!TABLE_KEYS[key]) fail(`unknown key "${key}" inside table/`)
  }
  const out: Partial<TableOptions> = {}
  if (raw.open !== undefined) out.open = readOptionalString(raw.open, 'table.open')
  if (raw.close !== undefined) out.close = readOptionalString(raw.close, 'table.close')
  if (raw.emptyCell !== undefined) out.emptyCell = readOptionalString(raw.emptyCell, 'table.emptyCell')
  if (raw.enabled !== undefined) out.enabled = readOptionalBoolean(raw.enabled, 'table.enabled')
  if (raw.strategy !== undefined) {
    expectEnum(raw.strategy, 'table.strategy', ['auto', 'record', 'compact'])
    out.strategy = raw.strategy
  }
  if (raw.twoColumnLabel !== undefined) out.twoColumnLabel = readOptionalString(raw.twoColumnLabel, 'table.twoColumnLabel')
  return out
}

/** Validate top-level scalar options and unknown keys (nested objects are validated by their resolvers). */
function validate(user: PlainTextOptions): void {
  for (const key of Object.keys(user)) {
    if (!TOP_LEVEL_KEYS[key]) fail(`unknown option "${key}"`)
  }
  if (user.profile !== undefined) expectEnum(user.profile, 'profile', ['compact', 'standard', 'comfortable'])
  if (user.maxWidth !== undefined) {
    if (typeof user.maxWidth !== 'number' || !Number.isInteger(user.maxWidth) || user.maxWidth <= 0) {
      fail('option "maxWidth" must be a positive integer')
    }
  }
  if (user.wrap !== undefined) expectBoolean(user.wrap, 'wrap')
  if (user.headingMode !== undefined) expectEnum(user.headingMode, 'headingMode', ['decorate', 'preserve'])
  if (user.headingDepth !== undefined) {
    if (typeof user.headingDepth !== 'number' || !Number.isInteger(user.headingDepth) || user.headingDepth < 1 || user.headingDepth > 6) {
      fail('option "headingDepth" must be an integer between 1 and 6')
    }
  }
  if (user.bullet !== undefined) expectString(user.bullet, 'bullet')
  if (user.bulletNested !== undefined) expectString(user.bulletNested, 'bulletNested')
  if (user.ordered !== undefined) expectEnum(user.ordered, 'ordered', ['render', 'preserve'])
  if (user.blockquotes !== undefined) expectEnum(user.blockquotes, 'blockquotes', ['bar', 'preserve'])
  if (user.quotePrefix !== undefined) expectString(user.quotePrefix, 'quotePrefix')
  if (user.inlineCode !== undefined) expectEnum(user.inlineCode, 'inlineCode', ['verbatim', 'corner', 'bracket'])
  if (user.strikethrough !== undefined) {
    expectEnum(user.strikethrough, 'strikethrough', ['strip', 'brackets', 'overline', 'preserve'])
  }
  if (user.hruleMode !== undefined) expectEnum(user.hruleMode, 'hruleMode', ['decorate', 'preserve'])
  if (user.hrule !== undefined) expectString(user.hrule, 'hrule')
  if (user.links !== undefined) expectEnum(user.links, 'links', ['decorated', 'urlOnly', 'verbatim'])
  if (user.guardUrlParens !== undefined) expectBoolean(user.guardUrlParens, 'guardUrlParens')
  if (user.codeBlock !== undefined) expectEnum(user.codeBlock, 'codeBlock', ['decorated', 'verbatim'])
  if (user.glyphs !== undefined) expectEnum(user.glyphs, 'glyphs', ['unicode', 'ascii'])
}

/**
 * Resolve the effective options for one pipeline call, in layer order:
 * pipeline defaults (re-skinned by the `glyphs` bundle) → explicit user keys.
 * `plain` is the default pipeline. Throws `TypeError` (prefix `unmarkdown: `)
 * on unknown keys, invalid enums, and malformed values.
 */
export function resolveOptions(pipeline: PipelineName = 'plain', user?: PlainTextOptions): ResolvedOptions {
  if (pipeline !== 'plain' && pipeline !== 'pseudo') fail(`unknown pipeline "${String(pipeline)}"`)
  if (user !== undefined && (typeof user !== 'object' || user === null || Array.isArray(user))) {
    fail('options must be an object')
  }

  const headingsOverride = resolveHeadingsOverride(user?.headings)
  const tasksOverride = resolveTasksOverride(user?.tasks)
  const codeOverride = resolveCodeOverride(user?.code)
  const tableOverride = resolveTableOverride(user?.table)
  if (user !== undefined) validate(user)

  const ascii = user?.glyphs === 'ascii'
  const headingBundle = ascii ? ASCII_HEADINGS : UNICODE_HEADINGS
  const taskBundle = ascii ? ASCII_TASK_GLYPHS : DEFAULT_TASK_GLYPHS

  // Layer 1: pipeline defaults, re-skinned by the glyph bundle.
  const resolved: ResolvedOptions = {
    profile: 'standard',
    width: WIDTH_PROFILES.standard,
    wrap: pipeline === 'plain',
    headingMode: pipeline === 'plain' ? 'decorate' : 'preserve',
    headingDepth: 6,
    headings: {
      1: concretizeHeading(headingBundle[1]),
      2: concretizeHeading(headingBundle[2]),
      3: concretizeHeading(headingBundle[3]),
      4: concretizeHeading(headingBundle[4]),
      5: concretizeHeading(headingBundle[5]),
      6: concretizeHeading(headingBundle[6]),
    },
    bullet: ascii ? '-' : '•',
    bulletNested: ascii ? '-' : '◦',
    ordered: pipeline === 'plain' ? 'render' : 'preserve',
    tasks: { ...taskBundle },
    blockquotes: pipeline === 'plain' ? 'bar' : 'preserve',
    quotePrefix: ascii ? '| ' : '┃ ',
    inlineCode: pipeline === 'plain' ? 'corner' : 'verbatim',
    strikethrough: pipeline === 'plain' ? 'strip' : 'preserve',
    hruleMode: pipeline === 'plain' ? 'decorate' : 'preserve',
    hrule: ascii ? '-----' : '─────',
    links: pipeline === 'plain' ? 'decorated' : 'verbatim',
    guardUrlParens: true,
    codeBlock: pipeline === 'plain' ? 'decorated' : 'verbatim',
    code: { ...(ascii ? ASCII_CODE_FRAME : DEFAULT_CODE_FRAME) },
    glyphs: ascii ? 'ascii' : 'unicode',
    table: ascii
      ? { ...DEFAULT_TABLE_OPTIONS, open: ASCII_TABLE_FRAME, close: ASCII_TABLE_FRAME }
      : { ...DEFAULT_TABLE_OPTIONS },
  }

  // Layer 2: explicit user keys win over the pipeline defaults.
  if (user !== undefined) {
    if (user.profile !== undefined) resolved.profile = user.profile
    if (user.wrap !== undefined) resolved.wrap = user.wrap
    if (user.headingMode !== undefined) resolved.headingMode = user.headingMode
    if (user.headingDepth !== undefined) resolved.headingDepth = user.headingDepth
    for (const level of HEADING_LEVELS) {
      const over = headingsOverride[level]
      if (over !== undefined) {
        resolved.headings[level] = {
          prefix: over.prefix ?? resolved.headings[level].prefix,
          suffix: over.suffix ?? resolved.headings[level].suffix,
          frame: over.frame ?? resolved.headings[level].frame,
        }
      }
    }
    if (user.bullet !== undefined) resolved.bullet = user.bullet
    if (user.bulletNested !== undefined) resolved.bulletNested = user.bulletNested
    if (user.ordered !== undefined) resolved.ordered = user.ordered
    if (tasksOverride !== undefined) {
      resolved.tasks = {
        pending: tasksOverride.pending ?? resolved.tasks.pending,
        done: tasksOverride.done ?? resolved.tasks.done,
        cancelled: tasksOverride.cancelled ?? resolved.tasks.cancelled,
      }
    }
    if (user.blockquotes !== undefined) resolved.blockquotes = user.blockquotes
    if (user.quotePrefix !== undefined) resolved.quotePrefix = user.quotePrefix
    if (user.inlineCode !== undefined) resolved.inlineCode = user.inlineCode
    if (user.strikethrough !== undefined) resolved.strikethrough = user.strikethrough
    if (user.hruleMode !== undefined) resolved.hruleMode = user.hruleMode
    if (user.hrule !== undefined) resolved.hrule = user.hrule
    if (user.links !== undefined) resolved.links = user.links
    if (user.guardUrlParens !== undefined) resolved.guardUrlParens = user.guardUrlParens
    if (user.codeBlock !== undefined) resolved.codeBlock = user.codeBlock
    resolved.code = {
      frame: codeOverride.frame ?? resolved.code.frame,
      topRun: codeOverride.topRun ?? resolved.code.topRun,
      bottomRun: codeOverride.bottomRun ?? resolved.code.bottomRun,
      label: codeOverride.label ?? resolved.code.label,
    }
    if (user.glyphs !== undefined) resolved.glyphs = user.glyphs
    resolved.table = { ...resolved.table, ...tableOverride }
  }

  resolved.width = user?.maxWidth ?? WIDTH_PROFILES[resolved.profile]

  return resolved
}
