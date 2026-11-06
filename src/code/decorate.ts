/**
 * Decorated code blocks: a `┄` frame — language label on the opening line,
 * a bare run on the closing line — with every body line emitted verbatim:
 * only the fence's own leading indent is stripped (spaces only — tabs are
 * content and preserved), relative indentation beyond the fence indent is
 * kept as-is, interior blank lines survive as truly empty lines, and
 * leading/trailing blank lines of the body are trimmed.
 * Content is otherwise untouched — sentinel tokens inside the body expand
 * during the global restore pass.
 */

import type { CodeFrameOptions, ResolvedOptions } from '../options'
import { displayWidth } from '../core/width'

export interface CodeFence {
  indent: string
  lang: string
  body: string
}

function stripLeadingSpaces(line: string, max: number): string {
  let i = 0
  while (i < max && line.charCodeAt(i) === 0x20) i++
  return line.slice(i)
}

/**
 * Opening line: `frame×topRun label frame×topRun` when a label is shown,
 * otherwise a bare `frame×bottomRun` (matching the closing line). The label
 * is the first whitespace-separated token of the trimmed fence info string.
 * A labeled top line wider than the resolved width shrinks both side runs
 * toward 1, keeping run 1 when it still overflows.
 */
function topLine(fence: CodeFence, code: CodeFrameOptions, width: number): string {
  const match = /^\S+/.exec(fence.lang.trim())
  const label = match !== null ? match[0] : ''
  if (!code.label || label === '') return code.frame.repeat(code.bottomRun)
  let run = code.topRun
  let top = `${code.frame.repeat(run)} ${label} ${code.frame.repeat(run)}`
  while (run > 1 && displayWidth(top) > width) {
    run--
    top = `${code.frame.repeat(run)} ${label} ${code.frame.repeat(run)}`
  }
  return top
}

/**
 * True for a decorated-code separator line: the bare closing (or unlabeled
 * opening) `frame×bottomRun`, or any labeled opening `frame×k label frame×k`
 * with equal side runs (k ≥ 1, including width-shrunk runs). Shared by the
 * cleanup and wrap passes so code regions are detected identically.
 */
export function isCodeSeparator(line: string, code: CodeFrameOptions): boolean {
  if (line === code.frame.repeat(code.bottomRun)) return true
  const escaped = code.frame.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`^(${escaped}+) (.+) (${escaped}+)$`).exec(line)
  return m !== null && m[1].length === m[3].length
}

export function renderDecoratedCode(fence: CodeFence, opts: ResolvedOptions): string {
  const code = opts.code
  const top = topLine(fence, code, opts.width)
  const lines = fence.body.split('\n').map((line) => stripLeadingSpaces(line, fence.indent.length))

  let lo = 0
  let hi = lines.length
  while (lo < hi && (lines[lo] ?? '').trim() === '') lo++
  while (hi > lo && (lines[hi - 1] ?? '').trim() === '') hi--

  const body = lines.slice(lo, hi)
  return `${top}\n${body.join('\n')}\n${code.frame.repeat(code.bottomRun)}`
}
