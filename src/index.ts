/**
 * unmarkdown — deterministic Markdown → mobile-friendly plain
 * text for chat surfaces. Zero runtime dependencies; every export is a pure
 * function (string → string, or pure detection).
 */

export { toPlainText } from './plain'
export { toPseudoMarkdown } from './pseudo'
export { decorateTable } from './table'
export { analyze } from './analyze'
export { DEFAULT_TABLE_OPTIONS, resolveOptions } from './options'
export type { PlainTextOptions, ResolvedOptions, TableOptions, PipelineName } from './options'
export { WIDTH_PROFILES, displayWidth } from './core/width'
export type { WidthProfile } from './core/width'
